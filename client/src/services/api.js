import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default api;

// API endpoints
export const endpoints = {
    // Auth
    login: "/api/auth/login",
    register: "/api/auth/register",
    profile: "/api/auth/profile",
    forgotPassword: "/api/auth/forgot-password",
    resetPassword: "/api/auth/reset-password",
    editPassword: "/api/auth/edit-password",

    // Student (nested for service compatibility)
    student: {
        dashboard: "/api/student/dashboard",
        syllabi: "/api/student/syllabi",
        uploadSyllabus: "/api/student/syllabi",
        materials: "/api/student/study-materials",
        generateMaterial: "/api/student/study-materials/generate",
        saveMaterial: "/api/student/study-materials/save",
        combineMaterials: "/api/student/study-materials/combine",
        getAllMaterials: "/api/student/study-materials",
        deleteMaterial: "/api/student/study-materials", // Will append /:id
        // Sessions
        sessions: "/api/student/sessions",
        startSession: "/api/student/sessions",
        submitAnswer: "/api/student/sessions", // Will append /:sessionId/answer
        completeSession: "/api/student/sessions", // Will append /:sessionId/complete
        sessionResult: "/api/student/sessions", // Will append /:sessionId/result
        sessionHistory: "/api/student/sessions",
        // Analytics
        analytics: "/api/student/analytics",
        weakTopics: "/api/student/analytics/weak-topics",
        progressHistory: "/api/student/analytics/progress",
        topicPerformance: "/api/student/analytics/topics",
        difficultyPerformance: "/api/student/analytics/difficulty",
    },

    // OpenAI
    openai: {
        generateMaterial: "/api/openai/generate-material",
        generateComprehensiveMaterial: "/api/openai/generate-comprehensive-material",
        generateQuestions: "/api/openai/generate-questions",
        parseSyllabus: "/api/openai/parse-syllabus",
        analyzeWeakness: "/api/openai/analyze-weakness",
    },

    // RAG (Textbook-Augmented Generation) — detached
    // rag: {
    //     uploadTextbook: "/api/rag/upload-textbook",
    //     search: "/api/rag/search",
    //     generateWithRAG: "/api/rag/generate-with-rag",
    //     textbooks: "/api/rag/textbooks",
    // },
};
