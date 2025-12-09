import requests
import json
import random
from sqlalchemy.orm import Session
from . import models
from datetime import datetime
import time

# --- CONFIGURATION ---
SEASON_YEAR = "2025"
JSON_API_URL = f"https://understat.com/getLeagueData/EPL/{SEASON_YEAR}"
REFERER_URL = f"https://understat.com/league/EPL/{SEASON_YEAR}"

def get_headers():
    """
    Headers pretending to be user.
    """
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"
    ]
    return {
        "User-Agent": random.choice(user_agents),
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Referer": REFERER_URL,
        "X-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
    }

def sync_fbref_data(db: Session):
    """
    Fetches data from Understat using a hidden JSON API.
    """
    print(f">>> [UNDERSTAT API] Fetching: {JSON_API_URL}")
    
    try:
        response = requests.get(JSON_API_URL, headers=get_headers(), timeout=20)
        
        if response.status_code != 200:
            print(f"!!! HTTP Error {response.status_code}")
            print(f"Error content: {response.text[:200]}")
            return {"status": "error", "message": f"API returned {response.status_code}"}
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            print("!!! Error: Response is not valid JSON. Probably a WAF block.")
            return {"status": "error", "message": "Invalid JSON response"}

        matches_data = data.get("dates", [])
        teams_data = data.get("teams", {})
        players_data = data.get("players", [])

        if not matches_data:
            return {"status": "error", "message": "JSON fetched, but 'dates' list is empty."}

        print(f">>> Success! Fetched {len(matches_data)} matches and {len(players_data)} players.")

        team_cache = {} 

        for u_id, t_info in teams_data.items():
            u_id = int(u_id)
            name = t_info['title']
            
            team = db.query(models.Team).filter(models.Team.external_id == u_id).first()
            if not team:
                team = models.Team(
                    external_id=u_id,
                    name=name,
                    short_name=name[:3].upper()
                )
                db.add(team)
                db.commit()
                db.refresh(team)
            
            team.matches_played = 0
            team.wins = 0; team.draws = 0; team.loses = 0
            team.goals_scored = 0; team.goals_conceded = 0
            team.points = 0
            
            team_cache[u_id] = team

        count_new = 0
        count_updated = 0
        
        for m in matches_data:
            try:
                
                u_match_id = int(m['id'])
                date_str = m['datetime']
                match_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                is_finished = m.get('isResult', False)
                status = "FINISHED" if is_finished else "SCHEDULED"

                h_id = int(m['h']['id'])
                a_id = int(m['a']['id'])
                
                home_team = team_cache.get(h_id)
                away_team = team_cache.get(a_id)
                
                if not home_team:
                    ht_name = m['h']['title']
                    home_team = models.Team(external_id=h_id, name=ht_name, short_name=ht_name[:3].upper())
                    db.add(home_team); db.commit(); db.refresh(home_team)
                    team_cache[h_id] = home_team
                    
                if not away_team:
                    at_name = m['a']['title']
                    away_team = models.Team(external_id=a_id, name=at_name, short_name=at_name[:3].upper())
                    db.add(away_team); db.commit(); db.refresh(away_team)
                    team_cache[a_id] = away_team

                goals_h = int(m['goals']['h']) if is_finished else None
                goals_a = int(m['goals']['a']) if is_finished else None
                xg_h = float(m['xG']['h']) if is_finished and m['xG']['h'] is not None else 0.0
                xg_a = float(m['xG']['a']) if is_finished and m['xG']['a'] is not None else 0.0

                if is_finished:
                    home_team.matches_played += 1; away_team.matches_played += 1
                    home_team.goals_scored += goals_h; home_team.goals_conceded += goals_a
                    away_team.goals_scored += goals_a; away_team.goals_conceded += goals_h
                    home_team.xg_for += xg_h; home_team.xg_against += xg_a
                    away_team.xg_for += xg_a; away_team.xg_against += xg_h
                    
                    if goals_h > goals_a:
                        home_team.wins += 1; home_team.points += 3; away_team.loses += 1
                    elif goals_a > goals_h:
                        away_team.wins += 1; away_team.points += 3; home_team.loses += 1
                    else:
                        home_team.draws += 1; home_team.points += 1; away_team.draws += 1; away_team.points += 1

                existing = db.query(models.Match).filter(models.Match.external_id == u_match_id).first()
                
                if not existing:
                    new_match = models.Match(
                        external_id=u_match_id, date=match_date,
                        home_team_id=home_team.id, away_team_id=away_team.id,
                        home_score=goals_h, away_score=goals_a, status=status
                    )
                    db.add(new_match)
                    db.commit()
                    if is_finished:
                        db.add(models.MatchStat(match_id=new_match.id, home_xg=xg_h, away_xg=xg_a))
                    count_new += 1
                else:
                    if is_finished:
                        existing.home_score = goals_h
                        existing.away_score = goals_a
                        existing.status = status
                        stat = db.query(models.MatchStat).filter(models.MatchStat.match_id == existing.id).first()
                        if not stat:
                            db.add(models.MatchStat(match_id=existing.id, home_xg=xg_h, away_xg=xg_a))
                        else:
                            stat.home_xg = xg_h; stat.away_xg = xg_a
                        count_updated += 1
            
            except Exception as e:
                print(f"Skipping match {m.get('id')}: {e}")
                continue
        
        db.commit()

        if players_data:
            print(f">>> Updating {len(players_data)} players...")
            for p in players_data:
                try:
                    t_title = p['team_title']
                    team_id = None
                    
                    for tid, tobj in team_cache.items():
                        if tobj.name == t_title:
                            team_id = tobj.id
                            break
                    
                    if not team_id: continue

                    ext_pid = int(p['id'])
                    player = db.query(models.Player).filter(models.Player.external_id == ext_pid).first()
                    
                    if not player:
                        player = models.Player(
                            external_id=ext_pid, 
                            name=p['player_name'], 
                            team_id=team_id, 
                            position=p.get('position', 'Unknown')
                        )
                        db.add(player)
                    
                    player.games = int(p['games'])
                    player.goals = int(p['goals'])
                    player.assists = int(p['assists'])
                    player.shots = int(p['shots'])
                    player.xg = float(p['xG'])
                    player.xa = float(p['xA'])
                    
                except Exception: continue
            db.commit()

        return {"status": "success", "processed": count_new + count_updated}

    except Exception as e:
        print(f"!!! CRITICAL: {e}")
        return {"status": "error", "message": str(e)}

