from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from src.config import settings

ALGORITHM = "RS256"


def create_access_token(
    user_id: str,
    email: str,
    role: str,
    expire_minutes: int | None = None,
) -> str:
    minutes = expire_minutes if expire_minutes is not None else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.get_jwt_private(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.get_jwt_public(), algorithms=[ALGORITHM])
    except JWTError as e:
        print(f"JWTDecodeError: {e}")
        raise ValueError(f"Invalid token: {e}")
    except Exception as e:
        print(f"Unknown JWT Error: {e}")
        raise ValueError(f"Invalid token: {e}")
