from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.block_deps import get_block_and_check_membership, require_block_write_access
from app.core.connection_manager import manager
from app.core.deps import get_current_user
from app.core.events import block_deleted_event, block_event
from app.core.mindmap_deps import get_mindmap_and_check_membership, require_mindmap_write_access
from app.crud.block import (
    create_block,
    delete_block,
    get_block,
    get_subtree_block_ids,
    list_blocks_by_map,
    update_block_content,
    update_block_parent,
    update_block_position,
    would_create_cycle,
)
from app.db import get_db
from app.models.block import Block
from app.models.mindmap import MindMap
from app.models.user import User
from app.schemas.block import (
    BlockCreate,
    BlockParentUpdate,
    BlockPositionUpdate,
    BlockPublic,
    BlockUpdate,
)

router = APIRouter(tags=["blocks"])


@router.post(
    "/maps/{map_id}/blocks",
    response_model=BlockPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create(
    body: BlockCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    mindmap: MindMap = Depends(require_mindmap_write_access),
):
    parent = await get_block(db, body.parent_block_id)
    if parent is None or parent.map_id != mindmap.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="parent_block_id가 이 마인드맵에 속한 블록이 아닙니다",
        )

    color = body.color or parent.color    # 색상 미지정 시 부모 색상 상속

    block = await create_block(
        db,
        map_id=mindmap.id,
        parent_block_id=body.parent_block_id,
        creator_id=current_user.id,
        content=body.content,
        color=color,
        position_x=body.position_x,
        position_y=body.position_y,
    )
    await manager.broadcast(mindmap.id, block_event("block:created", block))
    return block


@router.get("/maps/{map_id}/blocks", response_model=list[BlockPublic])
async def list_by_map(
    db: AsyncSession = Depends(get_db),
    mindmap: MindMap = Depends(get_mindmap_and_check_membership),
):
    # map_id는 이미 모든 블록에 그대로 찍혀 있어서(중첩 깊이와 무관), 재귀 쿼리 없이 평평하게 조회
    return await list_blocks_by_map(db, mindmap.id)


@router.get("/blocks/{block_id}", response_model=BlockPublic)
async def get_detail(block: Block = Depends(get_block_and_check_membership)):
    return block


@router.patch("/blocks/{block_id}", response_model=BlockPublic)
async def update_content(
    body: BlockUpdate,
    db: AsyncSession = Depends(get_db),
    block: Block = Depends(require_block_write_access),
):
    updated = await update_block_content(db, block, content=body.content, color=body.color)
    await manager.broadcast(updated.map_id, block_event("block:updated", updated))
    return updated


@router.patch("/blocks/{block_id}/position", response_model=BlockPublic)
async def update_position(
    body: BlockPositionUpdate,
    db: AsyncSession = Depends(get_db),
    block: Block = Depends(require_block_write_access),
):
    updated = await update_block_position(db, block, body.position_x, body.position_y)
    await manager.broadcast(updated.map_id, block_event("block:updated", updated))
    return updated


@router.patch("/blocks/{block_id}/parent", response_model=BlockPublic)
async def update_parent(
    body: BlockParentUpdate,
    db: AsyncSession = Depends(get_db),
    block: Block = Depends(require_block_write_access),
):
    if block.parent_block_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="루트 블록은 재연결할 수 없습니다")

    new_parent = await get_block(db, body.parent_block_id)
    if new_parent is None or new_parent.map_id != block.map_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="parent_block_id가 같은 마인드맵에 속한 블록이 아닙니다",
        )

    if await would_create_cycle(db, block.id, body.parent_block_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신의 하위 블록을 부모로 지정할 수 없습니다 (트리에 사이클이 생깁니다)",
        )

    updated = await update_block_parent(db, block, body.parent_block_id)
    await manager.broadcast(updated.map_id, block_event("block:reparented", updated))
    return updated


@router.delete("/blocks/{block_id}")
async def delete(
    db: AsyncSession = Depends(get_db),
    block: Block = Depends(require_block_write_access),
):
    if block.parent_block_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="루트 블록은 삭제할 수 없습니다")

    map_id = block.map_id
    deleted_ids = await get_subtree_block_ids(db, block.id)  # 삭제 전에 미리 수집

    await delete_block(db, block)
    await manager.broadcast(map_id, block_deleted_event(deleted_ids))
    return {"message": "블록이 삭제되었습니다 (하위 블록 포함)"}