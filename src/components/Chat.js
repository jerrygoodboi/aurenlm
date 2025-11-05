import React, { useState, useEffect, useCallback } from 'react';
import { Typography, TextField, Button, Paper, Box, useTheme } from '@mui/material';
import axios from 'axios';

const systemPrompt = "You are AurenLM, a tutor-like chatbot. Your goal is to help users understand their documents. Be helpful, insightful, and ask clarifying questions to guide the user's learning. Respond in a clear and educational manner.";

const MAX_CONVERSATION_LENGTH = 2000; // Max characters before summarizing old conversation

function Chat({ contextPrompt, pdfContent, mindmapQuery, setChatQueryFromMindmap, fileUploadSummary, setFileUploadSummary }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState(systemPrompt);
  const theme = useTheme();
  
  // State to hold the context for the entire session
  const [sessionPdfContent, setSessionPdfContent] = useState('');
  const [sessionContextPrompt, setSessionContextPrompt] = useState('');

  // Function to send a query to Gemini and update chat
  const sendQueryToGemini = useCallback(async (queryText, isInitial = false) => {
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
    let promptForBackend = queryText; // Initialize with queryText as default
    if (isInitial && sessionContextPrompt) {
      promptForBackend = `Regarding the main point "${sessionContextPrompt}", my question is: ${queryText}`;
      currentConversationState += `User: ${promptForBackend}\nAurenLM: `;
    } else {
      currentConversationState += `User: ${promptForBackend}\nAurenLM: `;
    }
    
    setConversation(currentConversationState); // Update conversation state with new user message

    try {
      const response = await axios.post(
        'http://localhost:5000/gemini_completion',
        {
          prompt: currentConversationState, // Use the updated conversation
          pdfContent: sessionPdfContent,
          isFirstMessage: isInitial
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.data && response.data.content) {
        const messageText = typeof response.data.content === 'string' ? response.data.content : JSON.stringify(response.data.content);
        const aiMessage = { text: messageText, sender: 'ai' };
        setMessages(prev => [...prev, aiMessage]);
        setConversation(prev => prev + messageText + '\n');
      } else {
        const errorMessage = { text: 'No response from the server.', sender: 'ai' };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessage = { text: 'Error getting response from AI.', sender: 'ai' };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [conversation, sessionPdfContent, sessionContextPrompt]);

  // This effect sets up the context for a new chat session.
  useEffect(() => {
    setConversation(systemPrompt);
    setInput('');
    setSessionPdfContent(pdfContent || '');
    setSessionContextPrompt(contextPrompt || '');
    setMessages([]); // Always clear messages on new context, unless fileUploadSummary is present
  }, [contextPrompt, pdfContent]);

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
      setConversation(prev => prev + `AurenLM: ${fileUploadSummary}\n`);
      setFileUploadSummary(null); // Clear the summary after it's been used
    }
  }, [fileUploadSummary, setFileUploadSummary]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    const userMessage = { text: input, sender: 'user' };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');

    sendQueryToGemini(input, messages.length === 0); // Pass input and whether it's the first message
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
