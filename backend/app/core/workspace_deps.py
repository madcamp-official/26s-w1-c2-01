from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.crud.workspace import get_membership
from app.db import get_db
from app.models.user import User
from app.models.workspace import WorkspaceMember

# 쓰기 작업(POST/PATCH/DELETE)이 허용되는 역할, viewer는 여기 포함 X
WRITE_ROLES = ("owner", "editor")


async def get_current_membership(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceMember:
    """
    요청한 유저가 해당 워크스페이스의 멤버인지 확인, 아니면 403
    경로에 `workspace_id`가 있는 모든 엔드포인트에서 재사용
    """
    membership = await get_membership(db, workspace_id, current_user.id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 워크스페이스의 멤버가 아닙니다",
        )
    return membership


async def require_write_access(
    membership: WorkspaceMember = Depends(get_current_membership),
) -> WorkspaceMember:
    """viewer를 제외한 owner/editor만 통과, 블록/코멘트/마인드맵 등 쓰기 API에서 사용"""
    if membership.role not in WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 작업을 수행할 권한이 없습니다 (viewer는 읽기 전용)",
        )
    return membership


async def require_owner(
    membership: WorkspaceMember = Depends(get_current_membership),
) -> WorkspaceMember:
    """워크스페이스 삭제, 멤버 권한 변경/제거처럼 owner만 가능한 작업에서 사용"""
    if membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="owner만 수행할 수 있는 작업입니다",
        )
    return membership