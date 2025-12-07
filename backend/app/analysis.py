from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from . import models

def get_team_form(db: Session, team_id: int, limit: int = 5):
    """Analyzes form based on the last 5 matches."""
    matches = db.query(models.Match).filter(
        or_(models.Match.home_team_id == team_id, models.Match.away_team_id == team_id),
        models.Match.status == 'FINISHED'
    ).order_by(desc(models.Match.date)).limit(limit).all()

    stats = {
        "matches": 0, "points": 0,
        "goals_scored": 0, "goals_conceded": 0,
        "xg_created": 0.0, "xg_conceded": 0.0,
        "results": []
    }

    if not matches: return stats

    for m in matches:
        is_home = m.home_team_id == team_id
        
        gf = m.home_score if is_home else m.away_score
        ga = m.away_score if is_home else m.home_score
        
        xg_f = 0.0; xg_a = 0.0
        if m.stats:
            xg_f = m.stats.home_xg if is_home else m.stats.away_xg or 0.0
            xg_a = m.stats.away_xg if is_home else m.stats.home_xg or 0.0

        if gf > ga:
            stats["points"] += 3; stats["results"].append("W")
        elif gf == ga:
            stats["points"] += 1; stats["results"].append("D")
        else:
            stats["results"].append("L")
            
        stats["matches"] += 1
        stats["goals_scored"] += gf; stats["goals_conceded"] += ga
        stats["xg_created"] += xg_f; stats["xg_conceded"] += xg_a

    return stats

def get_top_players_string(db: Session, team_id: int):
    """NEW: Gets the top 4 players of a team (by goals and xG).
    Used to feed Ollama with real names."""
    players = db.query(models.Player).filter(models.Player.team_id == team_id).all()
    
    if not players:
        return "No player data available."

    # Sort players: First by Goals, then by xG. Take the top 4.
    top_players = sorted(players, key=lambda p: (p.goals, p.xg), reverse=True)[:4]
    
    # Create a string e.g.: "Salah (10G, 5.2xG), Nunez (5G)"
    names_list = []
    for p in top_players:
        stats_part = f"{p.goals} Goals"
        if p.assists > 0: stats_part += f", {p.assists} Assists"
        if p.xg > 0: stats_part += f", {p.xg:.2f} xG"
        names_list.append(f"{p.name} ({stats_part})")
        
    return "; ".join(names_list)

def generate_predictions(db: Session):
    upcoming = db.query(models.Match).filter(
        or_(models.Match.status == 'SCHEDULED', models.Match.status == 'TIMED')
    ).all()

    print(f">>> [ALGO] Generating predictions for {len(upcoming)} matches...")
    count = 0

    for match in upcoming:
        # Delete old prediction to update player data
        db.query(models.Prediction).filter(models.Prediction.match_id == match.id).delete()
        
        home_stats = get_team_form(db, match.home_team_id)
        away_stats = get_team_form(db, match.away_team_id)
        
        if home_stats["matches"] == 0 or away_stats["matches"] == 0: continue

        h_attack = (home_stats["goals_scored"] + home_stats["xg_created"]) / home_stats["matches"]
        a_attack = (away_stats["goals_scored"] + away_stats["xg_created"]) / away_stats["matches"]
        h_defense = (home_stats["goals_conceded"] + home_stats["xg_conceded"]) / home_stats["matches"]
        a_defense = (away_stats["goals_conceded"] + away_stats["xg_conceded"]) / away_stats["matches"]

        home_score = h_attack - a_defense + 0.25 # Home advantage
        away_score = a_attack - h_defense

        diff = home_score - away_score
        winner_id = None; confidence = 0.5; outcome_text = "Draw"

        if diff > 0.35:
            winner_id = match.home_team_id
            confidence = 0.5 + min(diff/3, 0.45)
            outcome_text = f"{match.home_team.name} Win"
        elif diff < -0.35:
            winner_id = match.away_team_id
            confidence = 0.5 + min(abs(diff)/3, 0.45)
            outcome_text = f"{match.away_team.name} Win"
        else:
            outcome_text = "Draw"
            confidence = 0.5 + (0.35 - abs(diff))

        home_squad = get_top_players_string(db, match.home_team_id)
        away_squad = get_top_players_string(db, match.away_team_id)

        analysis_text = (
            f"PREMIER LEAGUE MATCH DATA\n"
            f"Match: {match.home_team.name} vs {match.away_team.name}\n"
            f"Prediction: {outcome_text} (Confidence: {int(confidence*100)}%)\n\n"
            f"=== {match.home_team.name} ===\n"
            f"Recent Form: {', '.join(home_stats['results'])}\n"
            f"Stats (Last 5): {home_stats['goals_scored']} Goals, {home_stats['xg_created']:.2f} xG\n"
            f"KEY PLAYERS (AVAILABLE): {home_squad}\n\n"
            f"=== {match.away_team.name} ===\n"
            f"Recent Form: {', '.join(away_stats['results'])}\n"
            f"Stats (Last 5): {away_stats['goals_scored']} Goals, {away_stats['xg_created']:.2f} xG\n"
            f"KEY PLAYERS (AVAILABLE): {away_squad}\n"
        )

        pred = models.Prediction(
            match_id=match.id,
            predicted_winner_id=winner_id,
            is_draw_prediction=(winner_id is None),
            confidence_score=confidence,
            analysis_content=analysis_text
        )
        db.add(pred)
        count += 1

    db.commit()
    return {"status": "success", "predictions": count}