from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc
from . import models, database, services, analysis, ai

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/table")
def get_league_table(db: Session = Depends(database.get_db)):
    """Zwraca tabelę ligową posortowaną wg punktów"""
    teams = db.query(models.Team).order_by(
        desc(models.Team.points), 
        desc(models.Team.goals_scored - models.Team.goals_conceded)
    ).all()
    return teams

@app.get("/matches")
def get_matches(db: Session = Depends(database.get_db)):
    """Returns upcoming matches with predictions"""
    matches = db.query(models.Match).filter(
        models.Match.status != "FINISHED"
    ).order_by(models.Match.date).all()
    
    # Format data nicely for React
    result = []
    for m in matches:
        pred = m.prediction
        result.append({
            "id": m.id,
            "date": m.date,
            "home_team": m.home_team.name,
            "away_team": m.away_team.name,
            "logo_home": m.home_team.logo_url, # (If available)
            "logo_away": m.away_team.logo_url,
            "prediction": {
                "winner": "Draw" if pred and pred.is_draw_prediction else (
                    m.home_team.name if pred and pred.predicted_winner_id == m.home_team_id else m.away_team.name
                ),
                "confidence": int(pred.confidence_score * 100) if pred else 0,
                "ai_text": pred.ai_generated_commentary if pred else None
            } if pred else None
        })
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
        return {"status": "generated", "text": commentary}
    
    return {"status": "cached", "text": pred.ai_generated_commentary}

# --- ADMIN ENDPOINTS ---
@app.post("/sync-data")
def sync_data(db: Session = Depends(database.get_db)):
    return services.sync_fbref_data(db)

@app.post("/run-algo")
def run_algo(db: Session = Depends(database.get_db)):
    return analysis.generate_predictions(db)