import os
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, database, services, analysis, ai

# Create database tables on startup
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

@app.on_event("startup")
def startup_event():
    print("--------------------------------")
    print(">> STARTUP: Checking database tables...")
    models.Base.metadata.create_all(bind=database.engine)
    print(">> STARTUP: Tables checked/created.")
    print("--------------------------------")

@app.get("/")
def read_root():
    return {"message": "Football AI Backend is running"}

# --- NEW ENDPOINT ---
@app.post("/update-data")
def update_data(db: Session = Depends(database.get_db)):
    """
    Trigger data update: Fetches fresh data from external API 
    and saves/updates it in the local PostgreSQL database.
    """
    try:
        # Call the function from services.py
        result = services.fetch_and_save_data(db)
        return result
    except Exception as e:
        # Return error if something goes wrong (e.g., API limits, network error)
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/generate-predictions")
def run_predictions(db: Session = Depends(database.get_db)):
    """
    Analyzes upcoming matches and saves predictions based on team form.
    """
    try:
        result = analysis.generate_predictions(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-match-with-ai/{match_id}")
def analyze_match_ai(match_id: int, db: Session = Depends(database.get_db)):
    prediction = db.query(models.Prediction).filter(models.Prediction.match_id == match_id).first()
    
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found. Run /generate-predictions first.")
    
    if not prediction.analysis_content:
        raise HTTPException(status_code=400, detail="No analysis content available.")

    print(f"Sending match {match_id} to Ollama...")
    ai_commentary = ai.generate_match_commentary(prediction.analysis_content)
    
    if ai_commentary:
        prediction.ai_generated_commentary = ai_commentary
        db.commit()
        return {"status": "success", "ai_commentary": ai_commentary}
    else:
        raise HTTPException(status_code=500, detail="Failed to generate AI commentary")