"""Central de Ações — router (novo módulo)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.actions import service
from src.actions.schemas import ActionCenterResponse

router = APIRouter(prefix="/actions", tags=["actions"])


@router.get("", response_model=ActionCenterResponse)
async def get_action_center(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Inbox único de pendências (contas a vencer/vencidas, faturas em
    revisão, itens sem categoria) priorizado por urgência de prazo e
    impacto financeiro — nada aqui é armazenado, é lido sob demanda."""
    return await service.get_action_center(current_user.id, db)
