import uuid
from sqlalchemy import Column, String, Integer, LargeBinary, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.sql import func

from src.database import Base


class GeneratedReport(Base):
    """Um relatório já gerado e baixado, guardado para reaparecer depois em
    'Relatórios gerados' sem precisar recalcular tudo de novo — antes desta
    tabela, a lista de documentos na tela era só um calendário fixo dos
    últimos 6 meses que nunca refletia o que o usuário de fato tinha gerado."""
    __tablename__ = "generated_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    report_type = Column(String(40), nullable=False)
    format = Column(String(10), nullable=False)
    params = Column(JSONB, nullable=False, server_default="{}")
    file_name = Column(String(200), nullable=False)
    file_content = Column(LargeBinary, nullable=False)
    file_size = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
