from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer, unique=True)  # ID from the external API (e.g., football-data.org)
    name = Column(String, index=True)
    short_name = Column(String)
    logo_url = Column(String, nullable=True)

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer, unique=True, index=True)
    
    date = Column(DateTime)
    
    home_team_id = Column(Integer, ForeignKey("teams.id"))
    away_team_id = Column(Integer, ForeignKey("teams.id"))
    
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])

    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    
    status = Column(String, default="SCHEDULED")
    
    prediction = relationship("Prediction", back_populates="match", uselist=False)

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"))
    
    # Simple algorithm output
    predicted_winner_id = Column(Integer, ForeignKey("teams.id"), nullable=True) # Can be Null if Draw predicted
    is_draw_prediction = Column(Boolean, default=False)
    confidence_score = Column(Float) # e.g. 0.75 for 75%
    
    # AI (Ollama) generated text
    analysis_content = Column(Text)
    
    ai_generated_commentary = Column(Text, nullable=True)
    
    match = relationship("Match", back_populates="prediction")