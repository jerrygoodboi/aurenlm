import React from 'react';
import { Button, List, ListItem, ListItemText, Typography, Box, IconButton, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

function DocumentList({ files, onMainPointClick, onFileUpload, isOpen, togglePanel }) {

  const handleDocumentClick = (fileItem) => {
    onMainPointClick(fileItem.fullText, null);
  }

  return (
    <Box 
      sx={{
        height: 'calc(100vh - 140px)',
        overflowY: 'auto',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        width: isOpen ? '300px' : '50px', // Fixed width when collapsed
        transition: 'width 0.3s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOpen ? 'flex-start' : 'center',
        flexShrink: 0,
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
        <>
          <Box sx={{ px: 2, pb: 2, pt: 2 }}>
            <input
              type="file"
              multiple
              onChange={onFileUpload}
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
                key={index} 
                button 
                onClick={() => handleDocumentClick(item)}
                disabled={item.summary === "Summarizing..."}
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
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Box>
  );
}

export default DocumentList;