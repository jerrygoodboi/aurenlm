import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Alert } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';

function NotesView({ noteId, documentId }) {
  const [notesContent, setNotesContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNotes = async () => {
      if (!noteId) {
        setError("No note ID provided.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(`http://localhost:5000/api/notes/${noteId}`, { withCredentials: true });
        setNotesContent(response.data.markdown_content);
      } catch (err) {
        console.error("Error fetching notes:", err);
        setError("Failed to load notes. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [noteId]);

  const handleDownloadPdf = () => {
    if (noteId) {
      window.open(`http://localhost:5000/api/notes/${noteId}/pdf`, '_blank');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!notesContent) {
    return <Alert severity="info">No notes content available.</Alert>;
  }

  return (
    <Box sx={{ p: 2, maxHeight: '70vh', overflowY: 'auto' }}>
      <Typography variant="h5" gutterBottom>Study Notes</Typography>
      <Button variant="contained" onClick={handleDownloadPdf} sx={{ mb: 2 }}>
        Download PDF
      </Button>
      <Box sx={{ border: '1px solid #e0e0e0', p: 2, borderRadius: '8px' }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {notesContent}
        </ReactMarkdown>
      </Box>
    </Box>
  );
}

export default NotesView;