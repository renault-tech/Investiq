"""Transactional email via Resend. Degrades to a no-op log line when
RESEND_API_KEY isn't configured, so the app never crashes for lack of it —
callers (e.g. forgot-password) already treat delivery as best-effort.
"""
import logging

import resend

from src.config import settings

logger = logging.getLogger(__name__)

# Resend's shared sandbox sender — works without verifying a custom domain.
# Swap for a verified "no-reply@yourdomain" once one exists.
FROM_ADDRESS = "InvestIQ <onboarding@resend.dev>"


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured — skipping password reset email to %s", to_email)
        return

    resend.api_key = settings.RESEND_API_KEY
    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": "Redefinir sua senha — InvestIQ",
            "html": f"""
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                  <h2 style="color:#0A192F">Redefinir senha</h2>
                  <p>Recebemos um pedido para redefinir a senha da sua conta InvestIQ.
                  Se foi você, clique no botão abaixo — o link expira em 1 hora.</p>
                  <p style="margin:24px 0">
                    <a href="{reset_url}"
                       style="background:#0A192F;color:#fff;padding:12px 20px;
                              border-radius:8px;text-decoration:none;font-weight:600">
                      Redefinir senha
                    </a>
                  </p>
                  <p style="color:#64748B;font-size:13px">
                    Se você não pediu isso, pode ignorar este e-mail com segurança —
                    sua senha continua a mesma.
                  </p>
                </div>
            """,
        })
    except Exception:
        # Best-effort by design (mirrors create_password_reset_token's own
        # silence about whether the account exists) — never let a failed
        # send surface to the client or block the request.
        logger.exception("Failed to send password reset email")
