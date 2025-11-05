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
  const [fileUploadSummary, setFileUploadSummary] = useState(null); // New state for file upload summary

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
    setChatContext({ fullText: fullText, contextPrompt: mainPoint }); // No initialMessage here
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
      if (result && typeof result.summary === 'string') {
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
        });
        setFileUploadSummary(result.summary); // Set the summary here
        console.log("Setting fileUploadSummary:", result.summary);
      } else {
        setFiles(prevFiles =>
          prevFiles.map(item =>
            item.file === file ? { ...item, summary: "Failed to summarize." } : item
          )
        );
      }
    }
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">
            AurenLM
          </Typography>
        </Toolbar>
      </AppBar>
                        <Container maxWidth={false} disableGutters sx={{
                          display: 'flex',
                          height: 'calc(100vh - 64px)',
                          width: '100vw',
                          margin: 0,
                          padding: 0,
                          overflow: 'hidden',
                        }}>
                          <Box sx={{
                            width: leftPanelOpen ? '20%' : '0',
                            minWidth: leftPanelOpen ? '20%' : '0',
                            maxWidth: leftPanelOpen ? '20%' : '0',
                            flexShrink: 0,
                            overflowY: 'auto',
                            borderRight: leftPanelOpen ? '1px solid #eee' : 'none',
                            transition: 'width 0.3s ease-in-out, min-width 0.3s ease-in-out, max-width 0.3s ease-in-out',
                            boxSizing: 'border-box',
                          }}>
                            <DocumentList
                              files={files}
                              onMainPointClick={handleMainPointClick}
                              onFileUpload={handleFileChange}
                              isOpen={leftPanelOpen}
                              togglePanel={() => setLeftPanelOpen(!leftPanelOpen)}
                            />
                          </Box>
                          <Box sx={{
                            flexGrow: 1,
                            width: '60%',
                            minWidth: '60%',
                            maxWidth: '60%',
                            overflowY: 'auto',
                            boxSizing: 'border-box',
                            borderLeft: '1px solid #eee',
                            borderRight: '1px solid #eee',
                          }}>
                            <Chat
                              key={chatContext ? chatContext.fullText + chatContext.contextPrompt : 'default'}
                              contextPrompt={chatContext?.contextPrompt}
                              pdfContent={chatContext?.fullText}
                              mindmapQuery={chatQueryFromMindmap}
                              setChatQueryFromMindmap={setChatQueryFromMindmap}
                              fileUploadSummary={fileUploadSummary} // Pass new prop
                              setFileUploadSummary={setFileUploadSummary} // Pass setter
                            />
                          </Box>
                          <Box sx={{
                            width: rightPanelOpen ? '20%' : '0',
                            minWidth: rightPanelOpen ? '20%' : '0',
                            maxWidth: rightPanelOpen ? '20%' : '0',
                            flexShrink: 0,
                            overflowY: 'auto',
                            borderLeft: rightPanelOpen ? '1px solid #eee' : 'none',
                            transition: 'width 0.3s ease-in-out, min-width 0.3s ease-in-out, max-width 0.3s ease-in-out',
                            boxSizing: 'border-box',
                          }}>
                            <Studio 
                              isOpen={rightPanelOpen} 
                              togglePanel={() => setRightPanelOpen(!rightPanelOpen)} 
                              sessionPdfContent={chatContext?.fullText}
                              onMindmapQuery={setChatQueryFromMindmap}
                            />
                          </Box>
                        </Container>    </>
  );
}

export default App;