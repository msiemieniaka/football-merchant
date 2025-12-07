# backend/app/analysis.py
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from . import models

def get_recent_form(db: Session, team_id: int, limit: int = 5):
    """
    Calculates the form of a team based on the last 'limit' finished matches.
    Returns a score (3 pts for win, 1 for draw) and a text summary.
    """
    # Fetch last 5 finished matches for this team (home or away)
    matches = db.query(models.Match).filter(
        or_(models.Match.home_team_id == team_id, models.Match.away_team_id == team_id),
        models.Match.status == 'FINISHED'
    ).order_by(desc(models.Match.date)).limit(limit).all()

    points = 0
    summary = []

    for m in matches:
        # Determine if the team was Home or Away
        is_home = m.home_team_id == team_id
        
        # Determine result
        if m.home_score is None or m.away_score is None:
            continue # Skip if data is incomplete

        if m.home_score == m.away_score:
            points += 1
            result = "D" # Draw
        elif is_home and m.home_score > m.away_score:
            points += 3
            result = "W" # Win
        elif not is_home and m.away_score > m.home_score:
            points += 3
            result = "W"
        else:
            points += 0
            result = "L" # Loss
        
        opponent = m.away_team.name if is_home else m.home_team.name
        summary.append(f"{result} vs {opponent} ({m.home_score}-{m.away_score})")

    return {
        "points": points,
        "form_str": ", ".join(summary),
        "matches_played": len(matches)
    }

def generate_predictions(db: Session):
    """
    Finds upcoming matches and generates predictions based on recent form.
    Saves the result to the 'Predictions' table.
    """
    # 1. Get all upcoming matches (Scheduled)
    upcoming_matches = db.query(models.Match).filter(
        models.Match.status == 'TIMED'
    ).all()

    print(f">>> Found {len(upcoming_matches)} upcoming matches to analyze.")
    
    predictions_made = 0

    for match in upcoming_matches:
        # Check if prediction already exists
        existing_pred = db.query(models.Prediction).filter(models.Prediction.match_id == match.id).first()
        if existing_pred:
            continue

        # 2. Analyze Home Team Form
        home_stats = get_recent_form(db, match.home_team_id)
        # 3. Analyze Away Team Form
        away_stats = get_recent_form(db, match.away_team_id)

        # 4. Simple Algorithm Logic
        # Calculate win probability based on form points difference
        total_points = home_stats['points'] + away_stats['points']
        if total_points == 0:
            confidence = 0.5 # No data, pure guess
            winner_id = None # Draw likely
        else:
            # Simple heuristic
            home_strength = home_stats['points']
            away_strength = away_stats['points']
            
            if home_strength > away_strength:
                winner_id = match.home_team_id
                confidence = 0.5 + ((home_strength - away_strength) / 30) # Normalize slightly
            elif away_strength > home_strength:
                winner_id = match.away_team_id
                confidence = 0.5 + ((away_strength - home_strength) / 30)
            else:
                winner_id = None # Predict Draw
                confidence = 0.5

        # Cap confidence at 0.95
        confidence = min(confidence, 0.95)

        # 5. Prepare Rich Context for Ollama (AI)
        # This text will be sent to the LLM later
        analysis_text = (
            f"Match: {match.home_team.name} vs {match.away_team.name}. "
            f"\n{match.home_team.name} Form (Last 5): {home_stats['points']} pts. Details: {home_stats['form_str']}. "
            f"\n{match.away_team.name} Form (Last 5): {away_stats['points']} pts. Details: {away_stats['form_str']}. "
            f"\nAlgorithmic Prediction: {'Draw' if winner_id is None else 'Winner: ' + (match.home_team.name if winner_id == match.home_team_id else match.away_team.name)} "
            f"with {int(confidence * 100)}% confidence."
        )

        # 6. Save to DB
        new_pred = models.Prediction(
            match_id=match.id,
            predicted_winner_id=winner_id,
            is_draw_prediction=(winner_id is None),
            confidence_score=confidence,
            analysis_content=analysis_text
        )
        db.add(new_pred)
        predictions_made += 1

    db.commit()
    return {"status": "success", "predictions_generated": predictions_made}