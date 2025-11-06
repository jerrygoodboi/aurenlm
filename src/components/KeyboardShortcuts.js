import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  List, 
  ListItem, 
  ListItemText, 
  Typography,
  IconButton,
  Box
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export function KeyboardShortcuts({ open, onClose }) {
  const shortcuts = [
    { key: 'Ctrl/Cmd + Enter', action: 'Send message' },
    { key: 'Shift + Enter', action: 'New line in message' },
    { key: 'Ctrl/Cmd + K', action: 'Command palette (coming soon)' },
    { key: 'Ctrl/Cmd + /', action: 'Show keyboard shortcuts' },
    { key: 'Esc', action: 'Close dialogs/modals' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Keyboard Shortcuts
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <List>
          {shortcuts.map((item, index) => (
            <ListItem key={index} sx={{ px: 0 }}>
              <ListItemText
                primary={item.action}
                secondary={
                  <Typography 
                    component="kbd" 
                    sx={{ 
                      fontFamily: 'monospace',
                      backgroundColor: 'action.hover',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.875rem'
                    }}
                  >
                    {item.key}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}

