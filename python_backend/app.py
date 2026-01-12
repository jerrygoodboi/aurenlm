import os
import requests
import pdfplumber
from flask import Flask, request, jsonify, url_for, redirect, flash, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from config import MISTRAL_API_KEY, MISTRAL_API_URL, SECRET_KEY
import json
import re
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from markdown import markdown
from weasyprint import HTML, CSS
from datetime import datetime

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

# Quiz model
class Quiz(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id'), nullable=False)
    difficulty = db.Column(db.String(20), nullable=False, default='Normal')
    quiz_data = db.Column(db.JSON, nullable=False)
    generated_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    session = db.relationship('ChatSession', backref=db.backref('quizzes', lazy=True, cascade="all, delete-orphan"))

    def __repr__(self):
        return f"Quiz(Session ID: {self.session_id}, Difficulty: {self.difficulty})"

# Quiz Attempt model
class QuizAttempt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quiz.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    answers = db.Column(db.JSON, nullable=False)
    score = db.Column(db.Float, nullable=False)
    attempted_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    quiz = db.relationship('Quiz', backref=db.backref('attempts', lazy=True))
    user = db.relationship('User', backref=db.backref('quiz_attempts', lazy=True))

    def __repr__(self):
        return f"QuizAttempt(Quiz ID: {self.quiz_id}, User ID: {self.user_id}, Score: {self.score})"

# Session Notes model
class SessionNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id'), nullable=False)
    title = db.Column(db.String(255), nullable=True)
    markdown_content = db.Column(db.Text, nullable=False)
    pdf_path = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    session = db.relationship('ChatSession', backref=db.backref('session_notes', lazy=True, cascade="all, delete-orphan"))

    def __repr__(self):
        return f"SessionNote(Session ID: {self.session_id}, Created At: {self.created_at})"


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Create database tables
with app.app_context():
    db.create_all()

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

@app.route("/api/documents/<int:document_id>", methods=["DELETE"])
@login_required
def delete_document(document_id):
    document = UploadedFile.query.get_or_404(document_id)

    # Check if the document belongs to a session owned by the current user
    if document.session.user_id != current_user.id:
        return jsonify({"message": "Unauthorized"}), 403

    db.session.delete(document)
    db.session.commit()

    return jsonify({"message": "Document deleted successfully"}), 200

@app.route("/upload", methods=["POST", "OPTIONS"])
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
        try:
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
            print(f"Summarization prompt sent to Mistral (first 500 chars): {summarization_prompt[:500]}...")
            print(f"Full summarization prompt length for upload_file: {len(summarization_prompt)}")
            summary_response = get_mistral_completion(summarization_prompt)

            print(f"Summary response from get_mistral_completion: {summary_response}")

            if isinstance(summary_response, dict) and "error" in summary_response:
                return jsonify({"message": "Error generating summary", "details": summary_response["error"]}), 500

            summary_text = summary_response

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
        except Exception as e:
            return jsonify({"message": f"An error occurred: {e}"}), 500

@app.route("/local_completion", methods=["POST"])
@login_required
def local_completion():
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
    system_prompt = "You are AurenLM, a tutor-like chatbot. Your goal is to help users understand their documents. Be helpful, insightful, and asking clarifying questions to guide the user's learning. Respond in a clear and educational manner."
    
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
    
    print(f"Full prompt text length for mistral_completion: {len(full_prompt_text)}")
    
    # Save user message (non-blocking, but do it before API call in case we need to rollback)
    user_message = ChatMessage(session_id=session.id, sender='user', content=user_message_text)
    db.session.add(user_message)
    db.session.commit()
    
    mistral_response = get_mistral_completion(full_prompt_text)
    if isinstance(mistral_response, dict) and "error" in mistral_response:
        return jsonify({"message": "Error getting completion from Mistral API", "details": mistral_response["error"]}), 500
    else:
        mistral_text = mistral_response
        # Save Mistral response
        mistral_message = ChatMessage(session_id=session.id, sender='mistral', content=mistral_text)
        db.session.add(mistral_message)
        db.session.commit()
        return jsonify({"content": mistral_text})

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
    summary_response = get_mistral_completion(summarization_prompt)

    if isinstance(summary_response, dict) and "error" in summary_response:
        return jsonify({"message": "Error summarizing conversation", "details": summary_response["error"]}), 500
    else:
        return jsonify({"summary": summary_response})

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

    mindmap_response = get_mistral_json_response(mindmap_prompt)

    if isinstance(mindmap_response, dict) and "error" in mindmap_response:
        return jsonify({"message": "Error generating mind map", "details": mindmap_response["error"]}), 500

    mindmap_content = mindmap_response

    try:
        # The LLM might return a string that is a JSON object.
        # We need to parse it to make sure it's valid JSON.
        if isinstance(mindmap_content, str) and mindmap_content.startswith("```json") and mindmap_content.endswith("```"):
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

def generate_notes_from_text(document_text, style="concise"):
    notes_prompt = f"""Generate structured, concise study notes in Markdown format from the following document.
The notes should be well-organized with headings, bullet points, and key terms.
The style should be {style}.

Document:
{document_text}
"""
    notes_response = get_mistral_completion(notes_prompt)

    if isinstance(notes_response, dict) and "error" in notes_response:
        return notes_response # Propagate error

    markdown_content = notes_response

    title_prompt = f"""Generate a short, concise title (5-10 words) for the following study notes. The title should capture the main subject of the notes. Respond with only the title and nothing else.

Notes:
{markdown_content[:2000]}"""
    title_response = get_mistral_completion(title_prompt)

    generated_title = "Untitled Notes"
    if isinstance(title_response, str):
        generated_title = title_response.strip().strip('"')
    elif isinstance(title_response, dict) and "error" in title_response:
        print(f"Error generating title for notes: {title_response['error']}")


    return {"text": markdown_content, "title": generated_title}

def markdown_to_pdf(markdown_content, output_path):
    html_content = markdown(markdown_content)
    
    # Basic CSS for a clean, readable layout
    css = CSS(string='''
        @page { size: A4; margin: 1in; }
        body { font-family: sans-serif; line-height: 1.5; }
        h1, h2, h3, h4, h5, h6 { margin-top: 1em; margin-bottom: 0.5em; }
        ul, ol { margin-bottom: 1em; }
        pre { background-color: #eee; padding: 1em; border-radius: 5px; }
    ''')
    
    HTML(string=html_content).write_pdf(output_path, stylesheets=[css])
    return output_path

def generate_quiz_from_text(document_text, difficulty):
    quiz_prompt = f"""Generate a multiple-choice quiz from the following document. The quiz should have between 5 and 10 questions. The difficulty of the quiz should be '{difficulty}'.
Your response MUST be a single JSON object, and ONLY the JSON object.
The JSON object must have a 'title' key and a 'questions' array.
Each object in the 'questions' array must have a 'question' (string), 'options' (array of strings), and a 'correct_answer' (string).
Ensure the JSON is perfectly formed and contains no other text or markdown outside of the JSON object.

Document:
{document_text[:4000]}"""

    quiz_response = get_mistral_json_response(quiz_prompt)

    if isinstance(quiz_response, dict) and "error" in quiz_response:
        return None, quiz_response["error"]

    quiz_content = quiz_response

    try:
        if isinstance(quiz_content, str) and quiz_content.startswith("```json") and quiz_content.endswith("```"):
            quiz_content = quiz_content[7:-3].strip()
        quiz_json = json.loads(quiz_content)
        return quiz_json, None
    except json.JSONDecodeError as e:
        return None, "Error decoding quiz from LLM response"

@app.route("/api/sessions/<int:session_id>/generate_quiz", methods=["POST"])
@login_required
def generate_quiz_for_session(session_id):
    session = ChatSession.query.get_or_404(session_id)
    if session.user_id != current_user.id:
        return jsonify({"message": "Unauthorized"}), 403

    data = request.json
    difficulty = data.get("difficulty", "Normal")

    all_docs_text = "\n\n".join([f.full_text_content for f in session.files if f.full_text_content])

    if not all_docs_text:
        return jsonify({"message": "No document content available in this session to generate a quiz."} ), 400

    quiz_data, error = generate_quiz_from_text(all_docs_text, difficulty)

    if error:
        return jsonify({"message": error}), 500

    new_quiz = Quiz(
        session_id=session.id,
        difficulty=difficulty,
        quiz_data=quiz_data
    )
    db.session.add(new_quiz)
    db.session.commit()

    return jsonify({
        "id": new_quiz.id,
        "session_id": new_quiz.session_id,
        "difficulty": new_quiz.difficulty,
        "quiz_data": new_quiz.quiz_data,
        "generated_at": new_quiz.generated_at.isoformat()
    })

@app.route("/api/sessions/<int:session_id>/quizzes", methods=["GET"])
@login_required
def get_quizzes_for_session(session_id):
    session = ChatSession.query.get_or_404(session_id)
    if session.user_id != current_user.id:
        return jsonify({"message": "Unauthorized"}), 403

    quizzes = Quiz.query.filter_by(session_id=session.id).order_by(Quiz.generated_at.desc()).all()
    return jsonify([
        {
            "id": q.id,
            "session_id": q.session_id,
            "difficulty": q.difficulty,
            "quiz_data": q.quiz_data,
            "generated_at": q.generated_at.isoformat()
        }
        for q in quizzes
    ])

@app.route("/api/quizzes/<int:quiz_id>/submit", methods=["POST"])
@login_required
def submit_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    data = request.json
    answers = data.get("answers")

    if not answers:
        return jsonify({"message": "No answers provided"}), 400

    correct_answers = 0
    total_questions = len(quiz.quiz_data['questions'])

    for i, question in enumerate(quiz.quiz_data['questions']):
        if str(i) in answers and answers[str(i)] == question['correct_answer']:
            correct_answers += 1

    score = (correct_answers / total_questions) * 100 if total_questions > 0 else 0

    new_attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=current_user.id,
        answers=answers,
        score=score
    )
    db.session.add(new_attempt)
    db.session.commit()

    correct_answers_map = {i: q['correct_answer'] for i, q in enumerate(quiz.quiz_data['questions'])}

    return jsonify({
        "message": "Quiz submitted successfully",
        "score": score,
        "correct_answers": correct_answers,
        "total_questions": total_questions,
        "correct_answers_map": correct_answers_map
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)