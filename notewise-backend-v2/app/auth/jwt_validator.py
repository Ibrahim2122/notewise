"""
app/auth/jwt_validator.py

Fetches JWKS from the Entra External ID OIDC discovery endpoint,
caches it for 1 hour, and validates incoming Bearer JWTs.
"""

import time
import logging
from typing import Any

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.config import settings

logger = logging.getLogger("notewise.auth")

# Entra External ID issues tokens with the tenant ID as the subdomain,
# not the tenant name. Both ISSUER and JWKS_URL must use the tenant ID.
ISSUER   = f"https://{settings.ENTRA_TENANT_ID}.ciamlogin.com/{settings.ENTRA_TENANT_ID}/v2.0"
JWKS_URL = f"https://{settings.ENTRA_TENANT_ID}.ciamlogin.com/{settings.ENTRA_TENANT_ID}/v2.0/.well-known/openid-configuration"

_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0
_JWKS_CACHE_TTL = 3600  # seconds


async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    if _jwks_cache and time.time() - _jwks_fetched_at < _JWKS_CACHE_TTL:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        oidc_doc = (await client.get(JWKS_URL)).json()
        keys = (await client.get(oidc_doc["jwks_uri"])).json()
    _jwks_cache = keys
    _jwks_fetched_at = time.time()
    return keys


async def validate_token(token: str) -> dict[str, Any]:
    """Validate a Bearer JWT. Returns the claims dict or raises 401."""
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        jwks = await _get_jwks()
        claims = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.API_CLIENT_ID,
            issuer=ISSUER,
            options={"verify_exp": True},
        )
        return claims
    except JWTError as e:
        logger.error("JWT validation failed: %s", str(e))
        raise exc from e