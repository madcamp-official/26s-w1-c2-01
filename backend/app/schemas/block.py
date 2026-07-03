from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# app.models.block.BLOCK_COLORS와 값 일치
BlockColor = Literal["indigo", "violet", "cyan", "emerald", "amber", "red", "pink", "blue"]


class BlockCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)
    # 루트 블록은 마인드맵 생성 시 자동으로만 만들어짐, 일반 생성 API에서는 항상 필수
    parent_block_id: int
    position_x: float = 0
    position_y: float = 0
    # None이면 부모 블록의 color를 그대로 상속
    color: BlockColor | None = None


class BlockUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=500)
    color: BlockColor | None = None


class BlockPositionUpdate(BaseModel):
    position_x: float
    position_y: float


class BlockParentUpdate(BaseModel):
    parent_block_id: int


class BlockPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    map_id: int
    parent_block_id: int | None
    creator_id: int
    content: str
    source_type: str
    color: str
    position_x: float
    position_y: float
    created_at: datetime
    updated_at: datetime