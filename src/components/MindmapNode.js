import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Button } from '@mui/material';

const MindmapNode = ({ id, data, onExpandCollapse }) => {
  const { label, children, isExpanded } = data;

  const handleExpandCollapse = () => {
    onExpandCollapse(id);
  };

  return (
    <div style={{ padding: 10, border: '1px solid #777', borderRadius: 5, background: 'white' }}>
      <div>{label}</div>
      {children && children.length > 0 && (
        <Button onClick={handleExpandCollapse} size="small">
          {isExpanded ? '-' : '+'}
        </Button>
      )}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

export default memo(MindmapNode);
