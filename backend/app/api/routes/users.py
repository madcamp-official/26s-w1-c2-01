from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.crud.user import search_users
from app.db import get_db
from app.models.user import User
from app.schemas.user import UserPublic, UserSearchResult

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
async def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/search", response_model=list[UserSearchResult])
async def search(
    q: str = Query(min_length=1, max_length=255, description="검색할 이메일(부분 일치)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """워크스페이스 초대 시 유저 이메일로 검색하는 용도, 본인은 결과에서 제외"""
    users = await search_users(db, q)
    return [u for u in users if u.id != current_user.id]