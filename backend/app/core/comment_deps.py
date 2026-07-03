from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.workspace_deps import WRITE_ROLES
from app.crud.block import get_block
from app.crud.comment import get_comment
from app.crud.mindmap import get_mindmap
from app.crud.workspace import get_membership
from app.db import get_db
from app.models.comment import Comment
from app.models.user import User


async def get_comment_and_check_membership(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Comment:
    """comment_id -> block_id -> map_id -> workspace_id 순서로 거슬러 올라가 멤버십 확인"""
    comment = await get_comment(db, comment_id)
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="코멘트를 찾을 수 없습니다")

    block = await get_block(db, comment.block_id)
    if block is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="블록을 찾을 수 없습니다")

    mindmap = await get_mindmap(db, block.map_id)
    if mindmap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="마인드맵을 찾을 수 없습니다")

    membership = await get_membership(db, mindmap.workspace_id, current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 워크스페이스의 멤버가 아닙니다")

    return comment


async def require_comment_write_access(
    comment: Comment = Depends(get_comment_and_check_membership),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Comment:
    """viewer를 제외한 owner/editor만 통과, '해결 처리' 토글처럼 작성자가 아니어도 되는 작업에 사용"""
    block = await get_block(db, comment.block_id)
    mindmap = await get_mindmap(db, block.map_id)
    membership = await get_membership(db, mindmap.workspace_id, current_user.id)
    if membership.role not in WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 작업을 수행할 권한이 없습니다 (viewer는 읽기 전용)",
        )
    return comment


async def require_comment_author(
    comment: Comment = Depends(get_comment_and_check_membership),
    current_user: User = Depends(get_current_user),
) -> Comment:
    """내용 수정처럼 작성자 본인만 할 수 있는 작업에 사용"""
    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인이 작성한 코멘트만 수정할 수 있습니다",
        )
    return comment