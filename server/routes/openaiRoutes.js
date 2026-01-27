import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
    generateMaterial,
    generateComprehensiveMaterial,
    generateQuestionsAI,
    parseSyllabus,
    analyzeWeakness,
} from "../controllers/openaiController.js";

const router = express.Router();

// All OpenAI routes require authentication
router.use(authMiddleware);

// Generate study material (single API call - for short mode)
router.post("/generate-material", generateMaterial);

// Generate comprehensive material (parallel API calls per subtopic - for intermediate/pro modes)
router.post("/generate-comprehensive-material", generateComprehensiveMaterial);

// Generate questions
router.post("/generate-questions", generateQuestionsAI);

// Parse syllabus content
router.post("/parse-syllabus", parseSyllabus);

// Analyze weak topics
router.post("/analyze-weakness", analyzeWeakness);

export default router;
