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
            # Return a JSON object with an error message
            return {"error": f"Error parsing Gemini response: {e}", "raw_response": gemini_response_text}
    else:
        print(f"Gemini API Error: Status Code {response.status_code}")
        print(f"Response Body: {response.text}")
        return {"error": f"Gemini API Error: Status Code {response.status_code}", "response_body": response.text}

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

        # summary_text = get_local_llm_summary(filtered_text) # Commented out for now

        return jsonify({"summary": "Summary generation commented out", "fullText": filtered_text})


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
            "n_predict": 4096,
            "temperature": temperature,
            "stop": ["</s>", "AurenLM:", "User:"],
            "prompt": full_prompt_text,
            "grammar": grammar
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
        return "Sorry, I couldn't get a summary from the local LLM."

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

    json_grammar = r'''
root ::= object
value ::= object | array | string | number | ("true" | "false" | "null")
object ::= "{" ws (string ":" ws value ("," ws string ":" ws value)*)? "}"
array ::= "[" ws (value ("," ws value)*)? "]"
string ::= "\"" ([^"\\\x7F\x00-\x1F] | "\\" ([\"\\/bfnrt] | "u" [0-9a-fA-F]{4}))* "\""
number ::= ("-"? ([0-9] | [1-9] [0-9]*)) ("." [0-9]+)? ([eE] [-+]? [0-9]+)?
ws ::= [ \t\n]*
'''

    mindmap_prompt = f"""Generate a hierarchical mindmap from the following document. Your response MUST be a single JSON object, and ONLY the JSON object. The JSON object must have a 'title' key and a 'nodes' array. Each node in the 'nodes' array must have an 'id', a 'label', and a 'children' array. The 'children' array should contain nested nodes following the same structure. Ensure the JSON is perfectly formed and contains no other text or markdown outside of the JSON object.

Document:
{full_text[:1000]}"""

    mindmap_content = comp(mindmap_prompt, temperature=0.3, grammar=json_grammar)

    if mindmap_content:
        if isinstance(mindmap_content, str) and mindmap_content.startswith("Error:"):
            return jsonify({"message": mindmap_content}), 500

        print(f"Mindmap content from LLM: {mindmap_content}")
        try:
            # The LLM might return a string that is a JSON object.
            # We need to parse it to make sure it's valid JSON.
            if mindmap_content.startswith("```json") and mindmap_content.endswith("```"):
                mindmap_content = mindmap_content[7:-3].strip()
            mindmap_json = json.loads(mindmap_content)
            print(f"Mindmap JSON to be returned: {mindmap_json}")
            return jsonify(mindmap_json)
        except json.JSONDecodeError as e:
            print(f"Error decoding mind map JSON: {e}")
            return jsonify({"message": "Error decoding mind map from LLM response"}), 500
    else:
        return jsonify({"message": "Error generating mind map"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
