import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, IconButton, Button, CircularProgress } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import HistoryIcon from '@mui/icons-material/History';
import DocumentList from './components/DocumentList';
import Chat from './components/Chat';
import Studio from './components/Studio';
import ChatSessionList from './components/ChatSessionList';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { EmptyChatState } from './components/EmptyState';
import axios from 'axios';
import { ThemeContext } from './ThemeContext';
import { AuthContext } from './AuthContext';
import LoginPage from './components/LoginPage';
import { SnackbarProvider } from 'notistack';

function App() {
  const [chatContext, setChatContext] = useState(null);
  const [files, setFiles] = useState([]);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [chatQueryFromMindmap, setChatQueryFromMindmap] = useState(null);
  const [fileUploadSummary, setFileUploadSummary] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null); // To store loaded session data
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [sessions, setSessions] = useState([]); // New state for session list

  const { mode, toggleTheme } = useContext(ThemeContext);
  const { isAuthenticated, loading, logout } = useContext(AuthContext);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Fetch sessions on component mount and when a new session is created
  const fetchSessions = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const response = await axios.get("http://localhost:5000/sessions", { withCredentials: true });
        setSessions(response.data);
      } catch (error) {
        console.error("Error fetching sessions:", error);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Show shortcuts with Cmd/Ctrl + /
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen(true);
      }
      // Close with Esc
      if (e.key === 'Escape') {
        setShortcutsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Effect to load session data when currentSessionId changes
  useEffect(() => {
    if (currentSessionId && isAuthenticated) {
      const loadSessionData = async () => {
        try {
          const response = await axios.get(`http://localhost:5000/sessions/${currentSessionId}`, { withCredentials: true });
          setSessionData(response.data);

          let loadedMessages = response.data.messages.map(msg => ({
            sender: msg.sender === 'gemini' ? 'ai' : msg.sender, // Assuming 'gemini' is the old AI sender
            text: msg.content
          }));

          const filesData = response.data.files;

          if (filesData && filesData.length > 0) {
            const summaries = filesData.map(f => f.summary);
            const existingMessagesTexts = new Set(loadedMessages.map(m => m.text));
            
            const summaryMessagesToAdd = summaries
              .filter(summary => !existingMessagesTexts.has(summary))
              .map(summary => ({
                sender: 'ai',
                text: summary
              }));

            loadedMessages = [...summaryMessagesToAdd, ...loadedMessages];
          }

          // Populate chat messages
          setChatContext({
            fullText: response.data.files.map(f => f.fullText).join('\n\n'), // Combine all file texts
            contextPrompt: null, // Reset context prompt
            initialMessages: loadedMessages
          });
          // Populate document list
          const files = response.data.files.map(f => ({ file: { name: f.filename }, summary: f.summary, fullText: f.fullText, id: f.id }));
          setFiles(files);
          if (files.length > 0) {
            setSelectedDocumentId(files[0].id);
          } else {
            setSelectedDocumentId(null);
          }
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
        timeout: 180000, // 180 seconds for file uploads (longer for large files)
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
    const isFirstUpload = files.length === 0;

    for (const file of selectedFiles) {
      setFiles(prevFiles => [...prevFiles, { file: file, summary: "Summarizing...", fullText: "" }]);

      const result = await uploadAndSummarize(file);
      if (result && typeof result.summary === 'string') {
        // This is the first file in the session, generate a title
        if (isFirstUpload) {
          try {
            const titleResponse = await axios.post(`http://localhost:5000/api/sessions/${currentSessionId}/generate-title`, {}, { withCredentials: true });
            if (titleResponse.data && titleResponse.data.new_title) {
              // Update the title in the main sessions list
              setSessions(prevSessions => 
                prevSessions.map(s => s.id === currentSessionId ? { ...s, title: titleResponse.data.new_title } : s)
              );
            }
          } catch (titleError) {
            console.error("Error generating session title:", titleError);
          }
        }

        setFiles(prevFiles =>
          prevFiles.map(item =>
            item.file === file ? { 
              ...item, 
              summary: result.summary,
              fullText: result.fullText,
              id: result.file_id // Make sure to update the id here
            } : item
          )
        );
        // If no document was previously selected, select this one
        if (!selectedDocumentId) {
          setSelectedDocumentId(result.file_id);
        }
        setChatContext(prev => ({
          ...prev,
          fullText: (prev?.fullText || '') + '\n\n' + result.fullText,
          contextPrompt: null,
        }));
        setFileUploadSummary(result.summary); // Set the summary here
        console.log("Setting fileUploadSummary:", result.summary);

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

  const handleRemoveDocument = async (documentIdToRemove) => {
    try {
      // First, delete the document from the backend
      await axios.delete(`http://localhost:5000/api/documents/${documentIdToRemove}`, { withCredentials: true });

      // Then, update the local state
      const updatedFiles = files.filter(file => file.id !== documentIdToRemove);
      setFiles(updatedFiles);

      // Recalculate fullText and update chatContext
      const updatedFullText = updatedFiles.map(f => f.fullText).join('\n\n');
      setChatContext(prev => ({ ...prev, fullText: updatedFullText }));

      // If the removed document was the selected one, update the selection
      if (selectedDocumentId === documentIdToRemove) {
        setSelectedDocumentId(updatedFiles.length > 0 ? updatedFiles[0].id : null);
      }

    } catch (error) {
      console.error("Error removing document:", error);
      // Optionally, show a notification to the user
    }
  };

  const handleCreateNewSession = async () => {
    try {
      const defaultTitle = `New Session - ${new Date().toLocaleString()}`;
      const response = await axios.post('http://localhost:5000/sessions', { title: defaultTitle }, { withCredentials: true });
      if (response.status === 201) {
        fetchSessions(); // Refresh the list of sessions
        setCurrentSessionId(response.data.id); // Select the new session
      }
    } catch (error) {
      console.error("Error creating new session:", error);
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
    <SnackbarProvider 
      maxSnack={3} 
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      dense
    >
      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AurenLM
          </Typography>
          <IconButton sx={{ ml: 1 }} onClick={toggleTheme} color="inherit">
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />} 
          </IconButton>
          <Button color="inherit" onClick={() => setCurrentSessionId(null)} startIcon={<HistoryIcon />}>
            Sessions
          </Button>
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
              onDocumentSelect={setSelectedDocumentId}
              onRemoveDocument={handleRemoveDocument}
            />
          ) : (
            <ChatSessionList 
              onSelectSession={setCurrentSessionId} 
              currentSessionId={currentSessionId} 
              sessions={sessions}
              onSessionCreated={fetchSessions} // To refresh list after creation
            />
          )}
        </Box>
        <Box sx={{
          flexGrow: 1,
          overflowY: 'auto',
          boxSizing: 'border-sizing', // Corrected from 'border-sizing' to 'border-box'
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
            console.log("Session PDF Content passed to Studio:", chatContext?.fullText),
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
            <EmptyChatState onCreateSession={handleCreateNewSession} />
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
            console.log("Session PDF Content passed to Studio:", chatContext?.fullText),
            <Studio 
              isOpen={rightPanelOpen} 
              togglePanel={() => setRightPanelOpen(!rightPanelOpen)} 
              sessionPdfContent={chatContext?.fullText}
              onMindmapQuery={setChatQueryFromMindmap}
              currentSessionId={currentSessionId}
              initialMindmapData={sessionData?.mindmap}
              documentId={selectedDocumentId}
            />
          ) : (
            null
          )}
        </Box>
      </Container>
    </SnackbarProvider>
  );
}

export default App;
