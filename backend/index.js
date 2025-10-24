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
const API_KEY = 'AIzaSyDs6994LIi8-qPzoA1N62qM4msrSuZleSY';
const genAI = new GoogleGenerativeAI({ apiKey: API_KEY, apiVersion: 'v1' });
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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
    const prompt = `
Summarize the following text into a structured JSON array. 
Each item should have "heading" and "content" keys. 
Try to break the text into meaningful subheadings, bullet points, or sections. 
Respond ONLY with JSON.

Text:
${text}
    `;

    const result = await model.generateContent(prompt);
    const summaryText = result.response.text();

    // Try to parse JSON safely
    let summaryJSON;
    try {
      summaryJSON = JSON.parse(summaryText);
    } catch (e) {
      console.warn("Failed to parse JSON, returning raw text");
      summaryJSON = [{ heading: "Summary", content: summaryText }];
    }

    res.json({ summary: summaryJSON });
  } catch (err) {
    console.error("Error processing file:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- GENERAL COMPLETION ENDPOINT ----------
app.post("/completion", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ message: "No prompt provided" });

  try {
    const result = await model.generateContent(prompt);
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

