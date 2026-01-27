import api, { endpoints } from "./api";

// ============================================
// MOCK MODE - For testing without backend/DB
// ============================================
const MOCK_MODE = false; // Set to false when MongoDB is ready

// Test users stored in localStorage
const TEST_USERS = [
    {
        id: "test-student-001",
        name: "Test Student",
        email: "student@test.com",
        password: "student123",
        role: "student",
    },
    {
        id: "test-teacher-001",
        name: "Test Teacher",
        email: "teacher@test.com",
        password: "teacher123",
        role: "teacher",
    },
];

// Initialize mock users in localStorage
function initMockUsers() {
    const existingUsers = localStorage.getItem("mockUsers");
    if (!existingUsers) {
        localStorage.setItem("mockUsers", JSON.stringify(TEST_USERS));
    }
}

// Get mock users from localStorage
function getMockUsers() {
    initMockUsers();
    return JSON.parse(localStorage.getItem("mockUsers") || "[]");
}

// Save mock users to localStorage
function saveMockUsers(users) {
    localStorage.setItem("mockUsers", JSON.stringify(users));
}

// Generate mock JWT token
function generateMockToken(user) {
    return `mock-jwt-${user.id}-${Date.now()}`;
}

// ============================================
// AUTH FUNCTIONS
// ============================================

// Login user
export async function login(email, password) {
    if (MOCK_MODE) {
        // Mock login
        const users = getMockUsers();
        const user = users.find(
            (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        if (!user) {
            throw { response: { data: { error: "Invalid email or password" } } };
        }

        const token = generateMockToken(user);
        const userData = { id: user.id, name: user.name, email: user.email, role: user.role };

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(userData));

        return { token, user: userData, message: "Login successful (Mock Mode)" };
    }

    // Real API login
    const response = await api.post(endpoints.login, { email, password });

    if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
    }

    return response.data;
}

// Register user
export async function register(userData) {
    if (MOCK_MODE) {
        // Mock register
        const users = getMockUsers();

        // Check if email exists
        if (users.find((u) => u.email.toLowerCase() === userData.email.toLowerCase())) {
            throw { response: { data: { error: "User with this email already exists" } } };
        }

        const newUser = {
            id: `user-${Date.now()}`,
            name: userData.name,
            email: userData.email.toLowerCase(),
            password: userData.password,
            role: userData.role || "student",
        };

        users.push(newUser);
        saveMockUsers(users);

        const token = generateMockToken(newUser);
        const returnUser = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(returnUser));

        return { token, user: returnUser, message: "Registration successful (Mock Mode)" };
    }

    // Real API register
    const response = await api.post(endpoints.register, userData);

    if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
    }

    return response.data;
}

// Logout user
export function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
}

// Get current user from localStorage
export function getCurrentUser() {
    const userStr = localStorage.getItem("user");
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch {
            return null;
        }
    }
    return null;
}

// Check if user is authenticated
export function isAuthenticated() {
    return !!localStorage.getItem("token");
}

// Get user profile from API
export async function getProfile() {
    if (MOCK_MODE) {
        const user = getCurrentUser();
        return { user };
    }
    const response = await api.get(endpoints.profile);
    return response.data;
}

// Update user profile
export async function updateProfile(userData) {
    if (MOCK_MODE) {
        const currentUser = getCurrentUser();
        const updatedUser = { ...currentUser, ...userData };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        return { user: updatedUser };
    }

    const response = await api.put(endpoints.profile, userData);

    if (response.data.user) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
    }

    return response.data;
}

// Check user role
export function getUserRole() {
    const user = getCurrentUser();
    return user?.role || null;
}

// Check if user is student
export function isStudent() {
    return getUserRole() === "student";
}

// Check if user is teacher
export function isTeacher() {
    return getUserRole() === "teacher";
}

// Initialize mock users on load
initMockUsers();

console.log("🔧 Auth running in MOCK MODE");
console.log("📧 Test credentials:");
console.log("   Student: student@test.com / student123");
console.log("   Teacher: teacher@test.com / teacher123");
