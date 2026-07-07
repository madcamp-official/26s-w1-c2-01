import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    user = User(
        email=user_in.email,
        name=user_in.name,
        password_hash=hash_password(user_in.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def search_users(db: AsyncSession, query: str, limit: int = 10) -> list[User]:
    stmt = select(User).where(User.email.ilike(f"%{query}%")).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_user_profile(
    db: AsyncSession, user: User, name: str | None = None, password_hash: str | None = None
) -> User:
    if name is not None:
        user.name = name
    if password_hash is not None:
        user.password_hash = password_hash
    await db.commit()
    await db.refresh(user)
    return user


async def anonymize_user(db: AsyncSession, user: User) -> None:
    """회원 탈퇴 처리. 블록/코멘트/초대 등 다른 사용자의 콘텐츠에 남아있는 작성자 참조(FK)가
    깨지지 않도록 User row 자체는 지우지 않고, 로그인이 불가능하도록 개인정보만 비식별화한다."""
    user.email = f"deleted-user-{user.id}@deleted.invalid"
    user.name = "탈퇴한 사용자"
    user.password_hash = hash_password(secrets.token_urlsafe(32))
    await db.commit()