from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.block_deps import get_block_and_check_membership
from app.core.comment_deps import (
    get_comment_and_check_membership,
    require_comment_author,
    require_comment_write_access,
)
from app.core.connection_manager import manager
from app.core.deps import get_current_user
from app.core.events import comment_deleted_event, comment_event
from app.core.mindmap_deps import get_mindmap_and_check_membership
from app.crud.block import get_block
from app.crud.comment import (
    create_comment,
    delete_comment,
    list_comments_by_block,
    list_comments_by_map,
    update_comment_content,
    update_comment_solved,
)
from app.crud.mindmap import get_mindmap
from app.crud.workspace import get_membership
from app.db import get_db
from app.models.block import Block
from app.models.comment import Comment
from app.models.mindmap import MindMap
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentPublic, CommentSolvedUpdate, CommentUpdate

router = APIRouter(tags=["comments"])


async def _map_id_of_block(db: AsyncSession, block_id: int) -> int:
    block = await get_block(db, block_id)
    return block.map_id


@router.post(
    "/blocks/{block_id}/comments",
    response_model=CommentPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create(
    block_id: int,
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    block: Block = Depends(get_block_and_check_membership),
):
    """워크스페이스의 모든 멤버(owner/editor/viewer)가 댓글을 작성할 수 있다."""
    comment = await create_comment(db, block_id, current_user.id, body.content)
    await manager.broadcast(block.map_id, comment_event("comment:created", comment))
    return comment


@router.get("/blocks/{block_id}/comments", response_model=list[CommentPublic])
async def list_by_block(
    block_id: int,
    solved: bool | None = Query(default=None, description="true/false로 필터, 생략 시 전체"),
    db: AsyncSession = Depends(get_db),
    _block: Block = Depends(get_block_and_check_membership),
):
    """선택된 노드(블록)의 댓글 목록"""
    return await list_comments_by_block(db, block_id, solved)


@router.get("/maps/{map_id}/comments", response_model=list[CommentPublic])
async def list_by_map(
    map_id: int,
    solved: bool | None = Query(default=None, description="true/false로 필터, 생략 시 전체"),
    db: AsyncSession = Depends(get_db),
    _mindmap: MindMap = Depends(get_mindmap_and_check_membership),
):
    """마인드맵 전체의 댓글 목록 (노드를 선택하지 않아도 댓글 개수를 바로 보여주기 위함)"""
    return await list_comments_by_map(db, map_id, solved)


@router.patch("/comments/{comment_id}", response_model=CommentPublic)
async def update_content(
    body: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    comment: Comment = Depends(require_comment_author),
):
    updated = await update_comment_content(db, comment, body.content)
    map_id = await _map_id_of_block(db, updated.block_id)
    await manager.broadcast(map_id, comment_event("comment:updated", updated))
    return updated


@router.patch("/comments/{comment_id}/solved", response_model=CommentPublic)
async def update_solved(
    body: CommentSolvedUpdate,
    db: AsyncSession = Depends(get_db),
    comment: Comment = Depends(require_comment_write_access),
):
    """해결 처리는 작성자가 아니어도 owner/editor면 누구나 가능"""
    updated = await update_comment_solved(db, comment, body.solved)
    map_id = await _map_id_of_block(db, updated.block_id)
    event_type = "comment:resolved" if body.solved else "comment:reopened"
    await manager.broadcast(map_id, comment_event(event_type, updated))
    return updated


@router.delete("/comments/{comment_id}")
async def delete(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    comment: Comment = Depends(get_comment_and_check_membership),
):
    """작성자 본인이거나, 워크스페이스 owner면 삭제 가능"""
    block = await get_block(db, comment.block_id)
    mindmap = await get_mindmap(db, block.map_id)
    membership = await get_membership(db, mindmap.workspace_id, current_user.id)

    if comment.author_id != current_user.id and membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인이 작성한 코멘트이거나 워크스페이스 owner만 삭제할 수 있습니다",
        )

    comment_id = comment.id
    map_id = block.map_id
    await delete_comment(db, comment)
    await manager.broadcast(map_id, comment_deleted_event(comment_id, block.id))
    return {"message": "코멘트가 삭제되었습니다"}
