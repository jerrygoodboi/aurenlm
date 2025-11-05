# AurenLM - Your AI-Powered Study Assistant

AurenLM is an intelligent study assistant designed to help you analyze documents, generate summaries, create mind maps, take notes, and interact with your content through conversational AI. It aims to streamline your learning process by leveraging advanced AI capabilities.

## Features

*   **Document Upload & Analysis:** Upload PDF documents for AI-powered processing.
*   **Smart Summarization:** Get concise summaries of your uploaded documents.
*   **Conversational AI:** Ask questions about your documents and get intelligent answers.
*   **Mind Map Generation:** Automatically generate hierarchical mind maps from your document content to visualize key concepts.
*   **Note Generation:** Create structured study notes on specific topics from your documents.
*   **Quiz Generation:** Generate multiple-choice quizzes based on your documents to test your understanding.

## Technologies

### Frontend

*   **React:** A JavaScript library for building user interfaces.
*   **Material UI:** A comprehensive suite of UI tools for a modern and responsive design.
*   **Axios:** Promise-based HTTP client for the browser and Node.js.
*   **React Router DOM:** For declarative routing in React applications.

### Backend (Primary - Flask)

*   **Python (Flask):** A lightweight Python web framework.
*   **Google Gemini API:** Utilized for various AI tasks including summarization, conversational AI, mind map, and note generation.
*   **pdfplumber:** For extracting text from PDF documents.
*   **Flask-CORS:** Handling Cross-Origin Resource Sharing.
*   **Werkzeug:** WSGI utility library for Python.

### Other Backend Components (Exploratory/Alternative Implementations)

This project also contains other backend implementations that may be under development or serve as alternatives:

*   **Python (FastAPI):** An alternative Python web framework for building APIs, potentially using MongoDB and ChromaDB for data storage and vector embeddings, and integrating with `emergentintegrations` for LLM orchestration.
*   **Node.js (Express):** A Node.js web application framework, potentially integrating with `@google/genai` and `pdf-parse`.

## Setup and Installation

To get AurenLM up and running on your local machine, follow these steps:

### 1. Clone the repository

```bash
git clone https://github.com/your-username/AurenLM.git # (Replace with actual repo URL)
cd AurenLM
```

### 2. Frontend Setup

Navigate to the root directory where `package.json` resides and install the Node.js dependencies:

```bash
npm install
# or
yarn install
```

### 3. Backend Setup (Python/Flask)

Navigate to the `python_backend` directory and install the required Python packages:

```bash
cd python_backend
pip install -r requirements.txt
```

**Environment Variables:**

Create a `.env` file in the `python_backend` directory with your Gemini API URL. Replace `YOUR_GEMINI_API_KEY` with your actual API key.

```
GEMINI_API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_GEMINI_API_KEY"
```

Return to the root directory:

```bash
cd ..
```

## Usage

### 1. Start the Backend (Python/Flask)

From the `python_backend` directory, run:

```bash
python app.py
```

The Flask backend will typically run on `http://localhost:5000`.

### 2. Start the Frontend

From the root directory, run:

```bash
npm start
# or
yarn start
```

The React development server will start, usually opening in your browser at `http://localhost:3000`.

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.