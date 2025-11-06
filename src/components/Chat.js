import React, { useState, useEffect, useCallback } from 'react';
import { Typography, TextField, Button, Paper, Box, useTheme } from '@mui/material';
import axios from 'axios';

function Chat({ contextPrompt, pdfContent, mindmapQuery, setChatQueryFromMindmap, fileUploadSummary, setFileUploadSummary, currentSessionId, initialMessages }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const theme = useTheme();

  // Function to send a query to Gemini and update chat
  const sendQueryToGemini = useCallback(async (queryText) => {
    if (!currentSessionId) {
      alert("Please select or create a session first.");
      return;
    }

    try {
      // Only send the latest user message - backend will reconstruct conversation from DB
      const response = await axios.post(
        'http://localhost:5000/gemini_completion',
        {
          message: queryText, // Only send the latest message, not full conversation
          session_id: currentSessionId
        },
        {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true,
          timeout: 120000 // 120 seconds timeout
        }
      );

      if (response.data && response.data.content) {
        const messageText = typeof response.data.content === 'string' ? response.data.content : JSON.stringify(response.data.content);
        const aiMessage = { text: messageText, sender: 'ai' };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        const errorMessage = { text: 'No response from the server.', sender: 'ai' };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error fetching AI response:', error);
      let errorText = 'Error getting response from AI.';
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorText = 'Request timed out. The AI is taking too long to respond. Please try again.';
      } else if (error.response) {
        errorText = `Error: ${error.response.data?.message || error.response.statusText || 'Server error'}`;
      } else if (error.request) {
        errorText = 'Network error. Please check your connection and try again.';
      }
      const errorMessage = { text: errorText, sender: 'ai' };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [currentSessionId]);

  // This effect sets up the context for a new chat session or loads initial messages.
  useEffect(() => {
    setInput('');
    setMessages(initialMessages || []); // Load initial messages from session
  }, [initialMessages]);

  // Effect to handle mindmap queries
  useEffect(() => {
    if (mindmapQuery) {
      const userMessage = { text: mindmapQuery, sender: 'user' };
      setMessages(prevMessages => [...prevMessages, userMessage]);
      sendQueryToGemini(mindmapQuery);
      setChatQueryFromMindmap(null); // Clear the query after it's been used
    }
  }, [mindmapQuery, sendQueryToGemini, setChatQueryFromMindmap]);

  // Effect to handle file upload summaries
  useEffect(() => {
    if (fileUploadSummary) {
      const aiMessage = { text: fileUploadSummary, sender: 'ai' };
      setMessages(prev => [...prev, aiMessage]);
      setFileUploadSummary(null); // Clear the summary after it's been used
    }
  }, [fileUploadSummary, setFileUploadSummary]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    const userMessage = { text: input, sender: 'user' };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');

    sendQueryToGemini(input); // Send only the latest message
  };

  return (
    <Box sx={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Chat</Typography>
      <Paper elevation={3} sx={{ flexGrow: 1, overflowY: 'auto', p: 2, mb: 2 }}>
        {messages.map((message, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
              mb: 2,
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                backgroundColor: message.sender === 'user' ? theme.palette.primary.main : theme.palette.background.paper,
                borderRadius: '10px',
                maxWidth: '70%',
                color: message.sender === 'user' ? theme.palette.primary.contrastText : theme.palette.text.primary,
              }}
            >
              <Typography variant="body1">{message.text}</Typography>
            </Paper>
          </Box>
        ))}
      </Paper>
      <Box sx={{ display: 'flex' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Ask a question about your documents..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <Button variant="contained" color="primary" onClick={handleSend} sx={{ ml: 1 }}>
          Send
        </Button>
      </Box>
    </Box>
  );
}

export default Chat;
