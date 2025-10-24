import React, { useState } from 'react';
import { Button, List, ListItem, ListItemText, Typography } from '@mui/material';
import axios from 'axios';

function DocumentList({ onMainPointClick }) {
  const [files, setFiles] = useState([]); // Each item will be { file: File, summary: string }

  const uploadAndSummarize = async (fileToUpload) => {
    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data; // Return the full response data including summary and fullText
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleFileChange = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    for (const file of selectedFiles) {
      // Optimistically add file to list with a "Summarizing..." placeholder and initial fullText
      setFiles(prevFiles => [...prevFiles, { file: file, summary: "Summarizing...", fullText: "" }]);

      const summary = await uploadAndSummarize(file);
      if (summary) {
        setFiles(prevFiles =>
          prevFiles.map(item =>
            item.file === file ? { ...item, summary: summary.summary, fullText: summary.fullText } : item
          )
        );
      } else {
        // If summary fails, update the placeholder to an error message
        setFiles(prevFiles =>
          prevFiles.map(item =>
            item.file === file ? { ...item, summary: "Failed to summarize." } : item
          )
        );
      }
    }
  };

  return (
    <div>
      <Typography variant="h6">Documents</Typography>
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="upload-button"
      />
      <label htmlFor="upload-button">
        <Button variant="contained" component="span">
          Upload Files
        </Button>
      </label>
      <List>
        {files.map((item, index) => (
          <ListItem key={index}>
            <ListItemText primary={item.file.name} />
            {Array.isArray(item.summary) ? (
              <List dense disablePadding>
                {item.summary.map((point, idx) => (
                  <ListItem
                    key={idx}
                    sx={{ pl: 4 }}
                    button // Make it clickable
                    onClick={() => onMainPointClick(item.fullText, point)} // Pass full text and specific point
                  >
                    <ListItemText secondary={`- ${point}`} />
                  </ListItem>
                ))}
              </List>
            ) : (
              <ListItemText secondary={item.summary} />
            )}
          </ListItem>
        ))}
      </List>
    </div>
  );
}

export default DocumentList;