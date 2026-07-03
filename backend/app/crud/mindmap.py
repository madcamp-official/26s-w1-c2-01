from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.block import DEFAULT_BLOCK_COLOR, Block
from app.models.mindmap import MindMap


async def create_mindmap(db: AsyncSession, workspace_id: int, created_by: int, name: str) -> MindMap:
    mindmap = MindMap(workspace_id=workspace_id, created_by=created_by, name=name)
    db.add(mindmap)
    await db.flush()    # mindmap.id 확보

    root_block = Block(
        map_id=mindmap.id,
        parent_block_id=None,
        creator_id=created_by,
        content=name,
        source_type="manual",
        color=DEFAULT_BLOCK_COLOR,
        position_x=0,
        position_y=0,
    )
    db.add(root_block)
    await db.flush()    # root_block.id 확보

    mindmap.root_block_id = root_block.id
    await db.commit()
    await db.refresh(mindmap)
    return mindmap


async def get_mindmap(db: AsyncSession, map_id: int) -> MindMap | None:
    return await db.get(MindMap, map_id)


async def list_mindmaps(db: AsyncSession, workspace_id: int) -> list[MindMap]:
    stmt = (
        select(MindMap)
        .where(MindMap.workspace_id == workspace_id)
        .order_by(MindMap.updated_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_mindmap_name(db: AsyncSession, mindmap: MindMap, name: str) -> MindMap:
    mindmap.name = name
    await db.commit()
    await db.refresh(mindmap)
    return mindmap


async def delete_mindmap(db: AsyncSession, mindmap: MindMap) -> None:
    await db.delete(mindmap)
    await db.commit()