import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Paper, Typography, Box, IconButton, Tooltip, Button, Dialog, DialogContent, List, ListItem, ListItemText, Divider, Menu, MenuItem } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import ReactFlow, { addEdge, applyEdgeChanges, applyNodeChanges, Controls, Background, Handle, Position, useReactFlow, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '../hooks/useNotification';
import QuizView from './QuizView'; // Import the new QuizView component

// Custom Node Component for ReactFlow
const CustomMindmapNode = ({ id, data }) => {
  const { label, hasChildren, isCollapsed, onToggleCollapse, onNodeClick } = data;
  const theme = useTheme();

  const handleNodeClick = useCallback((event) => {
    onNodeClick(event, { label, id }); // Pass the event and node data
  }, [onNodeClick, label, id]);

  return (
    <Box
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: '5px',
        padding: '10px',
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        fontWeight: hasChildren ? 'bold' : 'normal',
      }}
      onClick={handleNodeClick}
    >
      <Handle type="target" position={Position.Left} />
      <Typography variant="body2" sx={{ mr: 1 }}>{label}</Typography>
      {hasChildren && (
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}>
          {isCollapsed ? <AddCircleOutlineIcon fontSize="small" /> : <RemoveCircleOutlineIcon fontSize="small" />}
        </IconButton>
      )}
      <Handle type="source" position={Position.Right} />
    </Box>
  );
};

const MindmapFlow = ({ nodes, edges, onNodesChange, onEdgesChange, onConnect, nodeTypes, fullMindmapData, buildReactFlowElements, isMindmapFullscreen, setIsMindmapFullscreen, setNodes, setEdges }) => {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (fullMindmapData) {
      const { rfNodes, rfEdges } = buildReactFlowElements(fullMindmapData);
      setNodes(rfNodes);
      setEdges(rfEdges);
    }
  }, [fullMindmapData, buildReactFlowElements, fitView, setNodes, setEdges]);

  useEffect(() => {
    const resizeHandler = () => {
      try {
        fitView({ duration: 400, padding: 0.2 });
      } catch (e) {
        console.warn("fitView warning suppressed:", e);
      }
    };

    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
    >
      <Controls />
      <Background variant="dots" gap={12} size={1} />
    </ReactFlow>
  );
};