def update_team_logos(db):
    print(">>> Updating logos...")
    LOGO_MAP = {
        "Arsenal": "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg",
        "Aston Villa": "https://crests.football-data.org/58.svg",
        "Bournemouth": "https://upload.wikimedia.org/wikipedia/en/e/e5/AFC_Bournemouth_%282013%29.svg",
        "Brentford": "https://upload.wikimedia.org/wikipedia/en/2/2a/Brentford_FC_crest.svg",
        "Brighton": "https://crests.football-data.org/397.svg",
        "Burnley": "https://crests.football-data.org/328.svg",
        "Chelsea": "https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg",
        "Crystal Palace": "https://crests.football-data.org/354.svg",
        "Everton": "https://upload.wikimedia.org/wikipedia/en/7/7c/Everton_FC_logo.svg",
        "Fulham": "https://crests.football-data.org/63.svg",
        "Ipswich": "https://upload.wikimedia.org/wikipedia/en/4/43/Ipswich_Town.svg",
        "Leicester": "https://upload.wikimedia.org/wikipedia/en/2/2d/Leicester_City_crest.svg",
        "Leeds": "https://crests.football-data.org/341.svg",
        "Liverpool": "https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg",
        "Manchester City": "https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg",
        "Manchester United": "https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg",
        "Newcastle United": "https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg",
        "Nottingham Forest": "https://upload.wikimedia.org/wikipedia/en/e/e5/Nottingham_Forest_F.C._logo.svg",
        "Southampton": "https://upload.wikimedia.org/wikipedia/en/c/c9/FC_Southampton.svg",
        "Sunderland": "https://crests.football-data.org/71.svg",
        "Tottenham": "https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg",
        "West Ham": "https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg",
        "Wolverhampton Wanderers": "https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg",
        "Wolves": "https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg"
    }
    count = 0
    teams = db.query(models.Team).all()
    for team in teams:
        for key, url in LOGO_MAP.items():
            if key in team.name:
                team.logo_url = url
                count += 1
                break
    db.commit()
    return {"status": "success", "logos_updated": count}
