// Format date to readable string
export function formatDate(date, options = {}) {
    const d = new Date(date);
    const defaultOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
        ...options,
    };
    return d.toLocaleDateString("en-US", defaultOptions);
}

// Format time in seconds to MM:SS or HH:MM:SS
export function formatTime(seconds) {
    if (!seconds || seconds < 0) return "00:00";

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
        return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Format percentage
export function formatPercentage(value, decimals = 0) {
    if (typeof value !== "number" || isNaN(value)) return "0%";
    return `${value.toFixed(decimals)}%`;
}

// Capitalize first letter
export function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Truncate text
export function truncate(str, maxLength = 50) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "...";
}

// Get initials from name
export function getInitials(name) {
    if (!name) return "";
    return name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
}

// Calculate reading time (words per minute)
export function calculateReadingTime(text, wpm = 200) {
    if (!text) return 0;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wpm);
}

// Shuffle array
export function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get difficulty color
export function getDifficultyColor(difficulty) {
    switch (difficulty?.toLowerCase()) {
        case "easy":
            return "#10b981";
        case "medium":
            return "#f59e0b";
        case "hard":
            return "#ef4444";
        default:
            return "#6b7280";
    }
}

// Get session type label
export function getSessionTypeLabel(type) {
    switch (type) {
        case "practice":
            return "Practice Session";
        case "quiz":
            return "Quiz";
        case "test":
            return "Test";
        case "self-assessment":
            return "Self Assessment";
        default:
            return capitalize(type);
    }
}

// Calculate grade from percentage
export function calculateGrade(percentage) {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B";
    if (percentage >= 60) return "C";
    if (percentage >= 50) return "D";
    return "F";
}

// Debounce function
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Generate random ID
export function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Parse error message from API response
export function parseError(error) {
    if (typeof error === "string") return error;
    if (error?.response?.data?.error) return error.response.data.error;
    if (error?.message) return error.message;
    return "An unexpected error occurred";
}

// Check if object is empty
export function isEmpty(obj) {
    if (!obj) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    return Object.keys(obj).length === 0;
}

// Local storage helpers
export const storage = {
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error("Error saving to localStorage:", e);
        }
    },
    remove: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error("Error removing from localStorage:", e);
        }
    },
    // Clear all random/mock data while preserving user credentials
    clearRandomData: () => {
        try {
            const keysToPreserve = ["token", "user"];
            const keysToRemove = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!keysToPreserve.includes(key)) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log("Cleared random data. Preserved: token, user");
            console.log("Removed keys:", keysToRemove);
            return keysToRemove;
        } catch (e) {
            console.error("Error clearing random data from localStorage:", e);
            return [];
        }
    },
};
