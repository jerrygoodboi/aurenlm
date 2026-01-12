import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Container, Box } from '@mui/material';
import DocumentList from './components/DocumentList';
import Chat from './components/Chat';
import Studio from './components/Studio';
import axios from 'axios';

function App() {
  const [chatContext, setChatContext] = useState(null);
  const [files, setFiles] = useState([]);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [chatQueryFromMindmap, setChatQueryFromMindmap] = useState(null);

  useEffect(() => {
    if (chatQueryFromMindmap) {
      setChatContext(prev => ({
        ...prev,
        initialMessage: chatQueryFromMindmap,
      }));
      setChatQueryFromMindmap(null); // Clear the query after it's been used
    }
  }, [chatQueryFromMindmap]);

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
      if (error.response) {
        return error.response.data;
      }
      return { message: "An unknown error occurred." };
    }
  };

  const handleFileChange = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    for (const file of selectedFiles) {
      setFiles(prevFiles => [...prevFiles, { file: file, summary: "Summarizing...", fullText: "" }]);

      const result = await uploadAndSummarize(file);
      if (result && result.summary) {
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
        const errorMessage = result.error ? `Error: ${result.error}` : (result.message || "An error occurred during summarization.");
        setFiles(prevFiles =>
          prevFiles.map(item =>
            item.file === file ? { ...item, summary: errorMessage } : item
          )
        );
        setChatContext({
            fullText: "",
            contextPrompt: null,
            initialMessage: errorMessage
        });
      }
    }
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
      <Container maxWidth={false} disableGutters style={{ marginTop: '2rem', display: 'flex', flexDirection: 'row' }}>
        <DocumentList
          files={files}
          onMainPointClick={handleMainPointClick}
          onFileUpload={handleFileChange}
          isOpen={leftPanelOpen}
          togglePanel={() => setLeftPanelOpen(!leftPanelOpen)}
        />
        <Box sx={{ flexGrow: 1, p: 2 }}>
          <Chat
            key={chatContext ? chatContext.fullText + chatContext.contextPrompt + chatContext.initialMessage : 'default'}
            contextPrompt={chatContext?.contextPrompt}
            pdfContent={chatContext?.fullText}
            initialMessage={chatContext?.initialMessage}
          />
        </Box>
        <Studio 
          isOpen={rightPanelOpen} 
          togglePanel={() => setRightPanelOpen(!rightPanelOpen)} 
          sessionPdfContent={chatContext?.fullText}
          onMindmapQuery={setChatQueryFromMindmap}
        />
      </Container>
    </div>
  );
}

export default App;