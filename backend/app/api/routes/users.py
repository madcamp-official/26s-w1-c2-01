from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.connection_manager import workspace_manager
from app.core.deps import get_current_user
from app.core.events import member_removed_event
from app.crud.user import anonymize_user, search_users
from app.crud.workspace import (
    list_workspaces_for_user,
    remove_all_memberships,
    user_owns_any_workspace,
)
from app.db import get_db
from app.models.user import User
from app.schemas.user import UserPublic, UserSearchResult

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
async def read_me(current_user: User = Depends(get_current_user)):
    return current_user


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