import os
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Ensure the API key is set before formatting the URL
if GEMINI_API_KEY:
    GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
else:
    GEMINI_API_URL = None
    print("Warning: GEMINI_API_KEY not found in environment variables.")

SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_here")
