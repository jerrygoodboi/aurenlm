import React, { useState, useCallback } from 'react';
import { Paper, Typography, Box, IconButton, Tooltip, Button, Dialog, AppBar, Toolbar } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import ReactFlow, { addEdge, applyEdgeChanges, applyNodeChanges, Controls, Background, ReactFlowProvider } from 'reactflow';
import MindmapNode from './MindmapNode';
import axios from 'axios';

function MindmapDialog({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onClose, onNodeClick, onExpandCollapse }) {
  const onNodeClickHandler = useCallback((event, node) => {
    const clickedNodeLabel = node.data.label;

    const query = `Discuss what these sources say ${clickedNodeLabel}`;
    onNodeClick(query);
  }, [onNodeClick]);

  const nodeTypes = { mindmapNode: (props) => <MindmapNode {...props} onExpandCollapse={onExpandCollapse} /> };

  return (
    <Dialog
      fullScreen
      open={true}
      onClose={onClose}
      PaperProps={{
        sx: { width: '100%', height: '100%', m: 0, maxWidth: 'none', maxHeight: 'none' }
      }}
    >
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onClose}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Mind Map
          </Typography>
        </Toolbar>
      </AppBar>
      <ReactFlowProvider>
        <Box sx={{ width: '100%', height: 'calc(100vh - 64px)' }}>
          <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClickHandler}
              fitView
              nodeTypes={nodeTypes}
              onError={(id, message) => {
                if (message.includes('ResizeObserver')) {
                  return;
                }
              }}
            >
              <Controls />
              <Background variant="dots" gap={12} size={1} />
            </ReactFlow>
          </div>
        </Box>
      </ReactFlowProvider>
    </Dialog>
  );
}

function Studio({ isOpen, togglePanel, sessionPdfContent, onMindmapQuery }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMindmapModal, setShowMindmapModal] = useState(false);
  const [error, setError] = useState(null);
  const [mindmapGenerated, setMindmapGenerated] = useState(false);

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

  const onExpandCollapse = (nodeId) => {
    setNodes((nds) => {
      const newNodes = nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              isExpanded: !n.data.isExpanded,
            },
          };
        }
        return n;
      });

      return newNodes.map((n) => {
        if (n.id.startsWith(`${nodeId}.`)) {
          return {
            ...n,
            hidden: !n.hidden,
          };
        }
        return n;
      });
    });

    setEdges((eds) =>
      eds.map((e) => {
        if (e.source === nodeId) {
          return {
            ...e,
            hidden: !e.hidden,
          };
        }
        return e;
      })
    );
  };

  const generateMindmap = async () => {
    if (mindmapGenerated) {
      setShowMindmapModal(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('http://localhost:5000/generate-mindmap', {
        fullText: sessionPdfContent,
      });

      const mindmapData = response.data;
      console.log("Mindmap data from backend:", mindmapData);

      if (mindmapData.error) {
        setError(mindmapData.error);
        return;
      }

      const initialNodes = [];
      const initialEdges = [];
      let y = 0;

      function traverse(node, parentId = null, level = 0) {
        if (!node) return;

        const nodeId = node.id;
        initialNodes.push({
          id: nodeId,
          data: { 
            label: node.label,
            children: node.children,
            isExpanded: level === 0, // Only expand the root nodes
          },
          position: { x: level * 250, y: y },
          type: 'mindmapNode',
        });

        if (parentId) {
          initialEdges.push({ id: `${parentId}-${nodeId}`, source: parentId, target: nodeId, animated: true, hidden: !node.isExpanded });
        }

        y += 100;

        if (node.children && node.children.length > 0) {
          node.children.forEach(child => traverse(child, nodeId, level + 1));
        }
      }

      mindmapData.nodes.forEach(node => traverse(node));

      setNodes(initialNodes);
      setEdges(initialEdges);
      setShowMindmapModal(true); // Open the modal after successful generation
      setMindmapGenerated(true);

    } catch (error) {
      console.error("Error generating mind map:", error);
      setError("Error generating mind map. Please try again later.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box 
      sx={{
        height: 'calc(100vh - 140px)',
        overflowY: 'auto',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        width: isOpen ? '300px' : '50px', // Fixed width when collapsed
        transition: 'width 0.3s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOpen ? 'flex-start' : 'center',
        flexShrink: 0,
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
        <Paper elevation={3} sx={{ flexGrow: 1, p: 2, width: '100%' }}>
          <Button 
            variant="contained" 
            onClick={generateMindmap} 
            disabled={loading || !sessionPdfContent}
          >
            {loading ? 'Generating...' : 'Generate Mind Map'}
          </Button>
          {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
          {showMindmapModal && (
            <MindmapDialog
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onClose={() => setShowMindmapModal(false)}
              onNodeClick={onMindmapQuery}
              onExpandCollapse={onExpandCollapse}
            />
          )}
        </Paper>
      )}
    </Box>
  );
}

export default Studio;