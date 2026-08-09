import base64

from pydantic_settings import BaseSettings, SettingsConfigDict


def _decode_pem(value: str) -> str:
    """Accepts either a raw PEM block (local/Docker .env) or a base64-encoded
    one (Vercel env var UI). Multi-line PEM pasted into a web text field is
    prone to silent corruption (smart quotes/dashes swapped in by the
    browser); base64 collapses it to one line of plain ASCII, immune to that.
    """
    value = value.strip('"').strip("'")
    if not value or value.startswith("-----BEGIN"):
        return value
    try:
        return base64.b64decode(value).decode("utf-8")
    except Exception:
        return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"
    JWT_PRIVATE_KEY: str = ""
    JWT_PUBLIC_KEY: str = ""
    ENCRYPTION_KEY: str = ""
    RESEND_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ENVIRONMENT: str = "development"
    ENABLE_SCHEDULER: bool = True

    def get_jwt_private(self) -> str:
        return _decode_pem(self.JWT_PRIVATE_KEY)

    def get_jwt_public(self) -> str:
        return _decode_pem(self.JWT_PUBLIC_KEY)


settings = Settings()