from pgvector.sqlalchemy import Vector
from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

BLOCK_COLORS = ("indigo", "violet", "cyan", "emerald", "amber", "red", "pink", "blue")
DEFAULT_BLOCK_COLOR = "indigo"

EMBEDDING_DIM = 384


class Block(Base, TimestampMixin):
    __tablename__ = "blocks"
    __table_args__ = (
        CheckConstraint(f"color IN {BLOCK_COLORS}", name="ck_block_color"),
        CheckConstraint("source_type IN ('manual', 'recommended')", name="ck_block_source_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    map_id: Mapped[int] = mapped_column(ForeignKey("mindmaps.id", ondelete="CASCADE"), nullable=False)
    # 부모 블록을 지우면 DB가 알아서 하위 서브트리 전체를 같이 지워줌
    parent_block_id: Mapped[int | None] = mapped_column(
        ForeignKey("blocks.id", ondelete="CASCADE"), nullable=True
    )
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(String(500), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    color: Mapped[str] = mapped_column(String(20), nullable=False, default=DEFAULT_BLOCK_COLOR)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)