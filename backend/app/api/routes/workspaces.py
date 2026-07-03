from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.workspace_deps import (
    get_current_membership,
    require_owner,
    require_write_access,
)
from app.crud.invitation import create_invitation, get_pending_invitation
from app.crud.user import get_user_by_id
from app.crud.workspace import (
    create_workspace,
    delete_workspace,
    get_membership,
    get_workspace,
    get_workspace_with_members,
    list_members,
    list_workspaces_for_user,
    remove_member,
    update_member_role,
    update_workspace_name,
)
from app.db import get_db
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.invitation import InvitationPublic
from app.schemas.workspace import (
    InviteRequest,
    MemberRoleUpdate,
    WorkspaceCreate,
    WorkspaceDetail,
    WorkspaceMemberPublic,
    WorkspacePublic,
    WorkspaceUpdate,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


async def _get_workspace_or_404(workspace_id: int, db: AsyncSession):
    workspace = await get_workspace(db, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="워크스페이스를 찾을 수 없습니다")
    return workspace


@router.post("", response_model=WorkspacePublic, status_code=status.HTTP_201_CREATED)
async def create(
    body: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_workspace(db, current_user.id, body.name)


@router.get("", response_model=list[WorkspacePublic])
async def list_mine(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_workspaces_for_user(db, current_user.id)


@router.get("/{workspace_id}", response_model=WorkspaceDetail)
async def get_detail(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(get_current_membership),  # 멤버인지만 확인
):
    workspace = await get_workspace_with_members(db, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="워크스페이스를 찾을 수 없습니다")
    return workspace


@router.patch("/{workspace_id}", response_model=WorkspacePublic)
async def update(
    workspace_id: int,
    body: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(require_write_access),
):
    workspace = await _get_workspace_or_404(workspace_id, db)
    return await update_workspace_name(db, workspace, body.name)


@router.delete("/{workspace_id}")
async def delete(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(require_owner),
):
    workspace = await _get_workspace_or_404(workspace_id, db)
    await delete_workspace(db, workspace)
    return {"message": "워크스페이스가 삭제되었습니다"}


@router.post("/{workspace_id}/invite", response_model=InvitationPublic, status_code=status.HTTP_201_CREATED)
async def invite(
    workspace_id: int,
    body: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(require_write_access),
):
    invitee = await get_user_by_id(db, body.user_id)
    if invitee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="유저를 찾을 수 없습니다")

    existing_membership = await get_membership(db, workspace_id, body.user_id)
    if existing_membership is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 워크스페이스 멤버입니다")

    existing_invitation = await get_pending_invitation(db, workspace_id, body.user_id)
    if existing_invitation is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 초대가 발송되어 응답을 기다리는 중입니다")

    return await create_invitation(db, workspace_id, current_user.id, body.user_id, body.role)


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberPublic])
async def get_members(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(get_current_membership),
):
    return await list_members(db, workspace_id)


@router.patch("/{workspace_id}/members/{user_id}", response_model=WorkspaceMemberPublic)
async def change_member_role(
    workspace_id: int,
    user_id: int,
    body: MemberRoleUpdate,
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(require_owner),
):
    target = await get_membership(db, workspace_id, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="멤버를 찾을 수 없습니다")
    if target.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="owner의 권한은 변경할 수 없습니다")
    return await update_member_role(db, target, body.role)


@router.delete("/{workspace_id}/members/{user_id}")
async def remove(
    workspace_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(require_owner),
):
    target = await get_membership(db, workspace_id, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="멤버를 찾을 수 없습니다")
    if target.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="owner는 제거할 수 없습니다")
    await remove_member(db, target)
    return {"message": "멤버가 제거되었습니다"}