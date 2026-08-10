import base64
import os

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
    # Shared secret for POST /internal/jobs/run — see src/workers/router.py.
    CRON_SECRET: str = ""

    def get_jwt_private(self) -> str:
        return _decode_pem(self.JWT_PRIVATE_KEY)

    def get_jwt_public(self) -> str:
        return _decode_pem(self.JWT_PUBLIC_KEY)

    @property
    def is_https_deploy(self) -> bool:
        """True on Vercel (always HTTPS) or any deploy with ENVIRONMENT=production
        (e.g. Docker behind a real HTTPS reverse proxy). Used to decide the
        refresh-token cookie's Secure flag — hardcoding True would break
        login on local Docker over plain HTTP, hardcoding False leaves the
        30-day session cookie unprotected in production.
        """
        return bool(os.environ.get("VERCEL")) or self.ENVIRONMENT == "production"

    @property
    def cookie_samesite(self) -> str:
        """web (apps/web) and api (apps/api) deploy as two separate Vercel
        projects on two separate *.vercel.app subdomains — different sites
        for cookie purposes, even under the same custom domain's apex. A
        SameSite=Lax refresh_token cookie is dropped by the browser on the
        cross-site XHR/fetch axios makes to /auth/refresh (Lax only allows
        cross-site cookies on top-level GET navigation), so every page
        reload silently fails to restore the session and bounces to
        /login. SameSite=None (which requires Secure, already true here)
        fixes it in production; local/Docker dev stays same-site "lax".
        """
        return "none" if self.is_https_deploy else "lax"

    @property
    def cors_origin(self) -> str:
        """Trailing slash/whitespace in the Vercel env var UI silently
        mismatches the browser's Origin header (which never has a trailing
        slash), making CORSMiddleware reject every request with no
        Access-Control-Allow-Origin header — indistinguishable from a
        network failure in the browser console.
        """
        return self.FRONTEND_URL.strip().rstrip("/")


settings = Settings()