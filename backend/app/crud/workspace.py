from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workspace import Workspace, WorkspaceMember


async def create_workspace(db: AsyncSession, owner_id: int, name: str) -> Workspace:
    workspace = Workspace(name=name, owner_id=owner_id)
    db.add(workspace)
    await db.flush()    # workspace.id를 얻기 위해 flush (commit 전에 PK 확보)

    membership = WorkspaceMember(workspace_id=workspace.id, user_id=owner_id, role="owner")
    db.add(membership)

    await db.commit()
    await db.refresh(workspace)
    return workspace


async def get_workspace(db: AsyncSession, workspace_id: int) -> Workspace | None:
    return await db.get(Workspace, workspace_id)


async def get_workspace_with_members(db: AsyncSession, workspace_id: int) -> Workspace | None:
    stmt = (
        select(Workspace)
        .where(Workspace.id == workspace_id)
        .options(selectinload(Workspace.members))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_workspaces_for_user(db: AsyncSession, user_id: int) -> list[Workspace]:
    stmt = (
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id)
        .order_by(Workspace.updated_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_workspace_name(db: AsyncSession, workspace: Workspace, name: str) -> Workspace:
    workspace.name = name
    await db.commit()
    await db.refresh(workspace)
    return workspace


async def delete_workspace(db: AsyncSession, workspace: Workspace) -> None:
    await db.delete(workspace)
    await db.commit()


async def get_membership(db: AsyncSession, workspace_id: int, user_id: int) -> WorkspaceMember | None:
    stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_members(db: AsyncSession, workspace_id: int) -> list[WorkspaceMember]:
    stmt = (
        select(WorkspaceMember)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.joined_at.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def add_member(db: AsyncSession, workspace_id: int, user_id: int, role: str) -> WorkspaceMember:
    membership = WorkspaceMember(workspace_id=workspace_id, user_id=user_id, role=role)
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return membership


async def update_member_role(db: AsyncSession, membership: WorkspaceMember, role: str) -> WorkspaceMember:
    membership.role = role
    await db.commit()
    await db.refresh(membership)
    return membership


async def remove_member(db: AsyncSession, membership: WorkspaceMember) -> None:
    await db.delete(membership)
    await db.commit()


async def user_owns_any_workspace(db: AsyncSession, user_id: int) -> bool:
    stmt = select(Workspace.id).where(Workspace.owner_id == user_id).limit(1)
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


async def remove_all_memberships(db: AsyncSession, user_id: int) -> None:
    await db.execute(delete(WorkspaceMember).where(WorkspaceMember.user_id == user_id))
    await db.commit()