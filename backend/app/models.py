from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer, unique=True)
    name = Column(String, index=True)
    short_name = Column(String)
    logo_url = Column(String, nullable=True)
    
    # League Table
    matches_played = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    draws = Column(Integer, default=0)
    loses = Column(Integer, default=0)
    goals_scored = Column(Integer, default=0)
    goals_conceded = Column(Integer, default=0)
    points = Column(Integer, default=0)
    position = Column(Integer, default=0)
    
    # Advanced Stats
    xpts = Column(Float, default=0.0)
    xg_for = Column(Float, default=0.0)
    xg_against = Column(Float, default=0.0)

    players = relationship("Player", back_populates="team")

class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer, unique=True)
    name = Column(String)
    position = Column(String) 
    team_id = Column(Integer, ForeignKey("teams.id"))
    
    # --- REDUCED STATS ---
    games = Column(Integer, default=0)
    goals = Column(Integer, default=0)
    assists = Column(Integer, default=0)
    shots = Column(Integer, default=0)
    xg = Column(Float, default=0.0) # Expected Goals
    xa = Column(Float, default=0.0) # Expected Assists
    
    team = relationship("Team", back_populates="players")

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(Integer, unique=True, index=True)
    date = Column(DateTime)
    home_team_id = Column(Integer, ForeignKey("teams.id"))
    away_team_id = Column(Integer, ForeignKey("teams.id"))
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    status = Column(String, default="SCHEDULED")
    
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
    
    prediction = relationship("Prediction", back_populates="match", uselist=False)
    stats = relationship("MatchStat", back_populates="match", uselist=False)

class MatchStat(Base):
    __tablename__ = "match_stats"
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"))
    
    # Only xG (Removed shots and possession)
    home_xg = Column(Float, nullable=True)
    away_xg = Column(Float, nullable=True)

    match = relationship("Match", back_populates="stats")

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"))
    predicted_winner_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    is_draw_prediction = Column(Boolean, default=False)
    confidence_score = Column(Float)
    analysis_content = Column(Text)
    ai_generated_commentary = Column(Text, nullable=True)
    
    match = relationship("Match", back_populates="prediction")