import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Paper, Typography, Box, IconButton, Tooltip, Button } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ReactFlow, { addEdge, applyEdgeChanges, applyNodeChanges, Controls, Background, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { useTheme } from '@mui/material/styles';

// Custom Node Component for ReactFlow
const CustomMindmapNode = ({ data }) => {
  const { label, hasChildren, isCollapsed, onToggleCollapse, onNodeClick } = data;
  const theme = useTheme();

  const handleNodeClick = useCallback(() => {
    onNodeClick(label); // Pass the label of the clicked node
  }, [onNodeClick, label]);

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

function Studio({ isOpen, togglePanel, sessionPdfContent, onMindmapQuery }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMindmap, setShowMindmap] = useState(false); // Controls visibility of the mindmap section
  const [fullMindmapData, setFullMindmapData] = useState(null); // Stores the full hierarchical data

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

  const onNodeClickHandler = useCallback((clickedNodeLabel) => {
    // This function is now called from CustomMindmapNode with the label directly
    // We need to find the full node data to get parent context if needed
    const clickedNode = findNodeInFullData(fullMindmapData, clickedNodeLabel);
    let parentNodeLabel = "";

    if (clickedNode && clickedNode.parentId) {
      const parentNode = findNodeInFullData(fullMindmapData, clickedNode.parentId);
      if (parentNode) {
        parentNodeLabel = parentNode.label;
      }
    }

    const query = `Discuss what these sources say about ${clickedNodeLabel}${parentNodeLabel ? `, in the larger context of ${parentNodeLabel}` : ""}`;
    onMindmapQuery(query);
  }, [fullMindmapData, onMindmapQuery]);

  // Helper to find a node in the fullMindmapData by its label or ID
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

      const newNodes = JSON.parse(JSON.stringify(prevData.nodes)); // Deep copy
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
    const nodePositions = {}; // To store calculated positions

    let currentY = 0;

    const traverseAndBuild = (node, parentId = null, level = 0, parentIsCollapsed = false) => {
      if (!node) return;

      // A node is rendered if its parent is not collapsed.
      // The `isCollapsed` property on the node data will be used by the CustomMindmapNode to show/hide children.
      const shouldRenderNode = !parentIsCollapsed;

      if (shouldRenderNode) {
        const xPosition = level * 250; // X position based on level
        const yPosition = currentY; // Use currentY for Y position

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
          position: { x: xPosition, y: yPosition },
        });
        nodePositions[node.id] = { x: xPosition, y: yPosition };

        if (parentId) {
          rfEdges.push({
            id: `${parentId}-${node.id}`,
            source: parentId,
            target: node.id,
            animated: true,
          });
        }
        currentY += 70; // Increment Y for the next node
      }

      // Recursively call for children only if the current node is not collapsed
      if (node.children && !node.isCollapsed) {
        node.children.forEach(child => traverseAndBuild(child, node.id, level + 1, node.isCollapsed));
      }
    };

    if (data && data.nodes) {
      data.nodes.forEach(node => traverseAndBuild(node, null, 0, false)); // Initial call for top-level nodes
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


  const generateMindmap = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/generate-mindmap', {
        fullText: sessionPdfContent,
      });

      const mindmapData = response.data;
      console.log("Mindmap data from backend:", mindmapData);

      // Initialize isCollapsed state and parentId for all nodes
      const initializeCollapseState = (nodesArray, level = 0, parentId = null) => {
        nodesArray.forEach(node => {
          node.isCollapsed = level > 0; // Collapse all but top-level nodes initially
          node.parentId = parentId; // Set parentId
          if (node.children) {
            initializeCollapseState(node.children, level + 1, node.id);
          }
        });
      };
      initializeCollapseState(mindmapData.nodes);
      setFullMindmapData(mindmapData); // Store the full data with collapse state
      setShowMindmap(true); // Show the mindmap section

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
        <Paper elevation={3} sx={{ flexGrow: 1, p: 2, width: '100%', height: '100%' }}>
          <Button
            variant="contained"
            onClick={generateMindmap}
            disabled={loading || !sessionPdfContent}
            sx={{ mb: 2 }}
          >
            {loading ? 'Generating...' : 'Generate Mind Map'}
          </Button>

          {fullMindmapData && (
            <Box sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setShowMindmap(!showMindmap)}
              >
                {showMindmap ? 'Hide Mind Map' : 'Show Mind Map'}
              </Button>
            </Box>
          )}

          {showMindmap && fullMindmapData && (
            <Box sx={{ width: '100%', flexGrow: 1, border: '1px solid #eee', mt: 2, height: '100%' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
              >
                <Controls />
                <Background variant="dots" gap={12} size={1} />
              </ReactFlow>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}

export default Studio;