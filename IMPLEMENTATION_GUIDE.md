# Implementation Guide - Quick Start

This guide provides step-by-step implementation for the most critical improvements.

## 1. Fix Security: Environment Variables (CRITICAL)

### Step 1: Install python-dotenv
```bash
cd python_backend
pip install python-dotenv
```

### Step 2: Update `config.py`
```python
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"

SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    import secrets
    SECRET_KEY = secrets.token_hex(32)
    print(f"WARNING: Generated new SECRET_KEY. Set SECRET_KEY in .env file!")
```

### Step 3: Create `.env` file
```bash
cd python_backend
touch .env
```

Add to `.env`:
```
GEMINI_API_KEY=your_actual_api_key_here
SECRET_KEY=your_very_strong_secret_key_here_min_32_chars
```

### Step 4: Create `.env.example`
```bash
cd python_backend
touch .env.example
```

Add to `.env.example`:
```
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_secret_key_here
```

### Step 5: Update `.gitignore`
Ensure `.env` is in `.gitignore` (should already be there)

---

## 2. Add Proper Logging

### Step 1: Update `app.py`
```python
import logging
from logging.handlers import RotatingFileHandler
import os

# Configure logging
if not os.path.exists('logs'):
    os.mkdir('logs')

file_handler = RotatingFileHandler('logs/aurenlm.log', maxBytes=10240000, backupCount=10)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
file_handler.setLevel(logging.INFO)

app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('AurenLM startup')
```

---

## 3. Add Rate Limiting

### Step 1: Install Flask-Limiter
```bash
pip install flask-limiter
```

### Step 2: Add to `app.py`
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Apply to specific endpoints
@app.route("/gemini_completion", methods=["POST"])
@login_required
@limiter.limit("10 per minute")  # 10 requests per minute per user
def gemini_completion():
    # ... existing code
```

---

## 4. Add Input Validation

### Step 1: Install Flask-WTF
```bash
pip install flask-wtf wtforms
```

### Step 2: Create validation schemas
Create `python_backend/validators.py`:
```python
from wtforms import Form, StringField, validators
from wtforms.validators import DataRequired, Length, Optional

class MessageForm(Form):
    message = StringField('Message', [
        DataRequired(),
        Length(min=1, max=10000, message='Message must be between 1 and 10000 characters')
    ])
    session_id = StringField('Session ID', [DataRequired()])
```

### Step 3: Use in endpoints
```python
from validators import MessageForm

@app.route("/gemini_completion", methods=["POST"])
@login_required
@limiter.limit("10 per minute")
def gemini_completion():
    form = MessageForm(request.json)
    if not form.validate():
        return jsonify({"message": "Validation error", "errors": form.errors}), 400
    
    user_message_text = form.message.data
    # ... rest of code
```

---

## 5. Add Health Check Endpoint

### Add to `app.py`
```python
@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Check database connection
        db.session.execute('SELECT 1')
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    return jsonify({
        "status": "healthy" if db_status == "healthy" else "unhealthy",
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat()
    }), 200 if db_status == "healthy" else 503
```

---

## 6. Add Database Indexes

### Step 1: Install Flask-Migrate
```bash
pip install flask-migrate
```

### Step 2: Initialize migrations
```bash
cd python_backend
flask db init
flask db migrate -m "Add indexes for performance"
```

### Step 3: Create migration file manually or add indexes
Update models in `app.py`:
```python
class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id'), nullable=False, index=True)
    sender = db.Column(db.String(10), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp(), index=True)
```

---

## 7. Migrate to PostgreSQL

### Step 1: Install psycopg2
```bash
pip install psycopg2-binary
```

### Step 2: Update database URI
In `app.py`:
```python
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///site.db')
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
```

### Step 3: Update `.env`
```
DATABASE_URL=postgresql://user:password@localhost/aurenlm
```

---

## 8. Add Retry Logic for Gemini API

### Update `get_gemini_response` function:
```python
import time
from functools import wraps

def retry_with_backoff(max_retries=3, backoff_factor=2):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                    if attempt == max_retries - 1:
                        raise
                    wait_time = backoff_factor ** attempt
                    app.logger.warning(f"Retry {attempt + 1}/{max_retries} after {wait_time}s")
                    time.sleep(wait_time)
            return None
        return wrapper
    return decorator

@retry_with_backoff(max_retries=3)
def get_gemini_response(prompt):
    # ... existing code
```

---

## 9. Add Frontend Error Boundaries

### Create `src/components/ErrorBoundary.js`
```javascript
import React from 'react';
import { Box, Typography, Button } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Something went wrong
          </Typography>
          <Button 
            onClick={() => this.setState({ hasError: false, error: null })}
            sx={{ mt: 2 }}
          >
            Try again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

### Use in `App.js`
```javascript
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      {/* existing app code */}
    </ErrorBoundary>
  );
}
```

---

## 10. Add Request Timeout Configuration

### Update frontend axios defaults
Create `src/config/axios.js`:
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 120000,
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## Next Steps

1. Implement the critical security fixes first (items 1-5)
2. Set up proper logging and monitoring
3. Add rate limiting
4. Migrate to PostgreSQL
5. Add tests
6. Set up CI/CD

For detailed implementation of each item, refer to `PRODUCTION_IMPROVEMENTS.md`.

