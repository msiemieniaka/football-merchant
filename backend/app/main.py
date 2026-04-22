from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc
from . import models, database, services, analysis, ai, cache

models.Base.metadata.create_all(bind=database.engine)

import os
ROOT_PATH = os.getenv("ROOT_PATH", "/api")

app = FastAPI(
    title="Football AI API",
    root_path=ROOT_PATH,
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Football AI Backend is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/cache-stats")
def get_cache_stats():
    """Returns cache statistics"""
    return cache.get_cache_stats()


@app.get("/table")
def get_league_table(db: Session = Depends(database.get_db)):
    """Returns the league table sorted by points (cached for 5 min)"""
    # Try to get from cache first
    cache_key = "table:all"
    cached_data = cache.get_cache(cache_key)
    if cached_data is not None:
        return cached_data
    
    # Cache miss - query database
    teams = db.query(models.Team).order_by(
        desc(models.Team.points), 
        desc(models.Team.goals_scored - models.Team.goals_conceded)
    ).all()
    
    # Convert to dict for JSON serialization
    result = []
    for team in teams:
        result.append({
            "id": team.id,
            "name": team.name,
            "logo_url": team.logo_url,
            "matches_played": team.matches_played,
            "wins": team.wins,
            "draws": team.draws,
            "loses": team.loses,
            "goals_scored": team.goals_scored,
            "goals_conceded": team.goals_conceded,
            "points": team.points
        })
    
    # Store in cache
    cache.set_cache(cache_key, result)
    
    return result

@app.get("/matches")
def get_matches(db: Session = Depends(database.get_db)):
    """Returns upcoming matches with predictions (cached for 5 min)"""
    # Try to get from cache first
    cache_key = "matches:upcoming"
    cached_data = cache.get_cache(cache_key)
    if cached_data is not None:
        return cached_data
    
    # Cache miss - query database
    matches = db.query(models.Match).filter(
        models.Match.status != "FINISHED"
    ).order_by(models.Match.date).limit(10).all()
    
    # Format data nicely for React
    result = []
    for m in matches:
        pred = m.prediction
        result.append({
            "id": m.id,
            "date": m.date,
            "home_team": m.home_team.name,
            "away_team": m.away_team.name,
            "logo_home": m.home_team.logo_url,
            "logo_away": m.away_team.logo_url,
            "prediction": {
                "winner": "Draw" if pred and pred.is_draw_prediction else (
                    m.home_team.name if pred and pred.predicted_winner_id == m.home_team_id else m.away_team.name
                ),
                "confidence": int(pred.confidence_score * 100) if pred else 0,
                "ai_text": pred.ai_generated_commentary if pred else None,
                "analysis_content": pred.analysis_content if pred else None
            } if pred else None
        })
    
    # Store in cache
    cache.set_cache(cache_key, result)
    
    return result

@app.get("/matches/{match_id}")
def get_match(match_id: int, db: Session = Depends(database.get_db)):
    """Returns detailed data for a single match (cached for 5 min)"""
    # Try to get from cache first
    cache_key = f"matches:detail:{match_id}"
    cached_data = cache.get_cache(cache_key)
    if cached_data is not None:
        return cached_data
    
    # Cache miss - query database
    m = db.query(models.Match).filter(models.Match.id == match_id).first()
    
    if not m:
        raise HTTPException(404, "Match not found")
    
    pred = m.prediction
    result = {
        "id": m.id,
        "date": m.date,
        "home_team": m.home_team.name,
        "away_team": m.away_team.name,
        "logo_home": m.home_team.logo_url,
        "logo_away": m.away_team.logo_url,
        "prediction": {
            "winner": "Draw" if pred and pred.is_draw_prediction else (
                m.home_team.name if pred and pred.predicted_winner_id == m.home_team_id else m.away_team.name
            ),
            "confidence": int(pred.confidence_score * 100) if pred else 0,
            "ai_text": pred.ai_generated_commentary if pred else None,
            "analysis_content": pred.analysis_content if pred else None
        } if pred else None
    }
    
    # Store in cache
    cache.set_cache(cache_key, result)
    
    return result

@app.post("/analyze/{match_id}")
def analyze_match(match_id: int, db: Session = Depends(database.get_db)):
    """Forces AI analysis for a specific match"""
    # 1. Check if there is an algorithmic prediction
    pred = db.query(models.Prediction).filter(models.Prediction.match_id == match_id).first()
    if not pred:
        # If not, generate it (simplified call)
        analysis.generate_predictions(db)
        pred = db.query(models.Prediction).filter(models.Prediction.match_id == match_id).first()
    
    if not pred:
        raise HTTPException(404, "Failed to generate prediction")

    # 2. Generate AI text
    if not pred.ai_generated_commentary:
        commentary = ai.generate_match_commentary(pred.analysis_content)
        pred.ai_generated_commentary = commentary
        db.commit()
        
        # Invalidate cache for this match
        cache.delete_cache(f"matches:detail:{match_id}")
        cache.delete_cache("matches:upcoming")
        
        return {"status": "generated", "text": commentary}
    
    return {"status": "cached", "text": pred.ai_generated_commentary}

# --- ADMIN ENDPOINTS ---
@app.post("/sync-data")
def sync_data(db: Session = Depends(database.get_db)):
    result = services.sync_fbref_data(db)
    # Invalidate all caches after data sync
    cache.invalidate_all_cache()
    return result

@app.post("/run-algo")
def run_algo(db: Session = Depends(database.get_db)):
    result = analysis.generate_predictions(db)
    # Invalidate matches cache after predictions update
    cache.invalidate_matches_cache()
    return result

@app.post("/update-logos")
def update_logos_endpoint(db: Session = Depends(database.get_db)):
    result = services.update_team_logos(db)
    # Invalidate table cache after logos update
    cache.invalidate_table_cache()
    return result

@app.post("/invalidate-cache")
def invalidate_cache():
    """Admin endpoint to manually invalidate all cache"""
    deleted = cache.invalidate_all_cache()
    return {"status": "success", "deleted_keys": deleted}