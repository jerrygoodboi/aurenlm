import React from 'react';
import { AppBar, Toolbar, Typography, Container, Grid } from '@mui/material';
import DocumentList from './components/DocumentList';
import NoteEditor from './components/NoteEditor';
import Chat from './components/Chat';

function App() {
  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">
            NotebookLM Clone
          </Typography>
        </Toolbar>
      </AppBar>
      <Container style={{ marginTop: '2rem' }}>
        <Grid container spacing={3}>
          <Grid item xs={4}>
            <DocumentList />
          </Grid>
          <Grid item xs={8}>
            <NoteEditor />
            <Chat />
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}

export default App;
