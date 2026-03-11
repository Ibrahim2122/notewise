"""add blob_uri to artifacts

Revision ID: 0003
Revises: 0002_add_user_id_to_workspaces
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002_add_user_id_to_workspaces"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "artifacts",
        sa.Column("blob_uri", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("artifacts", "blob_uri")