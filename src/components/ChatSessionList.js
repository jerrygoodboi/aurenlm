import React, { useState, useEffect } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../AuthContext';
import { useNotification } from '../hooks/useNotification';
import axios from 'axios';

function ChatSessionList({ onSelectSession, currentSessionId }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const { showSuccess, showError } = useNotification();

  const fetchSessions = async () => {
    try {
      const response = await axios.get('http://localhost:5000/sessions', { withCredentials: true, timeout: 30000 });
      setSessions(response.data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user]);

  const handleCreateSession = async () => {
    if (!newSessionTitle.trim()) {
      showError('Please enter a session title');
      return;
    }
    try {
      const response = await axios.post('http://localhost:5000/sessions', { title: newSessionTitle }, { withCredentials: true, timeout: 30000 });
      if (response.status === 201) {
        fetchSessions();
        setNewSessionTitle('');
        setOpenDialog(false);
        onSelectSession(response.data.id); // Automatically select the new session
        showSuccess('Session created successfully!');
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
        fetchSessions();
        if (currentSessionId === sessionId) {
          onSelectSession(null); // Deselect if the current session was deleted
        }
        showSuccess('Session deleted successfully');
      } catch (error) {
        console.error("Error deleting session:", error);
        showError('Failed to delete session. Please try again.');
      }
    }
  };

  return (
    <Box sx={{ p: 2, borderRight: '1px solid #e0e0e0', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>Your Sessions</Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setOpenDialog(true)}
        sx={{ mb: 2 }}
      >
        New Session
      </Button>
      <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {sessions.map((session) => (
          <ListItem
            key={session.id}
            button
            onClick={() => onSelectSession(session.id)}
            selected={session.id === currentSessionId}
            sx={{ pr: 0 }} // Remove right padding to make space for delete button
          >
            <ListItemText primary={session.title} secondary={new Date(session.created_at).toLocaleString()} />
            <Tooltip title="Delete Session">
              <IconButton edge="end" aria-label="delete" onClick={(e) => {
                e.stopPropagation(); // Prevent selecting the session when deleting
                handleDeleteSession(session.id);
              }}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Create New Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Session Title"
            type="text"
            fullWidth
            variant="standard"
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateSession}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ChatSessionList;
