from sqlalchemy import Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class RecommendationSetting(Base, TimestampMixin):
    __tablename__ = "recommendation_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 워크스페이스 단위 설정
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    search_trend_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    semantic_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)