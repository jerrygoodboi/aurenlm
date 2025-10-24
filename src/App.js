import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Container, Grid } from '@mui/material';
import DocumentList from './components/DocumentList';
import NoteEditor from './components/NoteEditor';
import Chat from './components/Chat';

function App() {
  const [chatContext, setChatContext] = useState(null); // { fullText: string, initialPrompt: string }

  const handleMainPointClick = (fullText, mainPoint) => {
    setChatContext({ fullText: fullText, initialPrompt: `Regarding the following document, what more can you tell me about: ${mainPoint}\n\nDocument Content:\n${fullText}` });
  };

  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">
            AurenLM
          </Typography>
        </Toolbar>
      </AppBar>
      <Container style={{ marginTop: '2rem' }}>
        <Grid container spacing={3}>
          <Grid item xs={4}>
            <DocumentList onMainPointClick={handleMainPointClick} />
          </Grid>
          <Grid item xs={8}>
            <NoteEditor />
            {chatContext ? (
              <Chat initialPrompt={chatContext.initialPrompt} pdfContent={chatContext.fullText} />
            ) : (
              <Chat /> // Render default chat if no specific context
            )}
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}

export default App;
