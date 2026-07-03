from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserPublic


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class CommentUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class CommentSolvedUpdate(BaseModel):
    solved: bool


class CommentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    block_id: int
    author: UserPublic
    content: str
    solved: bool
    created_at: datetime
    updated_at: datetime