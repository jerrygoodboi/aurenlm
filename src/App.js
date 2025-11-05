import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, IconButton, Button, CircularProgress } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import DocumentList from './components/DocumentList';
import Chat from './components/Chat';
import Studio from './components/Studio';
import ChatSessionList from './components/ChatSessionList';
import axios from 'axios';
import { ThemeContext } from './ThemeContext';
import { AuthContext } from './AuthContext';
import LoginPage from './components/LoginPage';

function App() {
  const [chatContext, setChatContext] = useState(null);
  const [files, setFiles] = useState([]);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [chatQueryFromMindmap, setChatQueryFromMindmap] = useState(null);
  const [fileUploadSummary, setFileUploadSummary] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null); // To store loaded session data

  const { mode, toggleTheme } = useContext(ThemeContext);
  const { isAuthenticated, loading, logout } = useContext(AuthContext);

  // Effect to load session data when currentSessionId changes
  useEffect(() => {
    if (currentSessionId && isAuthenticated) {
      const loadSessionData = async () => {
        try {
          const response = await axios.get(`http://localhost:5000/sessions/${currentSessionId}`, { withCredentials: true });
          setSessionData(response.data);
          // Populate chat messages
          setChatContext({
            fullText: response.data.files.map(f => f.fullText).join('\n\n'), // Combine all file texts
            contextPrompt: null, // Reset context prompt
            initialMessages: response.data.messages.map(msg => ({ sender: msg.sender, text: msg.content }))
          });
          // Populate document list
          setFiles(response.data.files.map(f => ({ file: { name: f.filename }, summary: f.summary, fullText: f.fullText, id: f.id })));
        } catch (error) {
          console.error("Error loading session data:", error);
          setSessionData(null);
          setChatContext(null);
          setFiles([]);
        }
      };
      loadSessionData();
    } else if (!currentSessionId) {
      // Reset state if no session is selected
      setSessionData(null);
      setChatContext(null);
      setFiles([]);
    }
  }, [currentSessionId, isAuthenticated]);

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
    formData.append('session_id', currentSessionId); // Pass current session ID

    try {
      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true, // Important for sending cookies
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
        setChatContext(prev => ({
          ...prev,
          fullText: (prev?.fullText || '') + '\n\n' + result.fullText,
          contextPrompt: null,
        }));
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AurenLM
          </Typography>
          <IconButton sx={{ ml: 1 }} onClick={toggleTheme} color="inherit">
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
          <Button color="inherit" onClick={logout} startIcon={<LogoutIcon />}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth={false} disableGutters sx={{
        display: 'flex',
        height: 'calc(100vh - 64px)',
        width: '100vw',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        gap: '16px', // Equal breathing space between sections
        boxSizing: 'border-box',
      }}>
        <Box sx={{
          width: leftPanelOpen ? '20%' : '40px',
          minWidth: leftPanelOpen ? '20%' : '40px',
          maxWidth: leftPanelOpen ? '20%' : '40px',
          flexShrink: 0,
          overflowY: 'auto',
          overflowX: 'hidden', // Hide horizontal overflow when collapsed
          borderRadius: '8px',
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          padding: leftPanelOpen ? '16px' : '0', // No padding when collapsed
          transition: 'width 0.3s ease-in-out, min-width 0.3s ease-in-out, max-width 0.3s ease-in-out, box-shadow 0.3s ease-in-out, padding 0.3s ease-in-out',
          boxSizing: 'border-box',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
          },
        }}>
          {currentSessionId ? (
            <DocumentList
              files={files}
              onMainPointClick={handleMainPointClick}
              onFileUpload={handleFileChange}
              isOpen={leftPanelOpen}
              togglePanel={() => setLeftPanelOpen(!leftPanelOpen)}
              currentSessionId={currentSessionId}
            />
          ) : (
            <ChatSessionList onSelectSession={setCurrentSessionId} currentSessionId={currentSessionId} />
          )}
        </Box>
        <Box sx={{
          flexGrow: 1,
          overflowY: 'auto',
          boxSizing: 'border-box',
          minWidth: 0, // Allow flex item to shrink below its content size
          borderRadius: '8px',
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          padding: '16px',
          transition: 'box-shadow 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
          },
        }}>
          {currentSessionId ? (
            <Chat
              key={currentSessionId} // Key to force re-render when session changes
              contextPrompt={chatContext?.contextPrompt}
              pdfContent={chatContext?.fullText}
              mindmapQuery={chatQueryFromMindmap}
              setChatQueryFromMindmap={setChatQueryFromMindmap}
              fileUploadSummary={fileUploadSummary}
              setFileUploadSummary={setFileUploadSummary}
              currentSessionId={currentSessionId}
              initialMessages={chatContext?.initialMessages || []}
            />
          ) : (
            <Typography variant="h5" sx={{ p: 2 }}>Select a session or create a new one.</Typography>
          )}
        </Box>
        <Box sx={{
          width: rightPanelOpen ? '20%' : '40px',
          minWidth: rightPanelOpen ? '20%' : '40px',
          maxWidth: rightPanelOpen ? '20%' : '40px',
          flexShrink: 0,
          overflowY: 'auto',
          overflowX: 'hidden', // Hide horizontal overflow when collapsed
          borderRadius: '8px',
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          padding: rightPanelOpen ? '16px' : '0', // No padding when collapsed
          transition: 'width 0.3s ease-in-out, min-width 0.3s ease-in-out, max-width 0.3s ease-in-out, box-shadow 0.3s ease-in-out, padding 0.3s ease-in-out',
          boxSizing: 'border-box',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
          },
        }}>
          {currentSessionId ? (
            <Studio 
              isOpen={rightPanelOpen} 
              togglePanel={() => setRightPanelOpen(!rightPanelOpen)} 
              sessionPdfContent={chatContext?.fullText}
              onMindmapQuery={setChatQueryFromMindmap}
              currentSessionId={currentSessionId}
              initialMindmapData={sessionData?.mindmap} // Pass initial mindmap data
            />
          ) : (
            <Typography variant="h5" sx={{ p: 2 }}>Mindmap will appear here after session selection.</Typography>
          )}
        </Box>
      </Container>
    </>
  );
}

export default App;