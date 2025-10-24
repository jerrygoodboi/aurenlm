import React, { useState, useEffect } from 'react';
import { Typography, TextField, Button, Paper } from '@mui/material';
import axios from 'axios';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState('');

  const handleSend = async () => {
    if (input.trim() !== '') {
      const userMessage = { text: input, sender: 'user' };
      setMessages([...messages, userMessage]);

      const newConversation = conversation + 'User: ' + input + '\n' + 'remmacs: ';
      setConversation(newConversation);

      setInput('');

      try {
        const response = await axios.post(
          'http://localhost:3001/completion',
          {
            prompt: newConversation,
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
          setConversation(newConversation + response.data.content + '\n');
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
  };

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