function Studio({ isOpen, togglePanel, sessionPdfContent, onMindmapQuery, currentSessionId, initialMindmapData, documentId }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMindmap, setShowMindmap] = useState(false);
  const [fullMindmapData, setFullMindmapData] = useState(null);
  const [isMindmapFullscreen, setIsMindmapFullscreen] = useState(false);
  const { showError, showSuccess, showInfo } = useNotification();

  const [quizLoading, setQuizLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);

  const [quizOpen, setQuizOpen] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);
  const [sessionNotes, setSessionNotes] = useState([]);

  // Global menu states
  const [quizMenuAnchor, setQuizMenuAnchor] = useState(null);
  const [notesMenuAnchor, setNotesMenuAnchor] = useState(null);

  // Node menu states
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const nodeMenuOpen = Boolean(anchorEl);

  // Node menu sub-menu states
  const [nodeQuizMenuAnchor, setNodeQuizMenuAnchor] = useState(null);
  const [nodeNotesMenuAnchor, setNodeNotesMenuAnchor] = useState(null);

  const nodeTypes = useMemo(() => ({
    customMindmapNode: CustomMindmapNode,
  }), []);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onNodeClickHandler = useCallback((event, nodeData) => {
    setAnchorEl(event.currentTarget);
    setSelectedNode(nodeData);
  }, []);

  const handleNodeMenuClose = () => {
    setAnchorEl(null);
    setSelectedNode(null);
    setNodeQuizMenuAnchor(null);
    setNodeNotesMenuAnchor(null);
  };

  const handleGlobalQuizClick = (event) => setQuizMenuAnchor(event.currentTarget);
  const handleGlobalNotesClick = (event) => setNotesMenuAnchor(event.currentTarget);
  const handleGlobalMenuClose = () => {
    setQuizMenuAnchor(null);
    setNotesMenuAnchor(null);
  };

  const handleNodeQuizClick = (event) => setNodeQuizMenuAnchor(event.currentTarget);
  const handleNodeNotesClick = (event) => setNodeNotesMenuAnchor(event.currentTarget);

  const getRecursiveNodeContent = (node, labels = []) => {
    if (!node) return labels;
    labels.push(node.label);
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => getRecursiveNodeContent(child, labels));
    }
    return labels;
  };

  const handleAskAI = () => {
    if (!selectedNode) return;
    
    const clickedNode = findNodeInFullData(fullMindmapData, selectedNode.id, true);
    let parentNodeLabel = "";

    if (clickedNode && clickedNode.parentId) {
      const parentNode = findNodeInFullData(fullMindmapData, clickedNode.parentId, true);
      if (parentNode) {
        parentNodeLabel = parentNode.label;
      }
    }

    const query = `Discuss what these sources say about ${selectedNode.label}${parentNodeLabel ? `, in the larger context of ${parentNodeLabel}` : ""}`;
    
    if (isMindmapFullscreen) {
      setIsMindmapFullscreen(false);
    }
    
    onMindmapQuery(query);
    handleNodeMenuClose();
  };

  const handleNodeQuiz = async (difficulty) => {
    if (!selectedNode || !currentSessionId) return;
    
    const node = findNodeInFullData(fullMindmapData, selectedNode.id, true);
    const contentLabels = getRecursiveNodeContent(node);
    const contextText = `Generate a ${difficulty} difficulty quiz focusing on: ${contentLabels.join(", ")}. Use the main document as the source material.`;
    
    showInfo(`Generating ${difficulty} quiz for ${selectedNode.label}...`);
    handleNodeMenuClose();
    await handleGenerateQuiz(contextText, `Quiz (${difficulty}): ${selectedNode.label}`, difficulty);
  };

  const handleNodeNotes = async (style) => {
    if (!selectedNode || !currentSessionId) return;
    
    const node = findNodeInFullData(fullMindmapData, selectedNode.id, true);
    const contentLabels = getRecursiveNodeContent(node);
    const contextText = `Generate ${style} notes focusing on: ${contentLabels.join(", ")}. Use the main document as the source material.`;
    
    showInfo(`Generating ${style} notes for ${selectedNode.label}...`);
    handleNodeMenuClose();
    await handleGenerateSessionNotes(contextText, `Notes (${style}): ${selectedNode.label}`, style);
  };

  const findNodeInFullData = (data, identifier, searchById = false) => {
    if (!data) return null;
    let foundNode = null;
    const search = (nodesArray) => {
      for (const node of nodesArray) {
        if ((searchById && node.id === identifier) || (!searchById && node.label === identifier)) {
          foundNode = node;
          return;
        }
        if (node.children) {
          search(node.children);
        }
      }
    };
    search(data.nodes);
    return foundNode;
  };

  const toggleNodeCollapse = useCallback((nodeId) => {
    setFullMindmapData(prevData => {
      if (!prevData) return prevData;

      const newNodes = JSON.parse(JSON.stringify(prevData.nodes));
      const toggle = (nodesArray) => {
        for (const node of nodesArray) {
          if (node.id === nodeId) {
            node.isCollapsed = !node.isCollapsed;
            return true;
          }
          if (node.children && toggle(node.children)) {
            return true;
          }
        }
        return false;
      };

      toggle(newNodes);
      return { ...prevData, nodes: newNodes };
    });
  }, []);

  const buildReactFlowElements = useCallback((data) => {
    const rfNodes = [];
    const rfEdges = [];
    const nodeWidth = 250;
    const nodeHeight = 70;
    const horizontalGap = 50;
    const verticalGap = 30;

    const layoutTree = (node, x, y, level, parentId = null, parentIsCollapsed = false) => {
      if (!node) return 0;

      const shouldRenderNode = !parentIsCollapsed;

      if (shouldRenderNode) {
        rfNodes.push({
          id: node.id,
          type: 'customMindmapNode',
          data: {
            label: node.label,
            hasChildren: node.children && node.children.length > 0,
            isCollapsed: node.isCollapsed,
            onToggleCollapse: () => toggleNodeCollapse(node.id),
            onNodeClick: onNodeClickHandler,
          },
          position: { x: x, y: y },
        });

        if (parentId) {
          rfEdges.push({
            id: `${parentId}-${node.id}`,
            source: parentId,
            target: node.id,
            animated: true,
          });
        }
      }

      let currentY = y + nodeHeight + verticalGap;
      let totalChildrenHeight = 0;

      if (node.children && !node.isCollapsed) {
        node.children.forEach(child => {
          const childHeight = layoutTree(child, x + nodeWidth + horizontalGap, currentY, level + 1, node.id, node.isCollapsed);
          currentY += childHeight;
          totalChildrenHeight += childHeight;
        });
      }

      return shouldRenderNode ? Math.max(nodeHeight + verticalGap, totalChildrenHeight) : 0;
    };

    if (data && data.nodes) {
      let currentYOffset = 0;
      data.nodes.forEach(node => {
        const branchHeight = layoutTree(node, 0, currentYOffset, 0);
        currentYOffset += branchHeight;
      });
    }
    return { rfNodes, rfEdges };
  }, [onNodeClickHandler, toggleNodeCollapse]);

  useEffect(() => {
    if (fullMindmapData) {
      const { rfNodes, rfEdges } = buildReactFlowElements(fullMindmapData);
      setNodes(rfNodes);
      setEdges(rfEdges);
    }
  }, [fullMindmapData, buildReactFlowElements]);

  useEffect(() => {
    if (initialMindmapData) {
      setFullMindmapData(initialMindmapData);
    } else {
      setFullMindmapData(null);
      setShowMindmap(false);
    }
  }, [initialMindmapData]);

  const generateMindmap = async () => {
    if (!currentSessionId) {
      showError("Please select or create a session first.");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/generate-mindmap', {
        fullText: sessionPdfContent,
        session_id: currentSessionId,
      }, { withCredentials: true, timeout: 120000 });

      const mindmapData = response.data;
      const initializeCollapseState = (nodesArray, level = 0, parentId = null) => {
        nodesArray.forEach(node => {
          node.isCollapsed = level > 0;
          node.parentId = parentId;
          if (node.children) {
            initializeCollapseState(node.children, level + 1, node.id);
          }
        });
      };
      initializeCollapseState(mindmapData.nodes);
      setFullMindmapData(mindmapData);
      setShowMindmap(true);
      showSuccess('Mind map generated successfully!');

    } catch (error) {
      console.error("Error generating mind map:", error);
      showError('An error occurred while generating the mind map.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuiz = async (customText = null, customTitle = null, difficulty = 'Normal') => {
    if (!currentSessionId) {
      showError("Please select a session first.");
      return;
    }
    setQuizLoading(true);
    try {
      const response = await axios.post(`http://localhost:5000/api/sessions/${currentSessionId}/generate_quiz`, 
        { 
          difficulty: difficulty,
          custom_text: customText,
          custom_title: customTitle
        },
        { withCredentials: true }
      );
      setCurrentQuiz(response.data);
      setQuizOpen(true);
      showSuccess("Quiz generated successfully!");
      fetchQuizHistory(); // Refresh history
    } catch (error) {
      console.error("Error generating quiz:", error);
      showError("Failed to generate quiz.");
    } finally {
      setQuizLoading(false);
    }
  };

  const fetchQuizHistory = useCallback(async () => {
    if (currentSessionId) {
      try {
        const response = await axios.get(`http://localhost:5000/api/sessions/${currentSessionId}/quizzes`, { withCredentials: true });
        setQuizHistory(response.data);
      } catch (error) {
        console.error("Error fetching quiz history:", error);
      }
    }
  }, [currentSessionId]);

  const fetchSessionNotes = useCallback(async () => {
    if (currentSessionId) {
      try {
        const response = await axios.get(`http://localhost:5000/api/sessions/${currentSessionId}/notes`, { withCredentials: true });
        setSessionNotes(response.data);
      } catch (error) {
        console.error("Error fetching session notes:", error);
      }
    }
  }, [currentSessionId]);

  useEffect(() => {
    fetchQuizHistory();
    fetchSessionNotes();
  }, [fetchQuizHistory, fetchSessionNotes]);

  const handleGenerateSessionNotes = async (customText = null, customTitle = null, style = 'concise') => {
    if (!currentSessionId) {
      showError("Please select a session first.");
      return;
    }
    if (!sessionPdfContent && !customText) {
      showError("No document content available in this session to generate notes from.");
      return;
    }
    setNotesLoading(true);
    try {
      const response = await axios.post(`http://localhost:5000/api/sessions/${currentSessionId}/generate_notes`, 
        { 
          style: style,
          custom_text: customText,
          custom_title: customTitle
        },
        { withCredentials: true, timeout: 120000 }
      );
      showSuccess("Session notes generated successfully!");
      fetchSessionNotes(); // Refresh session notes
    } catch (error) {
      console.error("Error generating session notes:", error);
      showError("Failed to generate session notes.");
    } finally {
      setNotesLoading(false);
    }
  };

  const handleQuizSubmit = async (answers) => {
    if (!currentQuiz) return;

    setQuizLoading(true);
    try {
      const response = await axios.post(`http://localhost:5000/api/quizzes/${currentQuiz.id}/submit`, 
        { answers },
        { withCredentials: true }
      );
      showSuccess(`Quiz submitted! Your score: ${response.data.score.toFixed(2)}%`);
      return response.data;
    } catch (error) {
      console.error("Error submitting quiz:", error);
      showError("Failed to submit quiz.");
    } finally {
      setQuizLoading(false);
    }
  };

  return (
    <Box
      sx={{
        height: 'calc(100vh - 140px)',
        overflowY: 'auto',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        width: isOpen ? 'auto' : '50px',
        transition: 'width 0.3s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOpen ? 'flex-start' : 'center',
      }}
    >
      <Box sx={{
        display: 'flex',
        justifyContent: isOpen ? 'space-between' : 'center',
        alignItems: 'center',
        p: 1,
        borderBottom: '1px solid #e0e0e0',
        width: '100%',
      }}>
        {isOpen && <Typography variant="h6" sx={{ pl: 1 }}>Studio</Typography>}
        <Tooltip title={isOpen ? "Collapse Studio" : "Expand Studio"} placement="left">
          <IconButton onClick={togglePanel} size="small">
            {isOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      {isOpen && (
        <Paper elevation={3} sx={{ flexGrow: 1, p: 2, width: '100%', height: '100%' }}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => generateMindmap()}
            disabled={loading || !sessionPdfContent}
            sx={{ mb: 1 }}
          >
            {loading ? 'Generating...' : 'Generate Mind Map'}
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={handleGlobalQuizClick}
            disabled={quizLoading || !documentId}
            sx={{ mb: 1 }}
          >
            {quizLoading ? 'Generating...' : 'Generate Quiz'}
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={handleGlobalNotesClick}
            disabled={loading || !sessionPdfContent || notesLoading}
            sx={{ mb: 1 }}
          >
            {notesLoading ? 'Generating...' : 'Generate Session Notes'}
          </Button>

          {/* Global Quiz Menu */}
          <Menu anchorEl={quizMenuAnchor} open={Boolean(quizMenuAnchor)} onClose={handleGlobalMenuClose}>
            <MenuItem onClick={() => { handleGenerateQuiz(null, null, 'Easy'); handleGlobalMenuClose(); }}>Easy</MenuItem>
            <MenuItem onClick={() => { handleGenerateQuiz(null, null, 'Normal'); handleGlobalMenuClose(); }}>Normal</MenuItem>
            <MenuItem onClick={() => { handleGenerateQuiz(null, null, 'Hard'); handleGlobalMenuClose(); }}>Hard</MenuItem>
          </Menu>

          {/* Global Notes Menu */}
          <Menu anchorEl={notesMenuAnchor} open={Boolean(notesMenuAnchor)} onClose={handleGlobalMenuClose}>
            <MenuItem onClick={() => { handleGenerateSessionNotes(null, null, 'concise'); handleGlobalMenuClose(); }}>Concise</MenuItem>
            <MenuItem onClick={() => { handleGenerateSessionNotes(null, null, 'detailed'); handleGlobalMenuClose(); }}>Detailed</MenuItem>
            <MenuItem onClick={() => { handleGenerateSessionNotes(null, null, 'bullet points'); handleGlobalMenuClose(); }}>Bullet Points</MenuItem>
          </Menu>

          {fullMindmapData && (
            <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                sx={{ flexGrow: 1 }}
                onClick={() => setShowMindmap(!showMindmap)}
              >
                {showMindmap ? 'Hide Mind Map' : 'Show Mind Map'}
              </Button>
              {showMindmap && (
                <Button
                  variant="outlined"
                  sx={{ flexGrow: 1 }}
                  onClick={() => setIsMindmapFullscreen(true)}
                  startIcon={<FullscreenIcon />}
                >
                  Fullscreen
                </Button>
              )}
            </Box>
          )}

          {showMindmap && fullMindmapData && (
            <Box sx={{ width: '100%', flexGrow: 1, border: '1px solid #eee', mt: 2, height: '100%', overflow: 'hidden', position: 'relative' }}>
              <ReactFlowProvider>
                <MindmapFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  nodeTypes={nodeTypes}
                  fullMindmapData={fullMindmapData}
                  buildReactFlowElements={buildReactFlowElements}
                  isMindmapFullscreen={isMindmapFullscreen}
                  setIsMindmapFullscreen={setIsMindmapFullscreen}
                  setNodes={setNodes}
                  setEdges={setEdges}
                />
              </ReactFlowProvider>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>Quiz History</Typography>
          <List dense>
            {quizHistory.length > 0 ? (
              quizHistory.map((quiz) => (
                <ListItem 
                  key={quiz.id}
                  button 
                  onClick={() => {
                    setCurrentQuiz(quiz);
                    setQuizOpen(true);
                  }}
                >
                  <ListItemText 
                    primary={quiz.quiz_data.title || `Quiz from ${new Date(quiz.generated_at).toLocaleDateString()}`}
                    secondary={`Difficulty: ${quiz.difficulty}`}
                  />
                </ListItem>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">No quizzes generated for this document yet.</Typography>
            )}
          </List>

          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>Session Notes</Typography>
          <List dense>
            {sessionNotes.length > 0 ? (
              sessionNotes.map((note) => (
                <ListItem 
                  key={note.id}
                  button 
                  onClick={() => window.open(note.pdf_url, '_blank')}
                >
                  <ListItemText 
                    primary={note.title || `Notes from ${new Date(note.created_at).toLocaleDateString()}`}
                    secondary="Click to Download PDF"
                  />
                </ListItem>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">No session notes generated yet.</Typography>
            )}
          </List>

        </Paper>
      )}

      <Menu
        anchorEl={anchorEl}
        open={nodeMenuOpen}
        onClose={handleNodeMenuClose}
      >
        <MenuItem onClick={handleAskAI}>Ask AI</MenuItem>
        <MenuItem onClick={handleNodeQuizClick}>Gen Quiz ▶</MenuItem>
        <MenuItem onClick={handleNodeNotesClick}>Gen Notes ▶</MenuItem>
      </Menu>

      {/* Node Quiz Sub-menu */}
      <Menu
        anchorEl={nodeQuizMenuAnchor}
        open={Boolean(nodeQuizMenuAnchor)}
        onClose={() => setNodeQuizMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => handleNodeQuiz('Easy')}>Easy</MenuItem>
        <MenuItem onClick={() => handleNodeQuiz('Normal')}>Normal</MenuItem>
        <MenuItem onClick={() => handleNodeQuiz('Hard')}>Hard</MenuItem>
      </Menu>

      {/* Node Notes Sub-menu */}
      <Menu
        anchorEl={nodeNotesMenuAnchor}
        open={Boolean(nodeNotesMenuAnchor)}
        onClose={() => setNodeNotesMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => handleNodeNotes('concise')}>Concise</MenuItem>
        <MenuItem onClick={() => handleNodeNotes('detailed')}>Detailed</MenuItem>
        <MenuItem onClick={() => handleNodeNotes('bullet points')}>Bullet Points</MenuItem>
      </Menu>

      <Dialog
        fullScreen
        open={isMindmapFullscreen}
        onClose={() => setIsMindmapFullscreen(false)}
      >
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
            <IconButton onClick={() => setIsMindmapFullscreen(false)}>
              <FullscreenExitIcon />
            </IconButton>
          </Box>
          <Box sx={{ flexGrow: 1, width: '100%', height: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }}>
            <ReactFlowProvider>
              <MindmapFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fullMindmapData={fullMindmapData}
                buildReactFlowElements={buildReactFlowElements}
                isMindmapFullscreen={isMindmapFullscreen}
                setIsMindmapFullscreen={setIsMindmapFullscreen}
                setNodes={setNodes}
                setEdges={setEdges}
              />
            </ReactFlowProvider>
          </Box>
        </DialogContent>
      </Dialog>

      <QuizView
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
        quizData={currentQuiz}
        onSubmit={handleQuizSubmit}
        loading={quizLoading}
      />
    </Box>
  );
}

export default Studio;