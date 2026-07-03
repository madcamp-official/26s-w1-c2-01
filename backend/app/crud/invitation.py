from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.workspace import add_member
from app.models.workspace import Invitation


async def create_invitation(
    db: AsyncSession, workspace_id: int, inviter_id: int, invitee_id: int, role: str
) -> Invitation:
    invitation = Invitation(
        workspace_id=workspace_id, inviter_id=inviter_id, invitee_id=invitee_id, role=role
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return invitation


async def get_invitation(db: AsyncSession, invitation_id: int) -> Invitation | None:
    return await db.get(Invitation, invitation_id)


async def get_pending_invitation(db: AsyncSession, workspace_id: int, invitee_id: int) -> Invitation | None:
    stmt = select(Invitation).where(
        Invitation.workspace_id == workspace_id,
        Invitation.invitee_id == invitee_id,
        Invitation.status == "pending",
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_invitations_for_user(db: AsyncSession, user_id: int) -> list[Invitation]:
    stmt = (
        select(Invitation)
        .where(Invitation.invitee_id == user_id, Invitation.status == "pending")
        .order_by(Invitation.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def accept_invitation(db: AsyncSession, invitation: Invitation) -> None:
    invitation.status = "accepted"
    await db.commit()
    # 멤버 추가는 별도 커밋 (add_member 내부에서 commit)
    await add_member(db, invitation.workspace_id, invitation.invitee_id, invitation.role)


async def reject_invitation(db: AsyncSession, invitation: Invitation) -> None:
    invitation.status = "rejected"
    await db.commit()