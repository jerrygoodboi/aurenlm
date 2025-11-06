import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import FolderIcon from '@mui/icons-material/Folder';

export function EmptyChatState({ onCreateSession }) {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%',
      minHeight: '400px',
      textAlign: 'center',
      p: 4
    }}>
      <ChatIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
      <Typography variant="h5" gutterBottom>
        Start a Conversation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
        Select a session or create a new one to start chatting with your documents
      </Typography>
      {onCreateSession && (
        <Button variant="contained" onClick={onCreateSession}>
          Create New Session
        </Button>
      )}
    </Box>
  );
}

export function EmptySessionState({ onCreateSession }) {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%',
      minHeight: '400px',
      textAlign: 'center',
      p: 4
    }}>
      <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
      <Typography variant="h5" gutterBottom>
        No Sessions Yet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
        Create your first session to start organizing your documents and conversations
      </Typography>
      {onCreateSession && (
        <Button variant="contained" onClick={onCreateSession}>
          Create New Session
        </Button>
      )}
    </Box>
  );
}

