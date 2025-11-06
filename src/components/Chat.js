import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Box, 
  useTheme, 
  CircularProgress, 
  IconButton, 
  Tooltip,
  Skeleton
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';
import axios from 'axios';
import { useNotification } from '../hooks/useNotification';
import { EmptyChatState } from './EmptyState';

function Chat({ contextPrompt, pdfContent, mindmapQuery, setChatQueryFromMindmap, fileUploadSummary, setFileUploadSummary, currentSessionId, initialMessages }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const theme = useTheme();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const { showSuccess, showError } = useNotification();

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAIThinking]);

  // Function to send a query to Gemini and update chat
  const sendQueryToGemini = useCallback(async (queryText) => {
    if (!currentSessionId) {
      showError("Please select or create a session first.");
      return;
    }

    setIsAIThinking(true);
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
        const aiMessage = { 
          text: messageText, 
          sender: 'ai',
          timestamp: new Date(),
          id: Date.now()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        const errorMessage = { 
          text: 'No response from the server.', 
          sender: 'ai',
          timestamp: new Date(),
          id: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
        showError('No response from the server.');
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
      const errorMessage = { 
        text: errorText, 
        sender: 'ai',
        timestamp: new Date(),
        id: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
      showError(errorText);
    } finally {
      setIsAIThinking(false);
    }
  }, [currentSessionId, showError]);

  // This effect sets up the context for a new chat session or loads initial messages.
  useEffect(() => {
    setInput('');
    if (initialMessages && initialMessages.length > 0) {
      setIsLoading(true);
      // Simulate loading for better UX
      setTimeout(() => {
        const messagesWithTimestamps = initialMessages.map((msg, idx) => ({
          ...msg,
          timestamp: new Date(Date.now() - (initialMessages.length - idx) * 60000), // Stagger timestamps
          id: Date.now() + idx
        }));
        setMessages(messagesWithTimestamps);
        setIsLoading(false);
      }, 300);
    } else {
      setMessages([]);
      setIsLoading(false);
    }
  }, [initialMessages]);

  // Effect to handle mindmap queries
  useEffect(() => {
    if (mindmapQuery) {
      const userMessage = { 
        text: mindmapQuery, 
        sender: 'user',
        timestamp: new Date(),
        id: Date.now()
      };
      setMessages(prevMessages => [...prevMessages, userMessage]);
      sendQueryToGemini(mindmapQuery);
      setChatQueryFromMindmap(null); // Clear the query after it's been used
    }
  }, [mindmapQuery, sendQueryToGemini, setChatQueryFromMindmap]);

  // Effect to handle file upload summaries
  useEffect(() => {
    if (fileUploadSummary) {
      const aiMessage = { 
        text: fileUploadSummary, 
        sender: 'ai',
        timestamp: new Date(),
        id: Date.now()
      };
      setMessages(prev => [...prev, aiMessage]);
      setFileUploadSummary(null); // Clear the summary after it's been used
    }
  }, [fileUploadSummary, setFileUploadSummary]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    const userMessage = { 
      text: input, 
      sender: 'user',
      timestamp: new Date(),
      id: Date.now()
    };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    const messageToSend = input;
    setInput('');

    sendQueryToGemini(messageToSend); // Send only the latest message
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter will create new line (default behavior)
  };

  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text);
    showSuccess('Message copied to clipboard');
  };

  // Loading skeletons
  if (isLoading) {
    return (
      <Box sx={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Chat</Typography>
        <Paper elevation={3} sx={{ flexGrow: 1, overflowY: 'auto', p: 2, mb: 2 }}>
          {[1, 2, 3, 4].map((i) => (
            <Box key={i} sx={{ mb: 2, display: 'flex', justifyContent: i % 2 === 0 ? 'flex-end' : 'flex-start' }}>
              <Skeleton 
                variant="rectangular" 
                width={i % 2 === 0 ? '60%' : '70%'} 
                height={60} 
                sx={{ borderRadius: '10px' }} 
              />
            </Box>
          ))}
        </Paper>
      </Box>
    );
  }

  // Empty state
  if (!currentSessionId) {
    return (
      <Box sx={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
        <EmptyChatState />
      </Box>
    );
  }

  return (
    <Box sx={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Chat</Typography>
      <Paper 
        ref={messagesContainerRef}
        elevation={3} 
        sx={{ flexGrow: 1, overflowY: 'auto', p: 2, mb: 2 }}
      >
        {messages.length === 0 && !isAIThinking ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            minHeight: '300px',
            textAlign: 'center',
            p: 4,
            opacity: 0.6
          }}>
            <Typography variant="body1" color="text.secondary">
              Start a conversation by asking a question about your documents
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Try asking: "What are the main points in this document?"
            </Typography>
          </Box>
        ) : (
          <>
            {messages.map((message, index) => (
              <Box
                key={message.id || index}
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
                    position: 'relative',
                    backgroundColor: message.sender === 'user' 
                      ? theme.palette.primary.main 
                      : theme.palette.background.paper,
                    borderRadius: '10px',
                    maxWidth: '70%',
                    color: message.sender === 'user' 
                      ? theme.palette.primary.contrastText 
                      : theme.palette.text.primary,
                    '&:hover .copy-button': {
                      opacity: 1,
                    },
                  }}
                >
                  <Tooltip title="Copy message">
                    <IconButton
                      className="copy-button"
                      size="small"
                      onClick={() => handleCopyMessage(message.text)}
                      sx={{ 
                        position: 'absolute', 
                        top: 4, 
                        right: 4,
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        color: message.sender === 'user' 
                          ? theme.palette.primary.contrastText 
                          : theme.palette.text.primary,
                      }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  {message.sender === 'ai' ? (
                    <Box sx={{ pr: 4 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.text}
                      </ReactMarkdown>
                    </Box>
                  ) : (
                    <Typography variant="body1" sx={{ pr: 4 }}>
                      {message.text}
                    </Typography>
                  )}
                  
                  {message.timestamp && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: 'block', 
                        mt: 0.5, 
                        opacity: 0.6,
                        fontSize: '0.75rem'
                      }}
                    >
                      {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                    </Typography>
                  )}
                </Paper>
              </Box>
            ))}
            
            {/* Typing Indicator */}
            {isAIThinking && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                <Paper 
                  sx={{ 
                    p: 1.5, 
                    borderRadius: '10px', 
                    maxWidth: '70%',
                    backgroundColor: theme.palette.background.paper
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      AI is thinking...
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </Paper>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          variant="outlined"
          placeholder="Ask a question about your documents... (Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isAIThinking}
        />
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSend} 
          disabled={!input.trim() || isAIThinking}
          startIcon={<SendIcon />}
          sx={{ minWidth: '100px' }}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
}

export default Chat;
