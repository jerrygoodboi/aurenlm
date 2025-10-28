import React, { useState, useCallback } from 'react';
import { Paper, Typography, Box, IconButton, Tooltip, Button } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ReactFlow, { addEdge, applyEdgeChanges, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';

function Studio({ isOpen, togglePanel, sessionPdfContent }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const generateMindmap = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/generate-mindmap', {
        fullText: sessionPdfContent,
      });

      const mindmapData = response.data;
      console.log("Mindmap data from backend:", mindmapData);

      const initialNodes = [];
      const initialEdges = [];
      let y = 0;

      function traverse(node, parentId = null, level = 0) {
        if (!node) return;

        const nodeId = node.id;
        initialNodes.push({
          id: nodeId,
          data: { label: node.label },
          position: { x: level * 250, y: y },
          type: node.type === 'main' ? 'input' : 'default',
        });

        if (parentId) {
          initialEdges.push({ id: `${parentId}-${nodeId}`, source: parentId, target: nodeId, animated: true });
        }

        y += 100;

        if (node.children && node.children.length > 0) {
          node.children.forEach(child => traverse(child, nodeId, level + 1));
        }
      }

      mindmapData.nodes.forEach(node => traverse(node));

      setNodes(initialNodes);
      setEdges(initialEdges);

    } catch (error) {
      console.error("Error generating mind map:", error);
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
        width: isOpen ? 'auto' : '50px', // Fixed width when collapsed
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
        <Paper elevation={3} sx={{ flexGrow: 1, p: 2, width: '100%' }}>
          <Button 
            variant="contained" 
            onClick={generateMindmap} 
            disabled={loading || !sessionPdfContent}
          >
            {loading ? 'Generating...' : 'Generate Mind Map'}
          </Button>
          <Box sx={{ height: '100%', mt: 2 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
            >
            </ReactFlow>
          </Box>
        </Paper>
      )}
    </Box>
  );
}

export default Studio;