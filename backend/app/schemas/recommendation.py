from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RecommendationItem(BaseModel):
    content: str
    score: float
    source: Literal["semantic", "search", "gemini"]


class RecommendationApplyRequest(BaseModel):
    content: str = Field(min_length=1, max_length=500)


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