from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MindMapCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class MindMapUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class MindMapPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace_id: int
    name: str
    root_block_id: int | None
    created_by: int
    created_at: datetime
    updated_at: datetime


class MindMapListItem(MindMapPublic):
    """워크스페이스 내 마인드맵 목록 조회용, 프론트 MapData.nodeCount에 대응"""

    node_count: int