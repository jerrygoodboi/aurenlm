import os
import requests
import pdfplumber
from flask import Flask, request, jsonify, url_for, redirect, flash
from flask_cors import CORS
from werkzeug.utils import secure_filename
from config import GEMINI_API_URL, SECRET_KEY
import json
import re
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app, supports_credentials=True) # Enable CORS for credentials

app.config['SECRET_KEY'] = SECRET_KEY
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db' # Using SQLite for simplicity
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login' # Specify the login view function

UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# User model
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"User('{self.username}')"

# Chat Session model
class ChatSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    user = db.relationship('User', backref=db.backref('chat_sessions', lazy=True))
    messages = db.relationship('ChatMessage', backref='session', lazy=True, cascade="all, delete-orphan")
    files = db.relationship('UploadedFile', backref='session', lazy=True, cascade="all, delete-orphan")
    mindmap = db.relationship('Mindmap', backref='session', lazy=True, uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"ChatSession('{self.title}', User ID: {self.user_id})"

# Chat Message model
class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id'), nullable=False)
    sender = db.Column(db.String(10), nullable=False) # 'user' or 'gemini'
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())

    def __repr__(self):
        return f"ChatMessage(Session ID: {self.session_id}, Sender: {self.sender})"

# Uploaded File model
class UploadedFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    summary = db.Column(db.Text, nullable=True)
    full_text_content = db.Column(db.Text, nullable=True) # Store full text for context
    uploaded_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def __repr__(self):
        return f"UploadedFile(Session ID: {self.session_id}, Filename: {self.filename})"

