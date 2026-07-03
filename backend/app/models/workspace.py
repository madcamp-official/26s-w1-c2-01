from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.user import User


class Workspace(Base, TimestampMixin):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    members: Mapped[list["WorkspaceMember"]] = relationship(
        "WorkspaceMember", cascade="all, delete-orphan", lazy="selectin"
    )


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # owner: 워크스페이스 생성자, 전체 권한(삭제, 멤버관리 포함)
    # editor: 블록/코멘트/마인드맵 등 쓰기 가능, 멤버관리 불가
    # viewer: 읽기 전용
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="editor")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # 응답에서 WorkspaceMemberPublic.user로 유저 정보를 함께 내려주기 위한 관계
    user: Mapped[User] = relationship("User", lazy="joined")


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    inviter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    invitee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # 초대 수락 시 이 role로 WorkspaceMember가 생성 (editor 또는 viewer만 가능, owner는 초대로 만들 수 없음)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="editor")
    # pending / accepted / rejected
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # 응답에서 InvitationPublic.workspace / .inviter로 함께 내려주기 위한 관계
    workspace: Mapped[Workspace] = relationship("Workspace", lazy="joined")
    inviter: Mapped[User] = relationship("User", foreign_keys=[inviter_id], lazy="joined")