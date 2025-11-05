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
    print(f"Sending prompt to Gemini: {prompt[:200]}...") # Log first 200 chars of prompt
    headers = {"Content-Type": "application/json"}
    data = {"contents": [{"parts": [{"text": prompt}]}]}
    response = requests.post(GEMINI_API_URL, headers=headers, json=data)

    print(f"Raw Gemini API response status: {response.status_code}")
    print(f"Raw Gemini API response body: {response.text[:500]}...") # Log first 500 chars of response

    if response.status_code == 200:
        try:
            json_response = response.json()
            text_content = json_response["candidates"][0]["content"]["parts"][0]["text"]
            print(f"Parsed Gemini response text: {text_content[:200]}...")
            return {"text": text_content}
        except json.JSONDecodeError:
            print(f"Gemini response is not JSON. Returning raw text as error.")
            print(f"Raw Gemini response: {response.text}")
            return {"error": "Gemini response was not valid JSON", "raw_response": response.text}
        except (KeyError, IndexError) as e:
            print(f"Error parsing Gemini response: {e}")
            print(f"Raw Gemini response: {response.text}")
            return {"error": f"Error parsing Gemini response: {e}", "raw_response": response.text}
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

        try:
            filtered_text = filter_notes_section(text)
        except Exception as e:
            print(f"Error filtering notes section: {e}")
            return jsonify({"message": "Error processing document", "details": str(e)}), 500

        summarization_prompt = f"""Provide a detailed summary of the following text. The summary should be a single paragraph, approximately 3 to 5 sentences long, capturing the main ideas and key points.

Text:
{filtered_text}
"""
        summary_response = get_gemini_response(summarization_prompt)

        print(f"Summary response from get_gemini_response: {summary_response}")

        if "error" in summary_response:
            return jsonify({"message": "Error generating summary", "details": summary_response["error"]}), 500

        summary_text = summary_response["text"]

        return jsonify({"summary": summary_text, "fullText": filtered_text})

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

@app.route("/gemini_completion", methods=["POST"])
def gemini_completion():
    data = request.json
    prompt = data.get("prompt", "")
    pdf_content = data.get("pdfContent", "")
    is_first_message = data.get("isFirstMessage", False) # Retrieve the flag

    if not prompt:
        return jsonify({"message": "No prompt provided"}), 400
    
    full_prompt_text = prompt
    if pdf_content: # Always prepend if pdf_content exists
        full_prompt_text = f"Document Content:\n{pdf_content}\n\n{prompt}"
    
    gemini_response = get_gemini_response(full_prompt_text)
    if "error" in gemini_response:
        return jsonify({"message": "Error getting completion from Gemini API", "details": gemini_response["error"]}), 500
    else:
        return jsonify({"content": gemini_response["text"]})

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
    summary_response = get_gemini_response(summarization_prompt)

    if "error" in summary_response:
        return jsonify({"message": "Error summarizing conversation", "details": summary_response["error"]}), 500
    else:
        return jsonify({"summary": summary_response["text"]})

@app.route("/generate-mindmap", methods=["POST"])
def generate_mindmap():
    data = request.json
    full_text = data.get("fullText", "")

    if not full_text:
        return jsonify({"message": "No text provided for mind map generation"}), 400

    mindmap_prompt = f"""Generate a hierarchical mindmap from the following document. Your response MUST be a single JSON object, and ONLY the JSON object. The JSON object must have a 'title' key and a 'nodes' array. Each node in the 'nodes' array must have an 'id', a 'label', and a 'children' array. The 'children' array should contain nested nodes following the same structure. Ensure the JSON is perfectly formed and contains no other text or markdown outside of the JSON object.

Document:
{full_text[:1000]}"""

    mindmap_response = get_gemini_response(mindmap_prompt)

    if "error" in mindmap_response:
        return jsonify({"message": "Error generating mind map", "details": mindmap_response["error"]}), 500

    mindmap_content = mindmap_response["text"]

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

if __name__ == "__main__":
    app.run(debug=True, port=5000)
