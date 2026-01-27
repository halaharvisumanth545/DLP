import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Analytics } from "../models/Analytics.js";

// Register new user
export async function register(req, res) {
    try {
        const { name, email, password, role = "student" } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email, and password are required" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ error: "User with this email already exists" });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            passwordHash,
            role,
        });

        // Create initial analytics record for the user
        await Analytics.create({ userId: user._id });

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Failed to register user" });
    }
}

// Login user
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });

        // Debug logging
        console.log("Login attempt for:", email);
        console.log("User found:", user ? "Yes" : "No");
        if (user) {
            console.log("User fields:", Object.keys(user.toObject()));
        }

        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Check which password field exists
        const storedPassword = user.passwordHash || user.password;
        if (!storedPassword) {
            console.error("No password field found in user document");
            return res.status(500).json({ error: "User account misconfigured" });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, storedPassword);
        if (!isValidPassword) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Failed to login" });
    }
}

// Get current user profile
export async function getProfile(req, res) {
    try {
        const user = await User.findById(req.user.userId).select("-passwordHash");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ user });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ error: "Failed to get profile" });
    }
}

// Update user profile
export async function updateProfile(req, res) {
    try {
        const { name } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { name },
            { new: true }
        ).select("-passwordHash");

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ user });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ error: "Failed to update profile" });
    }
}
