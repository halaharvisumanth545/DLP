import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
    getDashboard,
    getSyllabi,
    getSyllabusById,
    updateSyllabus,
    getSessionHistory,
} from "../controllers/studentController.js";
import {
    uploadSyllabus,
    generateStudyMaterial,
    getStudyMaterials,
    getStudyMaterialById,
    deleteSyllabus,
    saveStudyMaterial,
    getAllStudyMaterials,
    deleteStudyMaterial,
} from "../controllers/contentController.js";
import {
    startSession,
    submitAnswer,
    completeSession,
    getSession,
    getSessionResult,
} from "../controllers/sessionController.js";
import {
    getAnalytics,
    getWeakTopics,
    getProgressHistory,
    getTopicPerformance,
    getDifficultyPerformance,
} from "../controllers/analyticsController.js";

const router = express.Router();

// All routes require authentication and student role
router.use(authMiddleware);
router.use(requireRole("student"));

// Dashboard
router.get("/dashboard", getDashboard);

// Syllabus routes
router.get("/syllabi", getSyllabi);
router.get("/syllabi/:id", getSyllabusById);
router.post("/syllabi", uploadSyllabus);
router.put("/syllabi/:id", updateSyllabus);
router.delete("/syllabi/:id", deleteSyllabus);

// Study material routes
router.post("/study-materials/generate", generateStudyMaterial);
router.post("/study-materials/save", saveStudyMaterial);
router.get("/study-materials", getAllStudyMaterials);
router.get("/study-materials/syllabus/:syllabusId", getStudyMaterials);
router.get("/study-materials/:id", getStudyMaterialById);
router.delete("/study-materials/:id", deleteStudyMaterial);

// Session routes
router.post("/sessions", startSession);
router.get("/sessions", getSessionHistory);
router.get("/sessions/:sessionId", getSession);
router.post("/sessions/:sessionId/answer", submitAnswer);
router.post("/sessions/:sessionId/complete", completeSession);
router.get("/sessions/:sessionId/result", getSessionResult);

// Analytics routes
router.get("/analytics", getAnalytics);
router.get("/analytics/weak-topics", getWeakTopics);
router.get("/analytics/progress", getProgressHistory);
router.get("/analytics/topics", getTopicPerformance);
router.get("/analytics/difficulty", getDifficultyPerformance);

export default router;
