import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Container, Grid } from '@mui/material';
import DocumentList from './components/DocumentList';
import Chat from './components/Chat';
import Studio from './components/Studio';
import axios from 'axios';

function App() {
  const [chatContext, setChatContext] = useState(null);
  const [files, setFiles] = useState([]);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const handleMainPointClick = (fullText, mainPoint) => {
    setChatContext({ fullText: fullText, contextPrompt: mainPoint, initialMessage: null });
  };

  const uploadAndSummarize = async (fileToUpload) => {
    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleFileChange = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    for (const file of selectedFiles) {
      setFiles(prevFiles => [...prevFiles, { file: file, summary: "Summarizing...", fullText: "" }]);

      const result = await uploadAndSummarize(file);
      if (result) {
        setFiles(prevFiles =>
          prevFiles.map(item =>
            item.file === file ? { 
              ...item, 
              summary: result.summary,
              fullText: result.fullText 
            } : item
          )
        );
        setChatContext({
          fullText: result.fullText,
          contextPrompt: null,
          initialMessage: result.summary
        });
      } else {
        setFiles(prevFiles =>
          prevFiles.map(item =>
            item.file === file ? { ...item, summary: "Failed to summarize." } : item
          )
        );
      }
    }
  };

  const leftGridWidth = leftPanelOpen ? 2 : 1; // 1 for minimized width
  const rightGridWidth = rightPanelOpen ? 2 : 1; // 1 for minimized width
  const centerGridWidth = 12 - leftGridWidth - rightGridWidth;

  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">
            AurenLM
          </Typography>
        </Toolbar>
      </AppBar>
      <Container disableGutters style={{ marginTop: '2rem' }}>
        <Grid container spacing={0}>
          <Grid item xs={leftGridWidth}>
            <DocumentList
              files={files}
              onMainPointClick={handleMainPointClick}
              onFileUpload={handleFileChange}
              isOpen={leftPanelOpen}
              togglePanel={() => setLeftPanelOpen(!leftPanelOpen)}
            />
          </Grid>
          <Grid item xs={centerGridWidth}>
            <Chat
              key={chatContext ? chatContext.fullText + chatContext.contextPrompt + chatContext.initialMessage : 'default'}
              contextPrompt={chatContext?.contextPrompt}
              pdfContent={chatContext?.fullText}
              initialMessage={chatContext?.initialMessage}
            />
          </Grid>
          <Grid item xs={rightGridWidth}>
            <Studio 
              isOpen={rightPanelOpen} 
              togglePanel={() => setRightPanelOpen(!rightPanelOpen)} 
              sessionPdfContent={chatContext?.fullText}
            />
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}

export default App;