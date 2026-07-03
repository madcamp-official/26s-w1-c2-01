"""initial schema: user, workspace, mindmap, block, comment, recommendation

Revision ID: 0b2a6b4e54b1
Revises:
Create Date: 2026-07-03

"""
from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy

# revision identifiers, used by Alembic.
revision = "0b2a6b4e54b1"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) users — 다른 모든 테이블이 참조하므로 가장 먼저
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # 2) workspaces — users를 참조
    op.create_table(
        "workspaces",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # 3) mindmaps — root_block_id는 blocks 테이블이 아직 없어서 FK 없이 정수 컬럼만 먼저 만든다
    op.create_table(
        "mindmaps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.Integer(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("root_block_id", sa.Integer(), nullable=True),  # FK는 4번 다음에 추가
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # 4) blocks — 이제 mindmaps가 있으니 생성 가능
    op.create_table(
        "blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("map_id", sa.Integer(), sa.ForeignKey("mindmaps.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "parent_block_id",
            sa.Integer(),
            sa.ForeignKey("blocks.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("creator_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content", sa.String(length=500), nullable=False),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(384), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "color IN ('indigo', 'violet', 'cyan', 'emerald', 'amber', 'red', 'pink', 'blue')",
            name="ck_block_color",
        ),
        sa.CheckConstraint("source_type IN ('manual', 'recommended')", name="ck_block_source_type"),
    )

    # 5) 이제 blocks가 생겼으니, mindmaps.root_block_id에 진짜 FK 제약을 추가
    op.create_foreign_key(
        "fk_mindmaps_root_block_id_blocks",
        "mindmaps",
        "blocks",
        ["root_block_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 6) workspace_members
    op.create_table(
        "workspace_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.Integer(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
    )

    # 7) invitations
    op.create_table(
        "invitations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.Integer(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("inviter_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("invitee_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # 8) comments — blocks를 참조
    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("block_id", sa.Integer(), sa.ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content", sa.String(length=1000), nullable=False),
        sa.Column("solved", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # 9) recommendation_settings
    op.create_table(
        "recommendation_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.Integer(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("search_trend_weight", sa.Float(), nullable=False),
        sa.Column("semantic_weight", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("workspace_id"),
    )


def downgrade() -> None:
    # 생성한 순서의 반대로 삭제
    op.drop_table("recommendation_settings")
    op.drop_table("comments")
    op.drop_table("invitations")
    op.drop_table("workspace_members")
    op.drop_constraint("fk_mindmaps_root_block_id_blocks", "mindmaps", type_="foreignkey")
    op.drop_table("blocks")
    op.drop_table("mindmaps")
    op.drop_table("workspaces")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")