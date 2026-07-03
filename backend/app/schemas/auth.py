from pydantic import BaseModel

from app.schemas.user import UserPublic


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenResponse(AccessTokenResponse):
    refresh_token: str
    user: UserPublic