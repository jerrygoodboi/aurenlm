import React, { useState, useEffect } from 'react';
import { Typography, TextField, Button, Paper, Box } from '@mui/material';
import axios from 'axios';

const systemPrompt = "You are AurenLM, a tutor-like chatbot. Your goal is to help users understand their documents. Be helpful, insightful, and ask clarifying questions to guide the user's learning. Respond in a clear and educational manner.";

const MAX_CONVERSATION_LENGTH = 2000; // Max characters before summarizing old conversation

function Chat({ contextPrompt, pdfContent, initialMessage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState(systemPrompt);
  
  // State to hold the context for the entire session
  const [sessionPdfContent, setSessionPdfContent] = useState('');
  const [sessionContextPrompt, setSessionContextPrompt] = useState('');

  // This effect sets up the context for a new chat session.
  useEffect(() => {
    setConversation(systemPrompt);
    setInput('');
    setSessionPdfContent(pdfContent || '');
    setSessionContextPrompt(contextPrompt || '');

    if (initialMessage) {
      if (typeof initialMessage === 'object' && initialMessage.error) {
        setMessages([{ text: `Error: ${initialMessage.error}`, sender: 'ai' }]);
        setConversation(prev => prev + `AurenLM: Error: ${initialMessage.error}\n`);
      } else {
        // If there's an initial message (like a summary), display it from the AI.
        setMessages([{ text: initialMessage, sender: 'ai' }]);
        // Add the summary to the conversation history as if the AI said it.
        setConversation(prev => prev + `AurenLM: ${initialMessage}\n`); // Fixed: AurenLM instead of remmacs
      }
    } else {
      // Otherwise, it's a new chat from a clicked point, so clear messages for the user to start.
      setMessages([]);
    }
  }, [contextPrompt, pdfContent, initialMessage]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    const userMessage = { text: input, sender: 'user' };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');

    let promptForBackend;
    const isFirstMessage = messages.length === 0;
    let currentConversationState = conversation; // Use a local variable for current state

    // Conditionally summarize old conversation if it gets too long
    if (currentConversationState.length > MAX_CONVERSATION_LENGTH) {
      try {
        const summaryResponse = await axios.post(
          'http://localhost:5000/summarize_conversation',
          { conversation_history: currentConversationState },
          { headers: { 'Content-Type': 'application/json' } }
        );
        if (summaryResponse.data && summaryResponse.data.summary) {
          currentConversationState = systemPrompt + `
(Previous conversation summarized: ${summaryResponse.data.summary})\n`;
          setConversation(currentConversationState); // Update state with summarized conversation
        }
      } catch (error) {
        console.error('Error summarizing conversation:', error);
        // Continue without summarization if there's an error
      }
    }

    // Construct the prompt for the current turn
    if (isFirstMessage && sessionContextPrompt) {
      promptForBackend = `Regarding the main point "${sessionContextPrompt}", my question is: ${input}`;
      currentConversationState += `User: ${promptForBackend}\nAurenLM: `;
    } else {
      currentConversationState += `User: ${input}\nAurenLM: `;
    }
    
    setConversation(currentConversationState); // Update conversation state with new user message

    try {
      const response = await axios.post(
        'http://localhost:5000/local_completion',
        {
          prompt: currentConversationState, // Use the updated conversation
          pdfContent: sessionPdfContent,
          isFirstMessage: isFirstMessage
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
