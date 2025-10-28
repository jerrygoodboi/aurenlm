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

        summary_text = get_local_llm_summary(filtered_text)

        return jsonify({"summary": summary_text, "fullText": filtered_text})



def send_post_request(url, data):
    headers = {'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)
        
        try:
            return response.json()
        except json.JSONDecodeError:
            print("Error: Failed to decode JSON response from the model.")
            print("Response content:")
            print(response.text)
            return None

    except requests.exceptions.RequestException as e:
        error_message = f"Error: Request to the model failed: {e}"
        print(error_message)
        return error_message

def comp(full_prompt_text, temperature=0.7, grammar=""):
    json_request = {
            "n_predict": 2048,
            "temperature": temperature,
            "stop": ["</s>", "AurenLM:", "User:"],
            "repeat_last_n": 256,
            "repeat_penalty": 1.2,
            "top_k": 40,
            "top_p": 0.5,
            "tfs_z": 1,
            "typical_p": 1,
            "presence_penalty": 0,
            "frequency_penalty": 0,
            "mirostat": 0,
            "mirostat_tau": 5,
            "mirostat_eta": 0.1,
            "grammar": grammar,
            "n_probs": 0,
            "image_data": [],
            "cache_prompt": True,
            "slot_id": 0,
            "prompt": full_prompt_text # Use the full_prompt_text directly
            }
    response = send_post_request("http://100.102.173.88:8080/completion", json_request)

    if isinstance(response, str):
        return response # It's an error message

    print(f"LLM Response: {response}")
    if response:
        if "content" in response:
            # Ensure the content is a string. If it's an object, convert it to a string.
            chatbot_response = response["content"]
            if isinstance(chatbot_response, dict) or isinstance(chatbot_response, list):
                return json.dumps(chatbot_response)
            return str(chatbot_response)
        else:
            print("Chatbot: 'content' key not in response from the server.")
            return json.dumps(response)
    else:
        print("Request failed. Check the server or URL.")
    return None # Ensure a return value

def parse_text_to_list(text):
    lines = text.split('\n')
    parsed_list = []
    for line in lines:
        line = line.strip()
        if line.startswith('- ') or line.startswith('* '): # Bullet points
            parsed_list.append(line[2:].strip())
        elif re.match(r'^\d+\.\s', line): # Numbered list
            parsed_list.append(re.sub(r'^\d+\.\s', '', line).strip())
        elif line: # Any non-empty line
            parsed_list.append(line)
    return parsed_list if parsed_list else [text] # Return original text as single item if no list format found

def get_local_llm_summary(text_to_summarize):
    # Construct a prompt for a one-paragraph summary
    summarization_prompt = f"""Provide a detailed summary of the following text. The summary should be a single paragraph, approximately 3 to 5 sentences long, capturing the main ideas and key points.

Text:
{text_to_summarize}
"""
    json_request = {
            "n_predict": 512, # Increased prediction size for a longer summary
            "temperature": 0.7,
            "stop": ["</s>", "AurenLM:", "User:"],
            "repeat_last_n": 256,
            "repeat_penalty": 1.2,
            "top_k": 40,
            "top_p": 0.5,
            "tfs_z": 1,
            "typical_p": 1,
            "presence_penalty": 0,
            "frequency_penalty": 0,
            "mirostat": 0,
            "mirostat_tau": 5,
            "mirostat_eta": 0.1,
            "grammar": "",
            "n_probs": 0,
            "image_data": [],
            "cache_prompt": True,
            "slot_id": 0,
            "prompt": summarization_prompt
            }
    response = send_post_request("http://100.102.173.88:8080/completion", json_request)

    if response and "content" in response:
        return response["content"].strip()
    else:
        return "Sorry, I couldn\'t get a summary from the local LLM."

@app.route("/local_completion", methods=["POST"])
def local_completion():
    data = request.json
    prompt = data.get("prompt", "")
    pdf_content = data.get("pdfContent", "")
    is_first_message = data.get("isFirstMessage", False) # Retrieve the flag

    if not prompt:
        return jsonify({"message": "No prompt provided"}), 400
    
    full_prompt_text = prompt
    if pdf_content and is_first_message: # Only prepend if it's the first message
        full_prompt_text = f"Document Content:\n{pdf_content}\n\n{prompt}"
    
    response_content = comp(full_prompt_text)
    if response_content:
        return jsonify({"content": response_content})
    else:
        return jsonify({"message": "Error getting completion from local LLM"}), 500

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
    summary = comp(summarization_prompt)

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

    mindmap_prompt = f"""Create a hierarchical mindmap from the following document. The output must be a single JSON object with a 'title' and a 'nodes' array. Each node in the array must have an 'id', a 'label', and a 'children' array. Do not include any notes or explanations outside of the JSON object.

Document:
{full_text[:4000]}"""

    mindmap_json = get_gemini_response(mindmap_prompt)

    if mindmap_json:
        print(f"Mindmap JSON from Gemini: {mindmap_json}")
        return jsonify(mindmap_json)
    else:
        return jsonify({"message": "Error generating mind map with Gemini"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
