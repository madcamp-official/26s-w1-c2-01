from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.workspace_deps import WRITE_ROLES
from app.crud.mindmap import get_mindmap
from app.crud.workspace import get_membership
from app.db import get_db
from app.models.mindmap import MindMap
from app.models.user import User


async def get_mindmap_and_check_membership(
    map_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MindMap:
    """마인드맵이 존재하고, 요청자가 그 마인드맵이 속한 워크스페이스의 멤버인지 확인.

    `/maps/{map_id}` 형태의 경로는 workspace_id가 URL에 없으므로,
    마인드맵을 먼저 찾은 뒤 그 workspace_id로 멤버십을 확인하는 순서로 처리한다.
    """
    mindmap = await get_mindmap(db, map_id)
    if mindmap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="마인드맵을 찾을 수 없습니다")

    membership = await get_membership(db, mindmap.workspace_id, current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 워크스페이스의 멤버가 아닙니다")

    return mindmap


async def require_mindmap_write_access(
    mindmap: MindMap = Depends(get_mindmap_and_check_membership),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MindMap:
    membership = await get_membership(db, mindmap.workspace_id, current_user.id)
    if membership.role not in WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 작업을 수행할 권한이 없습니다 (viewer는 읽기 전용)",
        )
    return mindmap