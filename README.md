# AurenLM - Your AI-Powered Study Assistant

AurenLM is an advanced, intelligent study platform designed to transform how you learn from documents. By leveraging cutting-edge AI, AurenLM helps you visualize concepts, test your knowledge, and interact with your content in real-time.

## ✨ Latest Pro Features

*   **⚡ Real-time AI Streaming:** Experience "ChatGPT-style" responses that appear word-by-word, providing instant feedback.
*   **🎙️ Audio Tutor:** Every AI response can be read out loud using our built-in Text-to-Speech (TTS) engine.
*   **🧠 Futuristic Neural Mindmaps:** 
    *   Dynamic, hierarchical visualization of your documents.
    *   **Neural Network Edges:** Animated "pulses" showing data flow.
    *   **Topic Color Coding:** Automatic branch-based color schemes.
    *   **Sub-topic Generation:** Generate targeted quizzes or notes directly from any node in the map.
*   **📁 Subtle Drag-and-Drop:** Intuitive document management with a modern dropzone interface.
*   **🌗 Perfect Theme Sync:** Seamless, smooth transitions between Dark and Light modes across the entire UI.
*   **📝 Precision Notes & Quizzes:** Customizable generation with "Easy/Normal/Hard" difficulties and "Concise/Detailed/Bullet Point" styles.

## 🛠️ Core Capabilities

*   **Conversational AI:** Context-aware chat that remembers your document history.
*   **Smart Summarization:** Instantly understand the core of long PDFs.
*   **Session Management:** Organize your study paths into separate sessions with automatic persistence.
*   **Modern UX:** Ultra-thin custom scrollbars, glassmorphic surfaces, and micro-interactions.

## 💻 Tech Stack

### Frontend
*   **React 19:** High-performance UI library.
*   **ReactFlow:** Powering our advanced mind mapping engine.
*   **Material UI (MUI):** Premium component library for sleek design.
*   **Notistack:** Real-time toast notifications for all system actions.

### Backend
*   **Python (Flask):** Robust and scalable backend API.
*   **Google Gemini 2.5 Flash:** Utilizing the latest high-speed Gemini models for reasoning and generation.
*   **SQLAlchemy:** Database ORM for session and message persistence.
*   **Web Speech API:** Built-in browser support for our Audio Tutor.

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/jerrygoodboi/aurenlm.git 
cd aurenlm
```

### 2. Frontend Setup
```bash
npm install
npm start
```

### 3. Backend Setup
```bash
cd python_backend
pip install -r requirements.txt
```

**Configuration:**
Create a `.env` file in the `python_backend` directory:
```env
GEMINI_API_KEY=your_actual_api_key_here
SECRET_KEY=your_secure_random_string
```

**Run Backend:**
```bash
python app.py
```

## 📜 License
This project is licensed under the MIT License - see the `LICENSE` file for details.
