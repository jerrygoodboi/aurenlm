import React, { useState } from 'react';
import { Button, List, ListItem, ListItemText, Typography } from '@mui/material';
import axios from 'axios';

function DocumentList() {
  const [files, setFiles] = useState([]);

  const handleFileChange = (event) => {
    const newFiles = Array.from(event.target.files);
    setFiles([...files, ...newFiles]);
    handleUpload(newFiles);
  };

  const handleUpload = async (filesToUpload) => {
    const formData = new FormData();
    filesToUpload.forEach(file => {
      formData.append('file', file);
    });

    try {
      await axios.post('http://localhost:3001/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('Files uploaded successfully');
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const handleSummarize = async (file) => {
    try {
      const response = await axios.post('http://localhost:3001/summarize', { fileName: file.name });
      alert(`Summary for ${file.name}:\n\n${response.data.summary}`);
    } catch (error) {
      console.error('Error summarizing file:', error);
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
        {files.map((file, index) => (
          <ListItem key={index}>
            <ListItemText primary={file.name} />
            <Button onClick={() => handleSummarize(file)}>Summarize</Button>
          </ListItem>
        ))}
      </List>
    </div>
  );
}

export default DocumentList;