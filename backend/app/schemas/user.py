from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    email: str = Field(
        min_length=3,
        max_length=255,
        description="로그인에 사용할 이메일 형식 아이디, 실제 인증 메일은 보내지 않음",
    )
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=50, description="화면에 표시될 이름")


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