import requests
import os
from sqlalchemy.orm import Session
from . import models
from datetime import datetime

# Premier League ID in football-data.org is usually 2021
LEAGUE_ID = 2021
API_URL = "https://api.football-data.org/v4"

def get_headers():
    """
    Retrieves the API key from environment variables and constructs the headers.
    """
    api_key = os.getenv("FOOTBALL_DATA_ORG_KEY")
    if not api_key:
        raise Exception("API Key missing in .env file!")
    return {"X-Auth-Token": api_key}

def fetch_and_save_data(db: Session):
    """
    Fetches teams and matches from the external API and saves them to the local database.
    It handles duplicates by checking if the external_id already exists.
    """
    headers = get_headers()
    
    # --- STEP 1: Fetch Teams ---
    print(f">>> 1. Fetching TEAMS for league {LEAGUE_ID}...")
    response = requests.get(f"{API_URL}/competitions/{LEAGUE_ID}/teams", headers=headers)
    data = response.json()
    
    if "teams" not in data:
        print("API Error (Teams):", data)
        return {"status": "error", "message": "Failed to fetch teams"}

    # Helper dictionary to map external API IDs to our local DB IDs
    # Structure: { external_id: local_db_id }
    team_map = {} 

    for item in data["teams"]:
        # Check if team already exists in DB
        existing_team = db.query(models.Team).filter(models.Team.external_id == item["id"]).first()
        
        if not existing_team:
            new_team = models.Team(
                external_id=item["id"],
                name=item["name"],
                short_name=item["shortName"],
                logo_url=item["crest"]
            )
            db.add(new_team)
            db.commit()
            db.refresh(new_team)
            team_map[item["id"]] = new_team.id
        else:
            team_map[item["id"]] = existing_team.id
    
    print(f">>> Saved/Updated {len(team_map)} teams.")

    # --- STEP 2: Fetch Matches ---
    print(f">>> 2. Fetching MATCHES for league {LEAGUE_ID}...")
    response = requests.get(f"{API_URL}/competitions/{LEAGUE_ID}/matches", headers=headers)
    match_data = response.json()

    if "matches" not in match_data:
        print("API Error (Matches):", match_data)
        return {"status": "error", "message": "Failed to fetch matches"}

    count = 0
    updated_count = 0
    
    for m in match_data["matches"]:
        # Map external team IDs to local DB IDs using the map created above
        home_id = team_map.get(m["homeTeam"]["id"])
        away_id = team_map.get(m["awayTeam"]["id"])

        if home_id and away_id:
            # Convert date from ISO format (e.g., '2023-08-11T19:00:00Z') to Python datetime
            match_date = datetime.strptime(m["utcDate"], "%Y-%m-%dT%H:%M:%SZ")
            
            # Check if match already exists
            existing_match = db.query(models.Match).filter(models.Match.external_id == m["id"]).first()

            # Handle scores safely (API might return None if match hasn't started)
            home_score = m["score"]["fullTime"]["home"]
            away_score = m["score"]["fullTime"]["away"]

            if not existing_match:
                # Create new match record
                new_match = models.Match(
                    external_id=m["id"],
                    date=match_date,
                    home_team_id=home_id,
                    away_team_id=away_id,
                    home_score=home_score,
                    away_score=away_score,
                    status=m["status"]
                )
                db.add(new_match)
                count += 1
            else:
                # Update existing match (e.g., update score or status)
                existing_match.home_score = home_score
                existing_match.away_score = away_score
                existing_match.status = m["status"]
                updated_count += 1
    
    db.commit()
    print(f">>> Added {count} new matches and updated {updated_count} existing matches.")
    
    return {
        "status": "success", 
        "teams_count": len(team_map), 
        "new_matches_added": count,
        "matches_updated": updated_count
    }