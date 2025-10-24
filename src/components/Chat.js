import React, { useState, useEffect, useCallback } from 'react';
import { Typography, TextField, Button, Paper } from '@mui/material';
import axios from 'axios';

function Chat({ initialPrompt, pdfContent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState('');

  useEffect(() => {
    if (initialPrompt && pdfContent) {
      // Clear previous messages and set initial prompt
      setMessages([{ text: initialPrompt, sender: 'user' }]);
      setConversation(`User: ${initialPrompt}\nremmacs: `);
      // Automatically send the initial prompt to the AI
      handleSend(initialPrompt, pdfContent);
    } else {
      // Clear chat if no initial context
      setMessages([]);
      setConversation('');
    }
  }, [initialPrompt, pdfContent]); // Re-run when initialPrompt or pdfContent changes

  const handleSend = useCallback(async (promptToSend = input, content = '') => {
    if (promptToSend.trim() !== '') {
      const userMessage = { text: promptToSend, sender: 'user' };
      // Only add to messages if it's not the initial prompt being sent automatically
      if (!initialPrompt || promptToSend !== initialPrompt) {
        setMessages(prevMessages => [...prevMessages, userMessage]);
      }

      let currentConversation = conversation;
      if (!initialPrompt || promptToSend !== initialPrompt) {
        currentConversation += `User: ${promptToSend}\nremmacs: `;
      }

      setConversation(currentConversation);
      setInput('');

      try {
        const response = await axios.post(
          'http://localhost:3001/completion', // Assuming general completion still uses Node.js backend
          {
            prompt: currentConversation,
            pdfContent: content // Pass PDF content if available
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data && response.data.content) {
          const aiMessage = { text: response.data.content, sender: 'ai' };
          setMessages(prevMessages => [...prevMessages, aiMessage]);
          setConversation(currentConversation + response.data.content + '\n');
        } else {
          const errorMessage = { text: 'No response from the server.', sender: 'ai' };
          setMessages(prevMessages => [...prevMessages, errorMessage]);
        }
      } catch (error) {
        console.error('Error fetching AI response:', error);
        const errorMessage = { text: 'Error getting response from AI.', sender: 'ai' };
        setMessages(prevMessages => [...prevMessages, errorMessage]);
      }
    }
  }, [conversation, initialPrompt, setMessages, setInput]); // Add dependencies

  return (
    <div style={{ marginTop: '2rem' }}>
      <Typography variant="h6">Chat</Typography>
      <Paper style={{ height: '300px', overflowY: 'auto', padding: '1rem', marginBottom: '1rem' }}>
        {messages.map((message, index) => (
          <div key={index} style={{ textAlign: message.sender === 'user' ? 'right' : 'left', marginBottom: '0.5rem' }}>
            <Typography variant="body1">{message.text}</Typography>
          </div>
        ))}
      </Paper>
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Ask a question about your documents..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
      />
      <Button variant="contained" color="primary" onClick={handleSend} style={{ marginTop: '1rem' }}>
        Send
      </Button>
    </div>
  );
}

export default Chat;