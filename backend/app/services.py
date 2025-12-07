import requests
import re
import json
import codecs
import random
from sqlalchemy.orm import Session
from . import models
from datetime import datetime
import time

# --- CONFIGURATION ---
SEASON_YEAR = "2025"
UNDERSTAT_URL = f"https://understat.com/league/EPL/{SEASON_YEAR}"

def get_headers():
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"
    ]
    return {
        "User-Agent": random.choice(user_agents),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Connection": "keep-alive"
    }

def extract_all_json_data(html_content):
    """Scans HTML for ALL hidden JSON data."""
    data_found = {
        "matches": None, 
        "teams": None,   
        "players": None  
    }
    pattern = re.compile(r"JSON\.parse\('([^']+)'\)")
    blobs = pattern.findall(html_content)

    print(f">>> [SCRAPER] Found {len(blobs)} data blocks.")

    for i, hex_string in enumerate(blobs):
        try:
            decoded = codecs.decode(hex_string, 'unicode_escape')
            json_data = json.loads(decoded)
            
            if isinstance(json_data, list) and len(json_data) > 0:
                first = json_data[0]
                if 'h' in first and 'a' in first and 'goals' in first:
                    data_found["matches"] = json_data
                    continue
                if 'player_name' in first and 'team_title' in first:
                    data_found["players"] = json_data
                    continue

            if isinstance(json_data, dict) and len(json_data) > 0:
                first_key = next(iter(json_data))
                first_val = json_data[first_key]
                if isinstance(first_val, dict) and 'title' in first_val and 'history' in first_val:
                    data_found["teams"] = json_data
                    continue
        except Exception:
            continue
    return data_found

def sync_fbref_data(db: Session):
    print(f">>> [UNDERSTAT] Fetching: {UNDERSTAT_URL}")
    try:
        response = requests.get(UNDERSTAT_URL, headers=get_headers(), timeout=15)
        if response.status_code != 200:
            return {"status": "error", "message": f"HTTP {response.status_code}"}
        
        datasets = extract_all_json_data(response.text)
        matches_data = datasets["matches"]
        teams_data = datasets["teams"]
        players_data = datasets["players"]

        if not matches_data and teams_data:
            print("!!! WARNING: Reconstructing history from team data...")
            matches_data = []
            seen_match_ids = set()
            for t_id, t_info in teams_data.items():
                for h_match in t_info.get('history', []):
                    m_id = int(h_match['id'])
                    if m_id in seen_match_ids: continue
                    matches_data.append({
                        "id": m_id,
                        "datetime": h_match['date'],
                        "isResult": True,
                        "h": {"id": t_id if h_match['h_a'] == 'h' else h_match['h_a'], "title": "Unknown"},
                        "a": {"id": h_match['h_a'] if h_match['h_a'] != 'h' else t_id, "title": "Unknown"},
                        "goals": {"h": h_match['scored'], "a": h_match['missed']} if h_match['h_a'] == 'h' else {"h": h_match['missed'], "a": h_match['scored']},
                        "xG": {"h": h_match['xG'], "a": 0}
                    })
                    seen_match_ids.add(m_id)

        if not matches_data:
            return {"status": "error", "message": "No data found."}

        # Team cache
        team_cache = {}
        def get_or_create_team_by_id(u_id, title=None):
            u_id = int(u_id)
            if u_id in team_cache: return team_cache[u_id]
            if title is None and teams_data and str(u_id) in teams_data:
                title = teams_data[str(u_id)]['title']
            if title is None: title = f"Team {u_id}"
            
            team = db.query(models.Team).filter(models.Team.external_id == u_id).first()
            if not team:
                team = models.Team(external_id=u_id, name=title, short_name=title[:3].upper())
                db.add(team)
                db.commit()
                db.refresh(team)
            
            # Reset stats
            team.matches_played = 0
            team.wins = 0; team.draws = 0; team.loses = 0
            team.goals_scored = 0; team.goals_conceded = 0
            team.points = 0
            team_cache[u_id] = team
            return team

        if teams_data:
            for uid, info in teams_data.items():
                get_or_create_team_by_id(uid, info['title'])

        count_new = 0
        count_updated = 0

        for m in matches_data:
            try:
                h_id = m['h']['id'] if isinstance(m['h'], dict) else m['h']
                a_id = m['a']['id'] if isinstance(m['a'], dict) else m['a']
                h_title = m['h']['title'] if isinstance(m['h'], dict) and 'title' in m['h'] else None
                a_title = m['a']['title'] if isinstance(m['a'], dict) and 'title' in m['a'] else None

                home_team = get_or_create_team_by_id(h_id, h_title)
                away_team = get_or_create_team_by_id(a_id, a_title)

                u_match_id = int(m['id'])
                match_date = datetime.strptime(m['datetime'], "%Y-%m-%d %H:%M:%S")
                is_finished = m.get('isResult', False)
                status = "FINISHED" if is_finished else "SCHEDULED"
                
                goals_h = int(m['goals']['h']) if is_finished else None
                goals_a = int(m['goals']['a']) if is_finished else None
                xg_h = float(m['xG']['h']) if is_finished and 'xG' in m and 'h' in m['xG'] else 0.0
                xg_a = float(m['xG']['a']) if is_finished and 'xG' in m and 'a' in m['xG'] else 0.0

                if is_finished:
                    home_team.matches_played += 1
                    away_team.matches_played += 1
                    home_team.goals_scored += goals_h
                    home_team.goals_conceded += goals_a
                    away_team.goals_scored += goals_a
                    away_team.goals_conceded += goals_h
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
                        stat = models.MatchStat(match_id=new_match.id, home_xg=xg_h, away_xg=xg_a)
                        db.add(stat)
                    count_new += 1
                else:
                    if is_finished:
                        existing.home_score = goals_h
                        existing.away_score = goals_a
                        existing.status = status
                        stat = db.query(models.MatchStat).filter(models.MatchStat.match_id == existing.id).first()
                        if not stat:
                            stat = models.MatchStat(match_id=existing.id, home_xg=xg_h, away_xg=xg_a)
                            db.add(stat)
                        else:
                            stat.home_xg = xg_h; stat.away_xg = xg_a
                        count_updated += 1
            except Exception: continue
        
        db.commit()

        # Update Players (without removed fields)
        if players_data:
            print(f">>> Updating players...")
            for p in players_data:
                try:
                    t_title = p['team_title']
                    team_id = None
                    for tid, team_obj in team_cache.items():
                        if team_obj.name == t_title:
                            team_id = team_obj.id
                            break
                    if not team_id: continue

                    ext_pid = int(p['id'])
                    player = db.query(models.Player).filter(models.Player.external_id == ext_pid).first()
                    
                    if not player:
                        player = models.Player(external_id=ext_pid, name=p['player_name'], team_id=team_id, position=p['position'])
                        db.add(player)
                    
                    player.games = int(p['games'])
                    player.goals = int(p['goals'])
                    player.assists = int(p['assists'])
                    player.shots = int(p['shots'])
                    player.xg = float(p['xG'])
                    player.xa = float(p['xA'])
                    # REMOVED: key_passes, yellow/red cards
                    
                except Exception: continue
            db.commit()

        return {"status": "success", "processed": count_new + count_updated}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def fetch_and_save_data(db): return {"status": "deprecated"}
def fetch_squads_for_teams(db): return {"status": "deprecated"}
def fetch_match_statistics(db, mid): return {"status": "deprecated"}