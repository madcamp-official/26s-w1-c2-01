from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.user import User


class Comment(Base, TimestampMixin):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 프론트 CommentData.nodeId에 대응 — 항상 특정 블록에 종속 (워크스페이스 전체 목록 아님)
    block_id: Mapped[int] = mapped_column(ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(String(1000), nullable=False)
    solved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # 응답에서 CommentPublic.author로 작성자 이름을 함께 내려주기 위한 관계
    author: Mapped[User] = relationship("User", lazy="joined")