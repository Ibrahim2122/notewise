"""
app/dependencies/auth.py
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.db import get_db
from app.db.models.user import User
from app.auth.jwt_validator import validate_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    claims = await validate_token(credentials.credentials)

    oid = claims.get("oid") or claims.get("sub")
    if not oid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing oid/sub claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.oid == oid).first()
    if not user:
        user = User(
            oid=oid,
            email=claims.get("email") or claims.get("preferred_username") or f"{oid}@unknown",
            name=claims.get("name") or claims.get("preferred_username") or oid,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user