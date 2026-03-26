import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from src.database import Base

class PortfolioAnalysis(Base):
    __tablename__ = "portfolio_analyses"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id"), nullable=False, index=True)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    raw_text     = Column(Text, nullable=False)        # markdown completo
    sections     = Column(JSONB, nullable=False)       # {"context": "...", "summary": "...", ...}
    provider     = Column(String(50))                  # "claude" | "openai" | "gemini"
    model        = Column(String(100))
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    portfolio    = relationship("Portfolio", back_populates="analyses")
    messages     = relationship("AnalysisMessage", back_populates="analysis", order_by="AnalysisMessage.created_at")


class AnalysisMessage(Base):
    __tablename__ = "analysis_messages"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("portfolio_analyses.id"), nullable=False, index=True)
    role        = Column(String(20), nullable=False)   # "user" | "assistant"
    content     = Column(Text, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    analysis    = relationship("PortfolioAnalysis", back_populates="messages")
