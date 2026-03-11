"""add user_id to workspaces

Revision ID: 0002_add_user_id_to_workspaces
Revises: <your previous revision id>
Create Date: 2026-03-03
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_add_user_id_to_workspaces"
down_revision = "281e0c7fd4bf"  # ← replace with your actual latest revision ID
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add user_id as nullable first so existing rows don't violate NOT NULL
    op.add_column(
        "workspaces",
        sa.Column("user_id", sa.String(), nullable=True),
    )
    # Backfill existing rows with a placeholder so we can enforce NOT NULL
    op.execute("UPDATE workspaces SET user_id = 'dev-user' WHERE user_id IS NULL")
    # Now tighten to NOT NULL
    op.alter_column("workspaces", "user_id", nullable=False)
    # Index for fast per-user lookups
    op.create_index("ix_workspaces_user_id", "workspaces", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_workspaces_user_id", table_name="workspaces")
    op.drop_column("workspaces", "user_id")