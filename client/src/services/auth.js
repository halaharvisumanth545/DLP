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

function normalizeUser(user) {
    if (!user) {
        return null;
    }

    return {
        ...user,
        role: "student",
    };
}

// ============================================
// AUTH FUNCTIONS
// ============================================

// Login user
export async function login(email, password) {
    if (MOCK_MODE) {
        const users = getMockUsers();
        const user = users.find(
            (candidate) =>
                candidate.email.toLowerCase() === email.toLowerCase() &&
                candidate.password === password
        );

        if (!user) {
            throw { response: { data: { error: "Invalid email or password" } } };
        }

        const token = generateMockToken(user);
        const userData = normalizeUser({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        });

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(userData));

        return { token, user: userData, message: "Login successful (Mock Mode)" };
    }

    const response = await api.post(endpoints.login, { email, password });
    const normalizedUser = normalizeUser(response.data.user);

    if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
    }

    return { ...response.data, user: normalizedUser };
}

// Register user
export async function register(userData) {
    if (MOCK_MODE) {
        const users = getMockUsers();

        if (users.find((user) => user.email.toLowerCase() === userData.email.toLowerCase())) {
            throw { response: { data: { error: "User with this email already exists" } } };
        }

        const newUser = {
            id: `user-${Date.now()}`,
            name: userData.name,
            email: userData.email.toLowerCase(),
            password: userData.password,
            role: "student",
        };

        users.push(newUser);
        saveMockUsers(users);

        const token = generateMockToken(newUser);
        const returnUser = normalizeUser({
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
        });

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(returnUser));

        return { token, user: returnUser, message: "Registration successful (Mock Mode)" };
    }

    const response = await api.post(endpoints.register, {
        name: userData.name,
        email: userData.email,
        password: userData.password,
    });
    const normalizedUser = normalizeUser(response.data.user);

    if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
    }

    return { ...response.data, user: normalizedUser };
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
            const normalizedUser = normalizeUser(JSON.parse(userStr));
            localStorage.setItem("user", JSON.stringify(normalizedUser));
            return normalizedUser;
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
    return { ...response.data, user: normalizeUser(response.data.user) };
}

// Update user profile
export async function updateProfile(userData) {
    if (MOCK_MODE) {
        const currentUser = getCurrentUser();
        const updatedUser = normalizeUser({ ...currentUser, ...userData });
        localStorage.setItem("user", JSON.stringify(updatedUser));
        return { user: updatedUser };
    }

    const response = await api.put(endpoints.profile, userData);
    const normalizedUser = normalizeUser(response.data.user);

    if (normalizedUser) {
        localStorage.setItem("user", JSON.stringify(normalizedUser));
    }

    return { ...response.data, user: normalizedUser };
}

export function getUserRole() {
    return isAuthenticated() ? "student" : null;
}

export function isStudent() {
    return isAuthenticated();
}

// Request password reset
export async function forgotPassword(email) {
    if (MOCK_MODE) {
        return { message: "Mock Mode: Password reset link would be sent to " + email };
    }
    const response = await api.post(endpoints.forgotPassword, { email });
    return response.data;
}

// Reset password with token
export async function resetPassword(token, newPassword) {
    if (MOCK_MODE) {
        return { message: "Mock Mode: Password updated successfully" };
    }
    const response = await api.post(endpoints.resetPassword, { token, newPassword });
    return response.data;
}

// Edit active user password
export async function editPassword(currentPassword, newPassword) {
    if (MOCK_MODE) {
        return { message: "Mock Mode: Password updated successfully" };
    }
    const response = await api.post(endpoints.editPassword, { currentPassword, newPassword });
    return response.data;
}

// Initialize mock users on load
initMockUsers();

if (MOCK_MODE) {
    console.log("🔧 Auth running in MOCK MODE");
    console.log("📧 Test credentials:");
    console.log("   Student: student@test.com / student123");
}
