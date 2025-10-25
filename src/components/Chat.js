import React, { useState, useEffect } from 'react';
import { Typography, TextField, Button, Paper, Box } from '@mui/material';
import axios from 'axios';

const systemPrompt = "This is a conversation between User and remmacs, a friendly chatbot. remmacs is helpful, kind, honest, good at writing, and never fails to answer any requests immediately and with precision and remmacs replies within one sentence. ";

function Chat({ contextPrompt, pdfContent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState(systemPrompt);
  
  // State to hold the context for the entire session
  const [sessionPdfContent, setSessionPdfContent] = useState('');
  const [sessionContextPrompt, setSessionContextPrompt] = useState('');

  // This effect just sets up the context for a new chat session.
  useEffect(() => {
    // When a new context is passed, reset the chat.
    setMessages([]);
    setConversation(systemPrompt);
    setInput(''); // Clear input field
    setSessionPdfContent(pdfContent || '');
    setSessionContextPrompt(contextPrompt || '');
  }, [contextPrompt, pdfContent]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    const userMessage = { text: input, sender: 'user' };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');

    let promptForBackend;
    const isFirstMessage = messages.length === 0;
    let newConversation = conversation;

    // If it's the first message AND we have a context prompt from the document list
    if (isFirstMessage && sessionContextPrompt) {
      promptForBackend = `Regarding the main point "${sessionContextPrompt}", my question is: ${input}`;
      newConversation = conversation + `User: ${promptForBackend}\nremmacs: `;
    } else {
      // For subsequent messages, just append the user's input
      promptForBackend = conversation + `User: ${input}\nremmacs: `;
      newConversation = promptForBackend;
    }
    
    setConversation(newConversation);

    try {
      const response = await axios.post(
        'http://localhost:5000/local_completion',
        {
          prompt: newConversation, // Use the updated conversation
          pdfContent: sessionPdfContent
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.data && response.data.content) {
        const aiMessage = { text: response.data.content, sender: 'ai' };
        setMessages(prev => [...prev, aiMessage]);
        setConversation(prev => prev + response.data.content + '\n');
      } else {
        const errorMessage = { text: 'No response from the server.', sender: 'ai' };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessage = { text: 'Error getting response from AI.', sender: 'ai' };
      setMessages(prev => [...prev, errorMessage]);
    }
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
                backgroundColor: message.sender === 'user' ? 'primary.light' : 'grey.200',
                borderRadius: '10px',
                maxWidth: '70%',
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
