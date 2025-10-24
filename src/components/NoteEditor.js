import React from 'react';
import { Typography, TextField } from '@mui/material';

function NoteEditor() {
  return (
    <div>
      <Typography variant="h6">Notes</Typography>
      <TextField
        multiline
        rows={10}
        fullWidth
        variant="outlined"
        placeholder="Start writing your notes here..."
      />
    </div>
  );
}

export default NoteEditor;