# Mindmap model
class Mindmap(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id'), unique=True, nullable=False)
    mindmap_data = db.Column(db.JSON, nullable=False) # Store mindmap as JSON
    generated_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def __repr__(self):
        return f"Mindmap(Session ID: {self.session_id})"

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Create database tables
with app.app_context():
    db.create_all()

# --- Authentication Routes ---
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Username already exists"}), 409

    new_user = User(username=username)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User registered successfully"}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()

    if user and user.check_password(password):
        login_user(user) # Log in the user
        return jsonify({"message": "Login successful", "username": user.username}), 200
    else:
        return jsonify({"message": "Invalid username or password"}), 401

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200

@app.route("/current_user")
def get_current_user():
    if current_user.is_authenticated:
        return jsonify({"username": current_user.username, "id": current_user.id}), 200
    else:
        return jsonify({"username": None}), 200

# --- Chat Session Management Routes ---
@app.route("/sessions", methods=["GET"])
@login_required
def get_sessions():
    sessions = ChatSession.query.filter_by(user_id=current_user.id).order_by(ChatSession.created_at.desc()).all()
    return jsonify([
        {"id": s.id, "title": s.title, "created_at": s.created_at.isoformat()}
        for s in sessions
    ]), 200

@app.route("/sessions", methods=["POST"])
@login_required
def create_session():
    data = request.json
    title = data.get('title', f"New Session {len(current_user.chat_sessions) + 1}")

    new_session = ChatSession(user_id=current_user.id, title=title)
    db.session.add(new_session)
    db.session.commit()
    return jsonify({"message": "Session created", "id": new_session.id, "title": new_session.title}), 201

@app.route("/sessions/<int:session_id>", methods=["GET"])
@login_required
def get_session_data(session_id):
    session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first_or_404()

    messages = ChatMessage.query.filter_by(session_id=session.id).order_by(ChatMessage.timestamp.asc()).all()
    files = UploadedFile.query.filter_by(session_id=session.id).order_by(UploadedFile.uploaded_at.asc()).all()
    mindmap = Mindmap.query.filter_by(session_id=session.id).first()

    return jsonify({
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat(),
        "messages": [
            {"sender": m.sender, "content": m.content, "timestamp": m.timestamp.isoformat()}
            for m in messages
        ],
        "files": [
            {"id": f.id, "filename": f.filename, "summary": f.summary, "fullText": f.full_text_content, "uploaded_at": f.uploaded_at.isoformat()}
            for f in files
        ],
        "mindmap": mindmap.mindmap_data if mindmap else None
    }), 200

@app.route("/sessions/<int:session_id>", methods=["DELETE"])
@login_required
def delete_session(session_id):
    session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first_or_404()
    db.session.delete(session)
    db.session.commit()
    return jsonify({"message": "Session deleted"}), 200

import os
import requests
import pdfplumber
from flask import Flask, request, jsonify, url_for, redirect, flash
from flask_cors import CORS
from werkzeug.utils import secure_filename
from config import GEMINI_API_URL, SECRET_KEY
import json
import re
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
def get_gemini_response(prompt):
    print(f"Sending prompt to Gemini: {prompt[:200]}...") # Log first 200 chars of prompt
    headers = {"Content-Type": "application/json"}
    data = {"contents": [{"parts": [{"text": prompt}]}]}

    print("Attempting to make Gemini API request...")
    try:
        # Use a tuple for timeout: (connect_timeout, read_timeout)
        # This ensures both connection establishment and data reading have timeouts
        response = requests.post(
            GEMINI_API_URL, 
            headers=headers, 
            json=data, 
            timeout=(10, 60),  # 10 seconds to connect, 60 seconds to read response
            verify=True
        )
        print("Gemini API request completed.")
    except requests.exceptions.Timeout as e:
        print(f"Gemini API request timed out: {e}")
        return {"error": "Gemini API request timed out. Please try again."}
    except requests.exceptions.ConnectionError as e:
        print(f"Gemini API connection error: {e}")
        return {"error": "Failed to connect to Gemini API. Please check your connection."}
    except requests.exceptions.RequestException as e:
        print(f"Gemini API request failed: {e}")
        return {"error": f"Gemini API request failed: {e}"}

    print(f"Raw Gemini API response status: {response.status_code}")
    print(f"Raw Gemini API response body: {response.text[:500]}...") # Log first 500 chars of response

    if response.status_code == 200:
        print("Attempting to parse Gemini API response...")
        try:
            json_response = response.json()
            text_content = json_response["candidates"][0]["content"]["parts"][0]["text"]
            print(f"Parsed Gemini response text: {text_content[:200]}...")
            print("Successfully parsed Gemini response.")
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

@app.route("/sessions/<int:session_id>/messages", methods=["POST"])
@login_required
def save_message(session_id):
    session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first_or_404()
    data = request.json
    sender = data.get('sender')
    content = data.get('content')

    if not sender or not content:
        return jsonify({"message": "Sender and content are required"}), 400

    new_message = ChatMessage(session_id=session.id, sender=sender, content=content)
    db.session.add(new_message)
    db.session.commit()
    return jsonify({"message": "Message saved", "id": new_message.id}), 201

@app.route("/upload", methods=["POST"])
@login_required
def upload_file():
    session_id = request.form.get('session_id')
    if not session_id:
        return jsonify({"message": "Session ID is required"}), 400

    session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first_or_404()

    if 'file' not in request.files:
        return jsonify({"message": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "No selected file"}), 400
    if file:
        filename = secure_filename(file.filename)
        print(f"Received file: {filename}")
        # Temporarily save file to process, then delete
        temp_filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(temp_filepath)
        print(f"File temporarily saved to: {temp_filepath}")

        text = ""
        if filename.lower().endswith('.pdf'):
            with pdfplumber.open(temp_filepath) as pdf:
                text = '\n'.join(page.extract_text() for page in pdf.pages)
            print(f"Extracted text from PDF. Length: {len(text)}")
        else:
            with open(temp_filepath, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
            print(f"Extracted text from non-PDF file. Length: {len(text)}")

        os.remove(temp_filepath) # Clean up temporary file
        print(f"Temporary file removed: {temp_filepath}")

        try:
            print(f"Original text length before filtering: {len(text)}")
            filtered_text = filter_notes_section(text)
            print(f"Filtered text length: {len(filtered_text)}")
        except Exception as e:
            print(f"Error filtering notes section: {e}")
            return jsonify({"message": "Error processing document", "details": str(e)}), 500

        summarization_prompt = f"""Provide a detailed summary of the following text. The summary should be a single paragraph, approximately 3 to 5 sentences long, capturing the main ideas and key points.

Text:
{filtered_text}
"""
        print(f"Summarization prompt sent to Gemini (first 500 chars): {summarization_prompt[:500]}...")
        print(f"Full summarization prompt length for upload_file: {len(summarization_prompt)}")
        summary_response = get_gemini_response(summarization_prompt)

        print(f"Summary response from get_gemini_response: {summary_response}")

        if "error" in summary_response:
            return jsonify({"message": "Error generating summary", "details": summary_response["error"]}), 500

        summary_text = summary_response["text"]

        # Save file metadata to database
        new_uploaded_file = UploadedFile(
            session_id=session.id,
            filename=filename,
            summary=summary_text,
            full_text_content=filtered_text
        )
        db.session.add(new_uploaded_file)
        db.session.commit()

        return jsonify({"summary": summary_text, "fullText": filtered_text, "file_id": new_uploaded_file.id})

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
@login_required
def gemini_completion():
    data = request.json
    user_message_text = data.get("message", "")  # Changed from "prompt" to "message" - just the latest user message
    session_id = data.get("session_id")

    if not session_id:
        return jsonify({"message": "Session ID is required"}), 400
    session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first_or_404()

    if not user_message_text:
        return jsonify({"message": "No message provided"}), 400
    
    # Get PDF content from uploaded files in this session (only once, not sent with every request)
    uploaded_files = UploadedFile.query.filter_by(session_id=session.id).all()
    pdf_content = ""
    if uploaded_files:
        # Combine all file texts
        pdf_content = "\n\n".join([f.full_text_content for f in uploaded_files if f.full_text_content])
    
    # Get conversation history from database (recent messages only, limit to last 20 for performance)
    # Get last 20 messages by ordering desc and taking first 20, then reverse for chronological order
    previous_messages = ChatMessage.query.filter_by(session_id=session.id).order_by(ChatMessage.timestamp.desc()).limit(20).all()
    previous_messages.reverse()  # Reverse to get chronological order (oldest first)
    
    # Build conversation context efficiently
    system_prompt = "You are AurenLM, a tutor-like chatbot. Your goal is to help users understand their documents. Be helpful, insightful, and ask clarifying questions to guide the user's learning. Respond in a clear and educational manner."
    
    conversation_parts = [system_prompt]
    
    # Add PDF content if available (only once at the start)
    if pdf_content:
        conversation_parts.append(f"Document Content:\n{pdf_content}")
    
    # Add previous conversation messages
    for msg in previous_messages:
        sender_label = "User" if msg.sender == "user" else "AurenLM"
        conversation_parts.append(f"{sender_label}: {msg.content}")
    
    # Add current user message
    conversation_parts.append(f"User: {user_message_text}")
    conversation_parts.append("AurenLM:")
    
    full_prompt_text = "\n\n".join(conversation_parts)
    
    print(f"Full prompt text length for gemini_completion: {len(full_prompt_text)}")
    
    # Save user message (non-blocking, but do it before API call in case we need to rollback)
    user_message = ChatMessage(session_id=session.id, sender='user', content=user_message_text)
    db.session.add(user_message)
    db.session.commit()
    
    gemini_response = get_gemini_response(full_prompt_text)
    if "error" in gemini_response:
        return jsonify({"message": "Error getting completion from Gemini API", "details": gemini_response["error"]}), 500
    else:
        gemini_text = gemini_response["text"]
        # Save Gemini response
        gemini_message = ChatMessage(session_id=session.id, sender='gemini', content=gemini_text)
        db.session.add(gemini_message)
        db.session.commit()
        return jsonify({"content": gemini_text})

@app.route("/summarize_conversation", methods=["POST"])
@login_required
def summarize_conversation():
    data = request.json
    conversation_history = data.get("conversation_history", "")
    session_id = data.get("session_id")

    if not session_id:
        return jsonify({"message": "Session ID is required"}), 400
    session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first_or_404()

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
@login_required
def generate_mindmap():
    data = request.json
    full_text = data.get("fullText", "")
    session_id = data.get("session_id")

    if not session_id:
        return jsonify({"message": "Session ID is required"}), 400
    session = ChatSession.query.filter_by(id=session_id, user_id=current_user.id).first_or_404()

    if not full_text:
        return jsonify({"message": "No text provided for mind map generation"}), 400

    mindmap_prompt = f"""Generate a hierarchical mindmap from the following document. Your response MUST be a single JSON object, and ONLY the JSON object. The JSON object must have a 'title' key and a 'nodes' array. Each node in the 'nodes' array must have an 'id', a 'label', and a 'children' array. The 'children' array should contain nested nodes following the same structure. Ensure the JSON is perfectly formed and contains no other text or markdown outside of the JSON object.

Document:
{full_text[:1000]}"""

    mindmap_response = get_gemini_response(mindmap_prompt)

    if "error" in mindmap_response:
        return jsonify({"message": "Error generating mind map", "details": mindmap_response["error"]}), 500

    mindmap_content = mindmap_response["text"]

    try:
        # The LLM might return a string that is a JSON object.
        # We need to parse it to make sure it's valid JSON.
        if mindmap_content.startswith("```json") and mindmap_content.endswith("```"):
            mindmap_content = mindmap_content[7:-3].strip()
        mindmap_json = json.loads(mindmap_content)
        
        # Save mindmap data to database
        existing_mindmap = Mindmap.query.filter_by(session_id=session.id).first()
        if existing_mindmap:
            existing_mindmap.mindmap_data = mindmap_json
        else:
            new_mindmap = Mindmap(session_id=session.id, mindmap_data=mindmap_json)
            db.session.add(new_mindmap)
        db.session.commit()

        return jsonify(mindmap_json)
    except json.JSONDecodeError as e:
        return jsonify({"message": "Error decoding mind map from LLM response"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
