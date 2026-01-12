import os
import requests
import pdfplumber
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from config import MISTRAL_API_KEY, MISTRAL_API_URL
import json
import re

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def get_mistral_completion(prompt, model="mistral-tiny"):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {MISTRAL_API_KEY}"
    }
    data = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    response = requests.post(MISTRAL_API_URL, headers=headers, json=data)

    if response.status_code == 200:
        try:
            return response.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            print(f"Error parsing Mistral response as JSON: {e}")
            mistral_response_text = response.text
            print(f"Raw Mistral response: {mistral_response_text}")
            return {"error": f"Error parsing Mistral response: {e}", "raw_response": mistral_response_text}
    else:
        print(f"Mistral API Error: Status Code {response.status_code}")
        print(f"Response Body: {response.text}")
        return {"error": f"Mistral API Error: Status Code {response.status_code}", "response_body": response.text}

def get_mistral_json_response(prompt, model="mistral-tiny"):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {MISTRAL_API_KEY}"
    }
    data = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant that responds in JSON."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    response = requests.post(MISTRAL_API_URL, headers=headers, json=data)

    if response.status_code == 200:
        try:
            mistral_response_text = response.json()["choices"][0]["message"]["content"]
            # Mistral sometimes wraps JSON in markdown code blocks, so try to extract it
            if mistral_response_text.startswith("```json") and mistral_response_text.endswith("```"):
                json_string = mistral_response_text[7:-3].strip()
            else:
                json_string = mistral_response_text.strip()
            
            if json_string:
                return json.loads(json_string)
            else:
                return {"error": "Empty response from Mistral API"}
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            print(f"Error parsing Mistral response as JSON: {e}")
            mistral_response_text = response.text
            print(f"Raw Mistral response: {mistral_response_text}")
            return {"error": f"Error parsing Mistral response: {e}", "raw_response": mistral_response_text}
    else:
        print(f"Mistral API Error: Status Code {response.status_code}")
        print(f"Response Body: {response.text}")
        return {"error": f"Mistral API Error: Status Code {response.status_code}", "response_body": response.text}

def filter_notes_section(text):
    # This is a placeholder. The actual regex might need to be more sophisticated
    # based on how "notes section" appears in the PDFs.
    # Example: Remove text between "Notes" and the end of the document or next major heading.
    # For now, a simple removal of lines starting with "Note" or "Notes"
    lines = text.split('\n')
    filtered_lines = [line for line in lines if not re.match(r'^(Note|Notes)[:\s].*', line, re.IGNORECASE)]
    return '\n'.join(filtered_lines)

@app.route("/upload", methods=["POST", "OPTIONS"])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"message": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "No selected file"}), 400
    if file:
        try:
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

            summarization_prompt = f"""Provide a detailed summary of the following text. The summary should be a single paragraph, approximately 3 to 5 sentences long, capturing the main ideas and key points.

Text:
{filtered_text}
"""
            summary_text = get_mistral_completion(summarization_prompt)

            if isinstance(summary_text, dict) and 'error' in summary_text:
                return jsonify(summary_text), 500

            return jsonify({"summary": summary_text, "fullText": filtered_text})
        except Exception as e:
            return jsonify({"message": f"An error occurred: {e}"}), 500


@app.route("/local_completion", methods=["POST"])
def local_completion():
    data = request.json
    prompt = data.get("prompt", "")
    pdf_content = data.get("pdfContent", "")
    is_first_message = data.get("isFirstMessage", False) # Retrieve the flag

    if not prompt:
        return jsonify({"message": "No prompt provided"}), 400
    
    full_prompt_text = prompt
    if pdf_content: # Always prepend if pdf_content exists
        full_prompt_text = f"Document Content:\n{pdf_content}\n\n{prompt}"
    
    response_content = get_mistral_completion(full_prompt_text)
    if response_content:
        return jsonify({"content": response_content})
    else:
        return jsonify({"message": "Error getting completion from DeepSeek API"}), 500

@app.route("/summarize_conversation", methods=["POST"])
def summarize_conversation():
    data = request.json
    conversation_history = data.get("conversation_history", "")

    if not conversation_history:
        return jsonify({"message": "No conversation history provided"}), 400

    summarization_prompt = f"""Summarize the following conversation history concisely, retaining all key information and context. The summary should be a single paragraph.

Conversation History:
{conversation_history}
"""
    summary = get_mistral_completion(summarization_prompt)

    if summary:
        return jsonify({"summary": summary})
    else:
        return jsonify({"message": "Error summarizing conversation"}), 500

@app.route("/generate-mindmap", methods=["POST"])
def generate_mindmap():
    data = request.json
    full_text = data.get("fullText", "")

    if not full_text:
        return jsonify({"message": "No text provided for mind map generation"}), 400

    mindmap_content = get_mistral_json_response(mindmap_prompt)

    if mindmap_content:
        if isinstance(mindmap_content, str) and mindmap_content.startswith("Error:"):
            return jsonify({"message": mindmap_content}), 500

        print(f"Mindmap content from LLM: {mindmap_content}")
        try:
            # The LLM might return a string that is a JSON object.
            # We need to parse it to make sure it's valid JSON.
            mindmap_json = mindmap_content
            print(f"Mindmap JSON to be returned: {mindmap_json}")
            return jsonify(mindmap_json)
        except json.JSONDecodeError as e:
            print(f"Error decoding mind map JSON: {e}")
            return jsonify({"message": "Error decoding mind map from LLM response"}), 500
    else:
        return jsonify({"message": "Error generating mind map"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
