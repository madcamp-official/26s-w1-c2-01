from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserPublic
from app.schemas.workspace import WorkspacePublic

InvitationStatus = Literal["pending", "accepted", "rejected"]


class InvitationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace: WorkspacePublic
    inviter: UserPublic
    role: str
    status: InvitationStatus
    created_at: datetime