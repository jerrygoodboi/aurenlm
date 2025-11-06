import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Box,
  CircularProgress,
} from '@mui/material';

const QuizView = ({ open, onClose, quizData, onSubmit, loading }) => {
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setAnswers({});
      setResults(null);
      setSubmitted(false);
    }
  }, [open]);

  const handleAnswerChange = (questionIndex, answer) => {
    setAnswers({
      ...answers,
      [questionIndex]: answer,
    });
  };

  const handleSubmit = async () => {
    const resultData = await onSubmit(answers);
    if (resultData) {
      setResults(resultData);
      setSubmitted(true);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setResults(null);
    setSubmitted(false);
  };

  if (!quizData) {
    return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>Quiz</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{quizData?.quiz_data?.title || 'Quiz'}</DialogTitle>
      <DialogContent dividers>
        {submitted && results && (
          <Box sx={{ mb: 2, p: 2, backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
            <Typography variant="h6">Results</Typography>
            <Typography variant="body1">{`Your score: ${results.score.toFixed(2)}% (${results.correct_answers}/${results.total_questions})`}</Typography>
          </Box>
        )}
        {quizData?.quiz_data?.questions?.map((q, index) => {
          const isCorrect = submitted && results && results.correct_answers_map[index] === answers[index];
          const isIncorrect = submitted && results && results.correct_answers_map[index] !== answers[index];

          return (
            <FormControl component="fieldset" key={index} sx={{ mb: 3, width: '100%' }} disabled={submitted}>
              <FormLabel component="legend">
                <Typography variant="h6">{`${index + 1}. ${q.question}`}</Typography>
              </FormLabel>
              <RadioGroup
                aria-label={`question-${index}`}
                name={`question-${index}`}
                value={answers[index] || ''}
                onChange={(e) => handleAnswerChange(index, e.target.value)}
              >
                {q.options.map((option, i) => {
                  const labelStyle = {};
                  if (submitted && results) {
                    if (option === results.correct_answers_map[index]) {
                      labelStyle.color = 'green';
                    } else if (option === answers[index] && option !== results.correct_answers_map[index]) {
                      labelStyle.color = 'red';
                    }
                  }

                  return (
                    <FormControlLabel 
                      key={i} 
                      value={option} 
                      control={<Radio />} 
                      label={<Typography style={labelStyle}>{option}</Typography>} 
                    />
                  );
                })}
              </RadioGroup>
              {isIncorrect && (
                <Typography variant="body2" sx={{ color: 'green', mt: 1 }}>
                  Correct answer: {results.correct_answers_map[index]}
                </Typography>
              )}
            </FormControl>
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {submitted ? (
          <Button onClick={handleRetake} variant="contained" color="secondary">
            Retake Quiz
          </Button>
        ) : (
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Submit'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default QuizView;