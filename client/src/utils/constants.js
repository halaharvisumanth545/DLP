// API Base URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Session types
export const SESSION_TYPES = {
    PRACTICE: "practice",
    QUIZ: "quiz",
    TEST: "test",
};

// Difficulty levels
export const DIFFICULTY_LEVELS = {
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "hard",
    MIXED: "mixed",
};

// Study material modes
export const STUDY_MODES = {
    SHORT: "short",
    INTERMEDIATE: "intermediate",
    PRO: "pro",
};

// Question types
export const QUESTION_TYPES = {
    MCQ: "mcq",
    SHORT: "short",
    LONG: "long",
    TRUE_FALSE: "true-false",
};

// Routes
export const ROUTES = {
    HOME: "/",
    ARCHITECTURE: "/architecture",
    LOGIN: "/login",
    REGISTER: "/register",
    STUDENT: {
        HOME: "/student",
        DASHBOARD: "/student/dashboard",
        PROFILE: "/student/profile",
        SYLLABI: "/student/syllabi",
        UPLOAD_SYLLABUS: "/student/upload-syllabus",
        MATERIAL_LOAD: "/student/material-load",
        STUDY_MATERIAL: "/student/study-material",
        SAVED_MATERIALS: "/student/saved-materials",
        PRACTICE: "/student/practice",
        QUIZ: "/student/quiz",
        TEST: "/student/test",
        REVIEW: "/student/review",
        ANALYTICS: "/student/analytics",
        RESULTS: "/student/results",
        SESSIONS: "/student/sessions",
    },
};

// Navigation items for student
export const STUDENT_NAV_ITEMS = [
    { label: "Dashboard", path: ROUTES.STUDENT.DASHBOARD, icon: "dashboard" },
    { label: "Material Load", path: ROUTES.STUDENT.MATERIAL_LOAD, icon: "upload" },
    { label: "Study Material", path: ROUTES.STUDENT.STUDY_MATERIAL, icon: "book" },
    { label: "Saved Materials", path: ROUTES.STUDENT.SAVED_MATERIALS, icon: "folder" },
    { label: "Practice", path: ROUTES.STUDENT.PRACTICE, icon: "pencil" },
    { label: "Quiz", path: ROUTES.STUDENT.QUIZ, icon: "lightning" },
    { label: "Test", path: ROUTES.STUDENT.TEST, icon: "clipboard" },
    { label: "Analytics", path: ROUTES.STUDENT.ANALYTICS, icon: "chart" },
];

// Color palette
export const COLORS = {
    primary: "#6366f1",
    primaryDark: "#4f46e5",
    secondary: "#8b5cf6",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    gray: {
        50: "#f9fafb",
        100: "#f3f4f6",
        200: "#e5e7eb",
        300: "#d1d5db",
        400: "#9ca3af",
        500: "#6b7280",
        600: "#4b5563",
        700: "#374151",
        800: "#1f2937",
        900: "#111827",
    },
};

// Chart colors
export const CHART_COLORS = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f43f5e",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
];
