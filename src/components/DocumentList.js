import React, { useState } from 'react';
import { Button, List, ListItem, ListItemText, Typography, Box, IconButton, Tooltip, Paper } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useNotification } from '../hooks/useNotification';

function DocumentList({ files, onMainPointClick, onFileUpload, isOpen, togglePanel, currentSessionId, onDocumentSelect, onRemoveDocument }) {
  const { showError, showInfo } = useNotification();
  const [isDragging, setIsDragging] = useState(false);

  const handleDocumentClick = (fileItem) => {
    onMainPointClick(fileItem.fullText, null);
    onDocumentSelect(fileItem.id);
  }

  const handleFileUploadChange = (event) => {
    if (currentSessionId) {
      showInfo("Uploading file...");
      onFileUpload(event, currentSessionId);
    } else {
      showError("Please select or create a session first.");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (!currentSessionId) {
      showError("Please select or create a session first.");
      return;
    }

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      showInfo("Uploading file...");
      // Simulate the event object structure expected by onFileUpload
      onFileUpload({ target: { files: droppedFiles } }, currentSessionId);
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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
        <Paper 
          elevation={3} 
          sx={{ 
            flexGrow: 1, 
            p: 2, 
            width: '100%', 
            height: '100%',
            backgroundColor: isDragging ? 'rgba(33, 150, 243, 0.05)' : 'inherit',
            border: isDragging ? '2px dashed #2196f3' : 'none',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.2s',
            position: 'relative'
          }}
        >
          <Box sx={{ pb: 2 }}>
            <input
              type="file"
              multiple
              onChange={handleFileUploadChange}
              style={{ display: 'none' }}
              id="upload-button"
            />
            <label htmlFor="upload-button">
              <Button 
                variant="contained" 
                component="span" 
                fullWidth
                startIcon={<CloudUploadIcon />}
                sx={{ py: 1.5, borderRadius: '10px' }}
              >
                Upload Files
              </Button>
            </label>
          </Box>
          <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
            {files.length === 0 && !isDragging && (
              <Box sx={{ 
                p: 3, 
                textAlign: 'center', 
                opacity: 0.5, 
                border: '1px dashed currentColor',
                borderRadius: '8px',
                mt: 2
              }}>
                <Typography variant="body2">
                  Drag & drop files here or use the button above
                </Typography>
              </Box>
            )}
            {files.map((item, index) => {
              return (
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
              );
            })}
          </List>
        </Paper>
      )}
    </Box>
  );
}

export default DocumentList;