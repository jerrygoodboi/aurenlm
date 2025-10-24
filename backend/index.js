import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const port = 3001;
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// Initialize Gemini / Google Generative AI
const API_KEY = 'AIzaSyCG22aB1LmOdAt93vqgDeR4qY8De8jTing';
const genAI = new GoogleGenerativeAI({ apiKey: API_KEY, apiVersion: 'v1' });
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ---------- FILE UPLOAD & PARSING ----------
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  try {
    const fileBuffer = fs.readFileSync(req.file.path);

    let text = "";
    if (req.file.mimetype === "application/pdf") {
      const parser = new PDFParse({ data: fileBuffer });
      const data = await parser.getText();
      text = data.text;
    } else {
      text = fileBuffer.toString();
    }

    fs.unlinkSync(req.file.path); // clean up

    // ---------- Generate structured summary ----------
    const prompt = `Please extract and return the main content from the following text.

Text:
${text}
    `;

    const result = await model.generateContent(prompt);
    const summaryText = result.response.text();

    res.json({ summary: summaryText });
  } catch (err) {
    console.error("Error processing file:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- GENERAL COMPLETION ENDPOINT ----------
app.post("/completion", async (req, res) => {
  const { prompt, pdfContent } = req.body;
  if (!prompt) return res.status(400).json({ message: "No prompt provided" });

  let fullPrompt = prompt;
  if (pdfContent) {
    fullPrompt = `Given the following document content:\n${pdfContent}\n\n${prompt}`;
  }

  try {
    const result = await model.generateContent(fullPrompt);
    const content = result.response.text();
    res.json({ content });
  } catch (err) {
    console.error("Error getting completion:", err);
    res.status(500).json({ message: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend server listening at http://localhost:${port}`);
});

