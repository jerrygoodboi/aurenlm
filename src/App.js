import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Container, Grid } from '@mui/material';
import DocumentList from './components/DocumentList';
import Chat from './components/Chat';
import Studio from './components/Studio';

function App() {
  const [chatContext, setChatContext] = useState(null);

  const handleMainPointClick = (fullText, mainPoint) => {
    setChatContext({ fullText: fullText, contextPrompt: mainPoint });
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
      <Container maxWidth="xl" style={{ marginTop: '2rem' }}>
        <Grid container spacing={2}>
          <Grid item xs={3}>
            <DocumentList onMainPointClick={handleMainPointClick} />
          </Grid>
          <Grid item xs={6}>
            {chatContext ? (
              <Chat key={chatContext.fullText + chatContext.contextPrompt} contextPrompt={chatContext.contextPrompt} pdfContent={chatContext.fullText} />
            ) : (
              <Chat /> // Render default chat if no specific context
            )}
          </Grid>
          <Grid item xs={3}>
            <Studio />
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}

export default App;
