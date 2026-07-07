from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.connection_manager import manager, workspace_manager
from app.core.deps import get_current_user
from app.core.events import member_event, member_removed_event
from app.core.security import hash_password, verify_password
from app.crud.user import anonymize_user, search_users, update_user_profile
from app.crud.workspace import (
    list_memberships_for_user,
    list_workspaces_for_user,
    remove_all_memberships,
    user_owns_any_workspace,
)
from app.db import get_db
from app.models.user import User
from app.schemas.user import ProfileUpdate, UserPublic, UserSearchResult

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
async def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserPublic)
async def update_me(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """이름/비밀번호 수정. 비밀번호를 바꾸려면 계정 탈취 시 무단 변경을 막기 위해 현재 비밀번호 확인이 필요하다.
    이름이 바뀌면 다른 사용자들의 화면(워크스페이스 멤버 목록, 마인드맵 캔버스 접속자 표시)에도
    실시간으로 반영되도록 워크스페이스/맵 채널에 함께 브로드캐스트한다."""
    if payload.new_password is not None:
        if not payload.current_password or not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="현재 비밀번호가 올바르지 않습니다",
            )
        if verify_password(payload.new_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="새 비밀번호는 현재 비밀번호와 달라야 합니다",
            )

    name_changed = payload.name is not None and payload.name != current_user.name
    password_hash = hash_password(payload.new_password) if payload.new_password is not None else None
    updated = await update_user_profile(db, current_user, name=payload.name, password_hash=password_hash)

    if name_changed:
        touched_maps = manager.update_user_info(updated.id, name=updated.name)
        for map_id in touched_maps:
            await manager.broadcast(map_id, {"type": "presence:update", "users": manager.list_users(map_id)})

        memberships = await list_memberships_for_user(db, updated.id)
        for membership in memberships:
            await workspace_manager.broadcast(
                membership.workspace_id,
                member_event("member:updated", membership.workspace_id, membership),
            )

    return updated


@router.delete("/me")
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """회원 탈퇴. 소유 중인 워크스페이스가 있으면 다른 멤버들이 고아가 되므로,
    먼저 워크스페이스를 삭제(또는 소유권 정리)하도록 안내하고 막는다."""
    if await user_owns_any_workspace(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="소유한 워크스페이스가 있어 탈퇴할 수 없습니다. 워크스페이스를 먼저 삭제해주세요",
        )
    workspaces = await list_workspaces_for_user(db, current_user.id)
    user_id = current_user.id
    await remove_all_memberships(db, user_id)
    await anonymize_user(db, current_user)
    for workspace in workspaces:
        await workspace_manager.broadcast(workspace.id, member_removed_event(workspace.id, user_id))
    return {"message": "회원 탈퇴가 완료되었습니다"}


@router.get("/search", response_model=list[UserSearchResult])
async def search(
    q: str = Query(min_length=1, max_length=255, description="검색할 이메일(부분 일치)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """워크스페이스 초대 시 유저 이메일로 검색하는 용도, 본인은 결과에서 제외"""
    users = await search_users(db, q)
    return [u for u in users if u.id != current_user.id]