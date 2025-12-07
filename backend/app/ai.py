import requests
import json

OLLAMA_URL = "http://ollama:11434/api/generate"
MODEL_NAME = "llama3"

def generate_match_commentary(context_text: str):
    """
    Sends match stats to Ollama and gets a professional analysis.
    """
    prompt = f"""
    You are a professional Premier League football analyst. 
    Analyze the following match data and prediction:
    
    {context_text}
    
    Write match preview that will contain exact score of the match, who will score first and who will get more cards. 
    Explain why the predicted winner is favored based on the form.
    Do not mention 'algorithm' or 'confidence score' explicitly.
    """

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        return response.json().get("response", "Error generation analysis.")
    except Exception as e:
        print(f"Ollama Error: {e}")
        return None