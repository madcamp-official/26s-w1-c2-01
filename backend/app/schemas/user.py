import re

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_password_strength(value: str) -> str:
    """회원가입/프로필 수정에서 공통으로 쓰는 비밀번호 강도 검사 (8자 이상은 Field(min_length=8)에서 별도 처리)"""
    if not re.search(r"[A-Za-z]", value):
        raise ValueError("비밀번호는 알파벳을 포함해야 합니다")
    if not re.search(r"\d", value):
        raise ValueError("비밀번호는 숫자를 포함해야 합니다")
    if not re.search(r"[^A-Za-z0-9]", value):
        raise ValueError("비밀번호는 특수문자를 포함해야 합니다")
    return value


class UserCreate(BaseModel):
    email: str = Field(
        min_length=3,
        max_length=255,
        description="로그인에 사용할 이메일 형식 아이디, 실제 인증 메일은 보내지 않음",
    )
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=50, description="화면에 표시될 이름")

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class ProfileUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50, description="화면에 표시될 이름")
    current_password: str | None = Field(None, description="비밀번호를 바꿀 때 본인 확인용")
    new_password: str | None = Field(None, min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str | None) -> str | None:
        return _validate_password_strength(value) if value is not None else value


class UserPublic(BaseModel):
    """비밀번호 해시 등 민감 정보를 제외하고 응답에 노출할 필드"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str


class UserSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str