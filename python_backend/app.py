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

        summary = get_local_llm_summary(filtered_text)

        return jsonify({"summary": summary, "fullText": filtered_text})



def send_post_request(url, data):
    headers = {'Content-Type': 'application/json'}
    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Request failed with status code: {response.status_code}")
        print("Response content:")
        print(response.text)
        return None

def comp(full_prompt_text):
    json_request = {
            "n_predict": 50,
            "temperature": 0.7,
            "stop": ["</s>", "remmacs:", "User:"],
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
            "prompt": full_prompt_text # Use the full_prompt_text directly
            }
    response = send_post_request("http://127.0.0.1:8080/completion", json_request)

    if response:
        if "content" in response:
            # Ensure the content is a string. If it's an object, convert it to a string.
            chatbot_response = response["content"]
            if isinstance(chatbot_response, dict) or isinstance(chatbot_response, list):
                return json.dumps(chatbot_response)
            return str(chatbot_response)
        else:
            print("Chatbot: No response from the server.")
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
    # Construct a prompt for summarization
    summarization_prompt = f"""Please extract the main points from the following text and return them as a JSON array of strings. Each string in the array should be a main point.

Text:
{text_to_summarize}
"""
    json_request = {
            "n_predict": 50, # Adjust as needed
            "temperature": 0.7,
            "stop": ["</s>", "remmacs:", "User:"],
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
    response = send_post_request("http://127.0.0.1:8080/completion", json_request)

    if response and "content" in response:
        try:
            # Attempt to parse the response as JSON
            llm_response_text = response["content"]
            if llm_response_text.startswith("```json") and llm_response_text.endswith("```"):
                json_string = llm_response_text[7:-3].strip()
            else:
                json_string = llm_response_text.strip()
            
            return json.loads(json_string)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error parsing local LLM response as JSON: {e}")
            print(f"Raw local LLM response: {llm_response_text}")
            # Fallback to parsing common list formats
            return parse_text_to_list(llm_response_text)
    else:
        return ["Sorry, I couldn\'t get a summary from the local LLM."]

@app.route("/local_completion", methods=["POST"])
def local_completion():
    data = request.json
    prompt = data.get("prompt", "")
    pdf_content = data.get("pdfContent", "")
    if not prompt:
        return jsonify({"message": "No prompt provided"}), 400
    
    full_prompt_text = prompt
    if pdf_content:
        full_prompt_text = f"Document Content:\n{pdf_content}\n\n{prompt}"
    
    response_content = comp(full_prompt_text)
    print(f"Type of response_content from comp: {type(response_content)}")
    print(f"Value of response_content from comp: {response_content}")
    if response_content:
        return jsonify({"content": response_content})
    else:
        return jsonify({"message": "Error getting completion from local LLM"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
