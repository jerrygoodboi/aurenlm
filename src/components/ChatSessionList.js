import React, { useState } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Button, TextField, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import { useNotification } from '../hooks/useNotification';
import axios from 'axios';

function ChatSessionList({ onSelectSession, currentSessionId, sessions, onSessionCreated }) {
  const { showSuccess, showError } = useNotification();
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleCreateSession = async () => {
    try {
      const defaultTitle = `New Session - ${new Date().toLocaleString()}`;
      const response = await axios.post('http://localhost:5000/sessions', { title: defaultTitle }, { withCredentials: true, timeout: 30000 });
      
      if (response.status === 201) {
        onSessionCreated();
        onSelectSession(response.data.id);
        showSuccess('New session created!');
      }
    } catch (error) {
      console.error("Error creating session:", error);
      showError('Failed to create session. Please try again.');
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (window.confirm("Are you sure you want to delete this session?")) {
      try {
        await axios.delete(`http://localhost:5000/sessions/${sessionId}`, { withCredentials: true, timeout: 30000 });
        onSessionCreated();
        if (currentSessionId === sessionId) {
          onSelectSession(null);
        }
        showSuccess('Session deleted successfully');
      } catch (error) {
        console.error("Error deleting session:", error);
        showError('Failed to delete session. Please try again.');
      }
    }
  };

  const handleRenameSession = async (sessionId) => {
    if (!editingTitle.trim()) {
      showError('Title cannot be empty');
      return;
    }
    try {
      await axios.put(`http://localhost:5000/api/sessions/${sessionId}/rename`, { title: editingTitle }, { withCredentials: true });
      onSessionCreated(); // Refresh the list
      setEditingSessionId(null);
      setEditingTitle('');
      showSuccess('Session renamed successfully');
    } catch (error) {
      console.error("Error renaming session:", error);
      showError('Failed to rename session');
    }
  };

  const startEditing = (session) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  return (
    <Box sx={{ p: 2, borderRight: '1px solid #e0e0e0', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>Your Sessions</Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={handleCreateSession}
        sx={{ mb: 2 }}
      >
        New Session
      </Button>
      <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {sessions.map((session) => (
          <ListItem
            key={session.id}
            selected={session.id === currentSessionId}
            sx={{ pr: 0, display: 'flex', justifyContent: 'space-between' }}
          >
            {editingSessionId === session.id ? (
              <TextField 
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                variant="standard"
                fullWidth
                onKeyDown={(e) => e.key === 'Enter' && handleRenameSession(session.id)}
              />
            ) : (
              <ListItemText 
                primary={session.title} 
                secondary={new Date(session.created_at).toLocaleString()} 
                onClick={() => onSelectSession(session.id)}
                sx={{ cursor: 'pointer', flexGrow: 1 }}
              />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {editingSessionId === session.id ? (
                <Tooltip title="Save">
                  <IconButton onClick={() => handleRenameSession(session.id)}>
                    <CheckIcon />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Edit Title">
                  <IconButton onClick={() => startEditing(session)}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Delete Session">
                <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteSession(session.id)}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default ChatSessionList;
