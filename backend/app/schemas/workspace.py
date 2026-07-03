from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserPublic

# 초대로 부여 가능한 역할 (owner는 워크스페이스 생성 시 자동 부여되며 초대로는 줄 수 없음)
InvitableRole = Literal["editor", "viewer"]
MemberRole = Literal["owner", "editor", "viewer"]


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class WorkspaceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class WorkspacePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    owner_id: int
    created_at: datetime
    updated_at: datetime


class WorkspaceMemberPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user: UserPublic
    role: MemberRole
    joined_at: datetime


class WorkspaceDetail(WorkspacePublic):
    members: list[WorkspaceMemberPublic]


class MemberRoleUpdate(BaseModel):
    role: InvitableRole


class InviteRequest(BaseModel):
    user_id: int
    role: InvitableRole = "editor"