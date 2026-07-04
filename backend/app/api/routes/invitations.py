from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.connection_manager import workspace_manager
from app.core.deps import get_current_user
from app.core.events import member_event
from app.crud.invitation import (
    accept_invitation,
    get_invitation,
    list_invitations_for_user,
    reject_invitation,
)
from app.crud.workspace import get_membership
from app.db import get_db
from app.models.user import User
from app.schemas.invitation import InvitationPublic

router = APIRouter(prefix="/invitations", tags=["invitations"])


async def _get_my_pending_invitation_or_404(
    invitation_id: int, current_user: User, db: AsyncSession
):
    invitation = await get_invitation(db, invitation_id)
    if invitation is None or invitation.invitee_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="초대를 찾을 수 없습니다")
    if invitation.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 처리된 초대입니다")
    return invitation


@router.get("", response_model=list[InvitationPublic])
async def list_mine(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_invitations_for_user(db, current_user.id)


@router.post("/{invitation_id}/accept")
async def accept(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    invitation = await _get_my_pending_invitation_or_404(invitation_id, current_user, db)
    await accept_invitation(db, invitation)
    # get_membership으로 다시 조회해 WorkspaceMember.user(lazy="joined")가 확실히 채워진 상태로 브로드캐스트
    new_member = await get_membership(db, invitation.workspace_id, current_user.id)
    if new_member is not None:
        await workspace_manager.broadcast(
            invitation.workspace_id, member_event("member:added", invitation.workspace_id, new_member)
        )
    return {"message": "초대를 수락했습니다"}


@router.post("/{invitation_id}/reject")
async def reject(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    invitation = await _get_my_pending_invitation_or_404(invitation_id, current_user, db)
    await reject_invitation(db, invitation)
    return {"message": "초대를 거절했습니다"}