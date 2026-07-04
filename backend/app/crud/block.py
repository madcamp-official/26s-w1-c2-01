from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.block import Block
from app.models.mindmap import MindMap


async def get_block(db: AsyncSession, block_id: int) -> Block | None:
    return await db.get(Block, block_id)


async def list_blocks_by_map(db: AsyncSession, map_id: int) -> list[Block]:
    stmt = select(Block).where(Block.map_id == map_id).order_by(Block.created_at.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_child_contents(db: AsyncSession, parent_block_id: int) -> list[str]:
    """이미 존재하는 하위 노드 내용 목록 (추천에서 중복 제외용)"""
    stmt = select(Block.content).where(Block.parent_block_id == parent_block_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def count_blocks_grouped_by_map(db: AsyncSession, map_ids: list[int]) -> dict[int, int]:
    """마인드맵 목록 조회(node_count 표시)용, map_id -> 블록 개수"""
    if not map_ids:
        return {}
    stmt = select(Block.map_id, func.count(Block.id)).where(Block.map_id.in_(map_ids)).group_by(Block.map_id)
    result = await db.execute(stmt)
    return dict(result.all())


async def create_block(
    db: AsyncSession,
    *,
    map_id: int,
    parent_block_id: int,
    creator_id: int,
    content: str,
    color: str,
    source_type: str = "manual",
) -> Block:
    block = Block(
        map_id=map_id,
        parent_block_id=parent_block_id,
        creator_id=creator_id,
        content=content,
        color=color,
        source_type=source_type,
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return block


async def update_block_content(
    db: AsyncSession, block: Block, *, content: str | None, color: str | None
) -> Block:
    if content is not None:
        block.content = content
    if color is not None:
        block.color = color
    await db.commit()
    await db.refresh(block)
    return block


async def update_block_parent(db: AsyncSession, block: Block, new_parent_id: int) -> Block:
    block.parent_block_id = new_parent_id
    await db.commit()
    await db.refresh(block)
    return block


async def get_subtree_block_ids(db: AsyncSession, block_id: int) -> list[int]:
    """block_id 자신 + 모든 하위 서브트리의 id 목록"""
    all_ids = [block_id]
    frontier = [block_id]
    while frontier:
        stmt = select(Block.id).where(Block.parent_block_id.in_(frontier))
        result = await db.execute(stmt)
        children = [row[0] for row in result.all()]
        if not children:
            break
        all_ids.extend(children)
        frontier = children
    return all_ids


async def delete_block(db: AsyncSession, block: Block) -> None:
    # 하위 서브트리는 DB의 ON DELETE CASCADE(parent_block_id FK)가 알아서 정리
    await db.delete(block)
    await db.commit()


async def would_create_cycle(db: AsyncSession, block_id: int, new_parent_id: int) -> bool:
    """new_parent_id가 block_id 자신이거나, block_id의 자손이면 True (사이클 발생)"""
    if block_id == new_parent_id:
        return True

    current_id: int | None = new_parent_id
    visited: set[int] = set()
    while current_id is not None:
        if current_id == block_id:
            return True
        if current_id in visited:
            break    # 기존 데이터에 예상 못한 루프가 있어도 무한루프 방지
        visited.add(current_id)
        parent = await db.get(Block, current_id)
        if parent is None:
            break
        current_id = parent.parent_block_id
    return False


async def set_block_embedding(db: AsyncSession, block: Block, embedding: list[float]) -> None:
    block.embedding = embedding
    await db.commit()


async def find_semantic_neighbors(
    db: AsyncSession, block: Block, workspace_id: int, limit: int = 5
) -> list[dict]:
    """block.content와 사전적(의미적)으로 비슷한 다른 블록들을 워크스페이스 전체에서 찾음"""
    if block.embedding is None:
        return []

    stmt = (
        select(Block, Block.embedding.cosine_distance(block.embedding).label("distance"))
        .join(MindMap, MindMap.id == Block.map_id)
        .where(
            MindMap.workspace_id == workspace_id,
            Block.id != block.id,
            Block.embedding.is_not(None),
        )
        .order_by("distance")
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    # 코사인 거리(0=완전히 같음 ~ 2=정반대)를 0~1 유사도 점수로 변환
    return [{"content": b.content, "score": max(0.0, 1 - dist)} for b, dist in rows]