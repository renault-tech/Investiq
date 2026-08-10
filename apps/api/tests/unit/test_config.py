"""Unit: Settings.cookie_samesite — the refresh_token cookie's SameSite
attribute must flip to "none" in production, where apps/web and apps/api
are two separate Vercel projects (different sites for cookie purposes).
SameSite=Lax cross-site cookies are dropped on the axios POST /auth/refresh
call, so every page reload silently loses the session and bounces to
/login — this is what actually broke and what this locks in."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from src.config import Settings


def _settings(**overrides) -> Settings:
    return Settings(DATABASE_URL="postgresql://x", **overrides)


def test_local_dev_keeps_lax_samesite(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    settings = _settings(ENVIRONMENT="development")
    assert settings.is_https_deploy is False
    assert settings.cookie_samesite == "lax"


def test_vercel_deploy_switches_to_none_samesite(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    settings = _settings(ENVIRONMENT="development")
    assert settings.is_https_deploy is True
    assert settings.cookie_samesite == "none"


def test_production_environment_switches_to_none_samesite(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    settings = _settings(ENVIRONMENT="production")
    assert settings.is_https_deploy is True
    assert settings.cookie_samesite == "none"
