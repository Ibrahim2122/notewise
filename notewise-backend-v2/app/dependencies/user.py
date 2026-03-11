from fastapi import Header, HTTPException


"""
app/dependencies/user.py

Minimal "auth" dependency for the no-auth dev phase.
The frontend sends:   X-User-Id: <uuid>
The backend reads it and uses it for blob path construction + ownership scoping.

When real auth is added, replace this one function and nothing else changes.
"""

import uuid
from fastapi import Header, HTTPException, status


def get_user_id(x_user_id: str = Header(..., alias="X-User-Id")) -> str:
    """
    Require the X-User-Id header, validate it is a UUID, and return it as a
    plain string. The workspaces.user_id column is VARCHAR, so we must not
    pass a uuid.UUID object or PostgreSQL will reject the type comparison.
    """
    try:
        return str(uuid.UUID(x_user_id))  # validates format, returns canonical string
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-User-Id header must be a valid UUID.",
        )