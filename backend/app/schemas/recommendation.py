from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RecommendationItem(BaseModel):
    content: str
    score: float
    source: Literal["semantic", "search"]


class RecommendationApplyRequest(BaseModel):
    content: str = Field(min_length=1, max_length=500)
    # 프론트가 추천 후보를 화면에 미리 배치해둔 위치가 있으면 그대로 전달, 없으면 서버가 기본값 계산
    position_x: float | None = None
    position_y: float | None = None


class RecommendationSettingUpdate(BaseModel):
    search_trend_weight: float = Field(ge=0, le=1)
    semantic_weight: float = Field(ge=0, le=1)


class RecommendationSettingPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace_id: int
    search_trend_weight: float
    semantic_weight: float
    updated_at: datetime