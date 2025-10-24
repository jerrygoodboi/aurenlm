import os
import requests
import pdfplumber
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from config import GEMINI_API_URL
import json
import re

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def get_gemini_response(prompt):
    headers = {"Content-Type": "application/json"}
    data = {"contents": [{"parts": [{"text": prompt}]}]}
    response = requests.post(GEMINI_API_URL, headers=headers, json=data)

    if response.status_code == 200:
        try:
            # Attempt to parse the response as JSON
            gemini_response_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            # Gemini sometimes wraps JSON in markdown code blocks, so try to extract it
            if gemini_response_text.startswith("```json") and gemini_response_text.endswith("```"):
                json_string = gemini_response_text[7:-3].strip()
            else:
                json_string = gemini_response_text.strip()
            
            return json.loads(json_string)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error parsing Gemini response as JSON: {e}")
            print(f"Raw Gemini response: {gemini_response_text}")
            # Fallback to returning raw text as a list with one item
            return [gemini_response_text]
    else:
        print(f"Gemini API Error: Status Code {response.status_code}")
        print(f"Response Body: {response.text}")
        return ["Sorry, I couldn't process that request. Check backend logs for details."]

def filter_notes_section(text):
    # This is a placeholder. The actual regex might need to be more sophisticated
    # based on how "notes section" appears in the PDFs.
    # Example: Remove text between "Notes" and the end of the document or next major heading.
    # For now, a simple removal of lines starting with "Note" or "Notes"
    lines = text.split('\n')
    filtered_lines = [line for line in lines if not re.match(r'^(Note|Notes)[:\s].*', line, re.IGNORECASE)]
    return '\n'.join(filtered_lines)

@app.route("/upload", methods=["POST"])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"message": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "No selected file"}), 400
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        text = ""
        if filename.lower().endswith('.pdf'):
            with pdfplumber.open(filepath) as pdf:
                text = '\n'.join(page.extract_text() for page in pdf.pages)
        else:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()

        os.remove(filepath) # clean up

        filtered_text = filter_notes_section(text)

        prompt = f"""Please extract the main points from the following text and return them as a JSON array of strings. Each string in the array should be a main point.

Text:
{filtered_text}
"""

        summary = get_gemini_response(prompt)

        return jsonify({"summary": summary, "fullText": filtered_text})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
