import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

function Studio() {
  return (
    <Box sx={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Studio</Typography>
      <Paper elevation={3} sx={{ flexGrow: 1, p: 2 }}>
        {/* Content for the Studio panel can be added here in the future. */}
      </Paper>
    </Box>
  );
}

export default Studio;
