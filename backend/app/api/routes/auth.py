from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.crud.user import create_user, get_user_by_email, get_user_by_id
from app.db import get_db
from app.schemas.auth import (
    AccessTokenResponse,
    EmailAvailabilityResponse,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/email-availability", response_model=EmailAvailabilityResponse)
async def email_availability(
    email: str = Query(min_length=3, max_length=255),
    db: AsyncSession = Depends(get_db),
):
    """회원가입 폼에서 이메일 입력 중 실시간으로 중복 여부를 보여주기 위한 공개 엔드포인트"""
    existing = await get_user_by_email(db, email)
    return EmailAvailabilityResponse(available=existing is None)


@router.post("/signup", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def signup(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await get_user_by_email(db, user_in.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 사용 중인 이메일입니다",
        )
    return await create_user(db, user_in)


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, credentials.email)
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
        )
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=user,
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        decoded = decode_token(payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않거나 만료된 리프레시 토큰입니다",
        ) from exc

    if decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="refresh 토큰이 아닙니다",
        )

    user = await get_user_by_id(db, int(decoded["sub"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다")

    return AccessTokenResponse(access_token=create_access_token(user.id))


@router.post("/logout")
async def logout():
    # JWT는 서버에 세션 상태를 두지 않고 검증, 로그아웃은 클라이언트가 토큰을 버리는 것으로 처리
    return {"message": "로그아웃되었습니다"}