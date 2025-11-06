import React from 'react';
import { Button, List, ListItem, ListItemText, Typography, Box, IconButton, Tooltip, Paper, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import NotesIcon from '@mui/icons-material/Notes';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { useNotification } from '../hooks/useNotification';
import NotesView from './NotesView';

function DocumentList({ files, onMainPointClick, onFileUpload, isOpen, togglePanel, currentSessionId, onDocumentSelect, onRemoveDocument, onGenerateNotes, documentNotes }) {
  const { showError, showSuccess } = useNotification();
  const [generatingNotes, setGeneratingNotes] = React.useState({}); // {document_id: boolean}
  const [viewingNotes, setViewingNotes] = React.useState(null); // note_id to view

  const handleDocumentClick = (fileItem) => {
    onMainPointClick(fileItem.fullText, null);
    onDocumentSelect(fileItem.id);
  }

  const handleFileUploadChange = (event) => {
    if (currentSessionId) {
      onFileUpload(event, currentSessionId);
    } else {
      showError("Please select or create a session first.");
    }
  };

  const handleGenerateNotes = async (documentId) => {
    setGeneratingNotes(prev => ({ ...prev, [documentId]: true }));
    try {
      await onGenerateNotes(documentId);
      showSuccess("Notes generation initiated!");
    } catch (error) {
      showError("Failed to generate notes.");
    } finally {
      setGeneratingNotes(prev => ({ ...prev, [documentId]: false }));
    }
  };

  const handleViewNotes = (noteId) => {
    setViewingNotes(noteId);
  };

  const handleCloseNotesView = () => {
    setViewingNotes(null);
  };

  const handleDownloadPdf = (noteId) => {
    if (noteId) {
      window.open(`http://localhost:5000/api/notes/${noteId}/pdf`, '_blank');
    }
  };

  return (
    <Box 
      sx={{
        height: 'calc(100vh - 140px)',
        overflowY: 'auto',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        width: isOpen ? 'auto' : '50px', // Fixed width when collapsed
        transition: 'width 0.3s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOpen ? 'flex-start' : 'center',
      }}
    >
      <Box sx={{ 
        display: 'flex',
        justifyContent: isOpen ? 'space-between' : 'center',
        alignItems: 'center',
        p: 1,
        borderBottom: '1px solid #e0e0e0',
        width: '100%',
      }}>
        {isOpen && <Typography variant="h6" sx={{ pl: 1 }}>Documents</Typography>}
        <Tooltip title={isOpen ? "Collapse Sources" : "Expand Sources"} placement="right">
          <IconButton onClick={togglePanel} size="small">
            {isOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />} 
          </IconButton>
        </Tooltip>
      </Box>
      {isOpen && (
        <Paper elevation={3} sx={{ flexGrow: 1, p: 2, width: '100%', height: '100%' }}>
          <Box sx={{ pb: 2 }}>
            <input
              type="file"
              multiple
              onChange={handleFileUploadChange}
              style={{ display: 'none' }}
              id="upload-button"
            />
            <label htmlFor="upload-button">
              <Button variant="contained" component="span" fullWidth>
                Upload Files
              </Button>
            </label>
          </Box>
          <List>
            {files.map((item, index) => {
              const notesForDocument = documentNotes[item.id];
              const hasNotes = notesForDocument && notesForDocument.length > 0;
              const noteId = hasNotes ? notesForDocument[0].id : null; // Assuming one note per document for now

              return (
                <ListItem 
                  key={item.id || index} // Use item.id if available, otherwise index
                  secondaryAction={
                    <Box>
                      {hasNotes ? (
                        <>
                          <IconButton edge="end" aria-label="view notes" onClick={() => handleViewNotes(noteId)}>
                            <Tooltip title="View Notes"><NotesIcon /></Tooltip>
                          </IconButton>
                          <IconButton edge="end" aria-label="download pdf" onClick={() => handleDownloadPdf(noteId)}>
                            <Tooltip title="Download PDF"><PictureAsPdfIcon /></Tooltip>
                          </IconButton>
                        </>
                      ) : (
                        <IconButton 
                          edge="end" 
                          aria-label="generate notes" 
                          onClick={() => handleGenerateNotes(item.id)}
                          disabled={generatingNotes[item.id]}
                        >
                          {generatingNotes[item.id] ? <CircularProgress size={20} /> : <Tooltip title="Generate Notes"><AutoStoriesIcon /></Tooltip>}
                        </IconButton>
                      )}
                      {files.length > 1 && (
                        <IconButton edge="end" aria-label="delete" onClick={() => onRemoveDocument(item.id)}>
                          <CloseIcon />
                        </IconButton>
                      )}
                    </Box>
                  }
                >
                  <ListItemText 
                    primary={item.file.name} 
                    primaryTypographyProps={{
                      fontWeight: 'bold',
                      style: {
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }
                    }} 
                    secondary={item.summary === "Summarizing..." ? "Summarizing..." : null}
                    onClick={() => handleDocumentClick(item)}
                    sx={{ cursor: 'pointer' }}
                  />
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}

      <Dialog open={!!viewingNotes} onClose={handleCloseNotesView} maxWidth="md" fullWidth>
        <DialogTitle>Study Notes</DialogTitle>
        <DialogContent>
          {viewingNotes && <NotesView noteId={viewingNotes} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNotesView}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DocumentList;