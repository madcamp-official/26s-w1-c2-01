from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.workspace_deps import WRITE_ROLES
from app.crud.block import get_block
from app.crud.mindmap import get_mindmap
from app.crud.workspace import get_membership
from app.db import get_db
from app.models.block import Block
from app.models.user import User


async def get_block_and_check_membership(
    block_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Block:
    """block_id -> map_id -> workspace_id 순서로 거슬러 올라가 멤버십 확인
    `/blocks/{block_id}` 형태 경로는 workspace_id도 map_id도 URL에 없어 블록을 먼저 찾은 뒤 그 소속을 따라 올라가는 방식으로 처리
    """
    block = await get_block(db, block_id)
    if block is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="블록을 찾을 수 없습니다")

    mindmap = await get_mindmap(db, block.map_id)
    if mindmap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="마인드맵을 찾을 수 없습니다")

    membership = await get_membership(db, mindmap.workspace_id, current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 워크스페이스의 멤버가 아닙니다")

    return block


async def require_block_write_access(
    block: Block = Depends(get_block_and_check_membership),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Block:
    mindmap = await get_mindmap(db, block.map_id)
    membership = await get_membership(db, mindmap.workspace_id, current_user.id)
    if membership.role not in WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 작업을 수행할 권한이 없습니다 (viewer는 읽기 전용)",
        )
    return block