import React from 'react';
import { Button, List, ListItem, ListItemText, Typography, Box, IconButton, Tooltip, Paper } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close'; // Import CloseIcon
import { useNotification } from '../hooks/useNotification';

function DocumentList({ files, onMainPointClick, onFileUpload, isOpen, togglePanel, currentSessionId, onDocumentSelect, onRemoveDocument }) {
  const { showError } = useNotification();

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
            {files.map((item, index) => (
              <ListItem 
                key={item.id || index} // Use item.id if available, otherwise index
                secondaryAction={
                  files.length > 1 ? (
                    <IconButton edge="end" aria-label="delete" onClick={() => onRemoveDocument(item.id)}>
                      <CloseIcon />
                    </IconButton>
                  ) : null
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
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

export default DocumentList;