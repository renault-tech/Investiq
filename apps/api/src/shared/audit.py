import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession


async def write_audit_log(
    db: AsyncSession,
    user_id: uuid.UUID | None,
    action: str,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    payload: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> None:
    """Write an audit log entry. Silent on failure to avoid breaking main operations."""
    try:
        from sqlalchemy import text
        await db.execute(
            text(
                "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, payload, ip_address, created_at) "
                "VALUES (:id, :user_id, :action, :entity_type, :entity_id, :payload, :ip_address, :created_at)"
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": str(user_id) if user_id else None,
                "action": action,
                "entity_type": entity_type,
                "entity_id": str(entity_id) if entity_id else None,
                "payload": str(payload) if payload else None,
                "ip_address": ip_address,
                "created_at": datetime.now(timezone.utc),
            },
        )
    except Exception:
        pass  # Audit failures must not break business operations
