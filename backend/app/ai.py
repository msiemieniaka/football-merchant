import requests
import json

OLLAMA_URL = "http://ollama:11434/api/generate"
MODEL_NAME = "llama3" 

def generate_match_commentary(context_text: str):
    prompt = f"""
    You are a professional football analyst covering the Premier League.
    Write a match preview based STRICTLY on the provided data.
    Predict the exact score of the match.
    Predict which team will score first and how many cards will be given, and to whom.

    DATA:
    {context_text}

    RULES:
    1. **ONLY mention players listed in the "KEY PLAYERS" section.** Do NOT invent players or mention old players not listed here.
    2. Mention xG (Expected Goals) to justify the form.
    3. Explain why the predicted outcome is likely.
    
    OUTPUT FORMAT:
    You MUST start your response with these two lines (replace Team A with the actual team name you predict to win, and X-Y with home team score - away team score):
    Predicted Winner: Team A
    Predicted Score: X - Y
    
    Then provide the full match preview and analysis.
    """

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        return response.json().get("response", "Error generating analysis.")
    except Exception as e:
        print(f"Ollama Error: {e}")
        return None