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
        const identifier = email.toLowerCase().trim();
        const existingUser = await User.findOne({ email: identifier });
        if (existingUser) {
            return res.status(409).json({ error: "User with this email already exists" });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const user = await User.create({
            name,
            email: identifier,
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

import crypto from "crypto";
import { sendPasswordResetEmail } from "../services/emailService.js";

// Request password reset
export async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const identifier = email.toLowerCase().trim();
        const user = await User.findOne({ email: identifier });

        // We always return 200 even if user not found, for security (prevent email enumeration)
        if (!user) {
            return res.json({ message: "If that email exists, a reset link has been sent." });
        }

        // Generate a random reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Hash it before saving to DB
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Set expiry to 30 minutes from now
        const tokenExpiry = new Date(Date.now() + 30 * 60 * 1000);

        // Update user
        user.resetToken = hashedToken;
        user.resetTokenExpiry = tokenExpiry;
        await user.save();

        // Create reset URL - in a real app this points to frontend route
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;

        // Send email
        const emailSent = await sendPasswordResetEmail(user.email, resetUrl);

        if (!emailSent) {
            // Revert DB changes if email failed
            user.resetToken = undefined;
            user.resetTokenExpiry = undefined;
            await user.save();
            return res.status(500).json({ error: "Failed to send reset email. Please try again later." });
        }

        res.json({ message: "If that email exists, a reset link has been sent." });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Failed to process forgot password request" });
    }
}

// Reset password using token
export async function resetPassword(req, res) {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: "Token and new password are required" });
        }

        // Hash the incoming raw token to compare with DB
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with this token and ensure it hasn't expired
        // Mongoose format for "expiry > now"
        const user = await User.findOne({
            resetToken: hashedToken,
            resetTokenExpiry: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ error: "Invalid or expired reset token" });
        }

        // Hash new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password and clear reset fields
        user.passwordHash = passwordHash;
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();

        res.json({ message: "Password has been successfully reset" });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Failed to reset password" });
    }
}

// Edit internal password (requires current password)
export async function editPassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Current and new password are required" });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const storedPassword = user.passwordHash || user.password;
        if (!storedPassword) {
            return res.status(500).json({ error: "User account misconfigured" });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, storedPassword);
        if (!isValidPassword) {
            return res.status(401).json({ error: "Incorrect current password" });
        }

        // Hash new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        // Save
        user.passwordHash = passwordHash;
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Edit password error:", error);
        res.status(500).json({ error: "Failed to update password" });
    }
}

// Login user
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: "Email/Username and password are required" });
        }

        // Find user by email or username
        const identifier = email.toLowerCase().trim();
        const user = await User.findOne({
            $or: [{ email: identifier }, { username: identifier }]
        });

        // Debug logging
        console.log("Login attempt for:", email);
        console.log("User found:", user ? "Yes" : "No");
        if (user) {
            console.log("User fields:", Object.keys(user.toObject()));
        }

        if (!user) {
            return res.status(401).json({ error: "Invalid email/username or password" });
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
            return res.status(401).json({ error: "Invalid email/username or password" });
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
                username: user.username,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture,
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
        const {
            username,
            email,
            profilePicture,
            firstName,
            middleName,
            lastName,
            about,
            university,
            affiliatedCollege,
            course,
            semester,
            branch,
            countryCode,
            mobileNumber,
            standard // Kept for backward compatibility handling
        } = req.body;

        // Ensure username is unique if provided
        let safeUsername = username ? username.toLowerCase().trim() : undefined;
        if (safeUsername === "") safeUsername = undefined; // treat empty string as absent

        if (safeUsername) {
            const existingUser = await User.findOne({ username: safeUsername });
            if (existingUser && existingUser._id.toString() !== req.user.userId) {
                return res.status(409).json({ error: "Username already taken" });
            }
        }

        // Ensure email is unique if provided
        let safeEmail = email ? email.toLowerCase().trim() : undefined;
        if (safeEmail === "") safeEmail = undefined;

        if (safeEmail) {
            const existingEmailUser = await User.findOne({ email: safeEmail });
            if (existingEmailUser && existingEmailUser._id.toString() !== req.user.userId) {
                return res.status(409).json({ error: "Email is already in use by another account" });
            }
        }

        // Construct the full name if name parts are provided
        // But if they just submit a generic name (backward compatible), we use that.
        // We'll prioritize the parts if any of them are provided.
        let name = req.body.name;
        if (firstName || lastName) {
            const parts = [firstName, middleName, lastName].filter(Boolean);
            if (parts.length > 0) {
                name = parts.join(" ");
            }
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (firstName !== undefined) updateData.firstName = firstName;
        if (middleName !== undefined) updateData.middleName = middleName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (safeUsername !== undefined) {
            updateData.username = safeUsername;
        } else if (username === "") {
            // If the user actively clears it out, we unset it from the DB
            updateData.$unset = { username: 1 };
        }
        if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
        if (about !== undefined) updateData.about = about;
        if (university !== undefined) updateData.university = university;
        if (affiliatedCollege !== undefined) updateData.affiliatedCollege = affiliatedCollege;
        if (course !== undefined) updateData.course = course;
        if (semester !== undefined) updateData.semester = semester;
        if (branch !== undefined) updateData.branch = branch;
        if (countryCode !== undefined) updateData.countryCode = countryCode;
        if (mobileNumber !== undefined) updateData.mobileNumber = mobileNumber;

        // Clean up legacy standard and college if present
        if (standard === "" || standard === null || (course && semester)) {
            updateData.$unset = { ...updateData.$unset, standard: 1 };
        } else if (standard !== undefined) {
            updateData.standard = standard;
        }

        if (university || affiliatedCollege) {
            updateData.$unset = { ...updateData.$unset, college: 1 };
        }

        if (safeEmail !== undefined) updateData.email = safeEmail;

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            updateData,
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
