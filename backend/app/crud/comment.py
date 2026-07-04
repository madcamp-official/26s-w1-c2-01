from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.block import Block
from app.models.comment import Comment


async def create_comment(db: AsyncSession, block_id: int, author_id: int, content: str) -> Comment:
    comment = Comment(block_id=block_id, author_id=author_id, content=content)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def get_comment(db: AsyncSession, comment_id: int) -> Comment | None:
    return await db.get(Comment, comment_id)


async def list_comments_by_block(
    db: AsyncSession, block_id: int, solved: bool | None = None
) -> list[Comment]:
    stmt = select(Comment).where(Comment.block_id == block_id)
    if solved is not None:
        stmt = stmt.where(Comment.solved == solved)
    stmt = stmt.order_by(Comment.created_at.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_comments_by_map(
    db: AsyncSession, map_id: int, solved: bool | None = None
) -> list[Comment]:
    stmt = select(Comment).join(Block, Block.id == Comment.block_id).where(Block.map_id == map_id)
    if solved is not None:
        stmt = stmt.where(Comment.solved == solved)
    stmt = stmt.order_by(Comment.created_at.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_comment_content(db: AsyncSession, comment: Comment, content: str) -> Comment:
    comment.content = content
    await db.commit()
    await db.refresh(comment)
    return comment


async def update_comment_solved(db: AsyncSession, comment: Comment, solved: bool) -> Comment:
    comment.solved = solved
    await db.commit()
    await db.refresh(comment)
    return comment


async def delete_comment(db: AsyncSession, comment: Comment) -> None:
    await db.delete(comment)
    await db.commit()