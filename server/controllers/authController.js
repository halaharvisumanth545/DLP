import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User.js";
import { Analytics } from "../models/Analytics.js";
import { sendPasswordResetEmail } from "../services/emailService.js";

function toStudentAppUser(user) {
    if (!user) {
        return null;
    }

    const userObject = typeof user.toObject === "function" ? user.toObject() : user;

    return {
        ...userObject,
        role: "student",
    };
}

// Register new user
export async function register(req, res) {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email, and password are required" });
        }

        const identifier = email.toLowerCase().trim();
        const existingUser = await User.findOne({ email: identifier });
        if (existingUser) {
            return res.status(409).json({ error: "User with this email already exists" });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const user = await User.create({
            name,
            email: identifier,
            passwordHash,
            role: "student",
        });

        await Analytics.create({ userId: user._id });

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        const appUser = toStudentAppUser(user);

        res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: appUser._id,
                name: appUser.name,
                email: appUser.email,
                role: appUser.role,
            },
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Failed to register user" });
    }
}

// Request password reset
export async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const identifier = email.toLowerCase().trim();
        const user = await User.findOne({ email: identifier });

        if (!user) {
            return res.json({ message: "If that email exists, a reset link has been sent." });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        const tokenExpiry = new Date(Date.now() + 30 * 60 * 1000);

        user.resetToken = hashedToken;
        user.resetTokenExpiry = tokenExpiry;
        await user.save();

        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;
        const emailSent = await sendPasswordResetEmail(user.email, resetUrl);

        if (!emailSent) {
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

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            resetToken: hashedToken,
            resetTokenExpiry: { $gt: new Date() },
        });

        if (!user) {
            return res.status(400).json({ error: "Invalid or expired reset token" });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

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

        const isValidPassword = await bcrypt.compare(currentPassword, storedPassword);
        if (!isValidPassword) {
            return res.status(401).json({ error: "Incorrect current password" });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

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

        if (!email || !password) {
            return res.status(400).json({ error: "Email/Username and password are required" });
        }

        const identifier = email.toLowerCase().trim();
        const user = await User.findOne({
            $or: [{ email: identifier }, { username: identifier }],
        });

        console.log("Login attempt for:", email);
        console.log("User found:", user ? "Yes" : "No");
        if (user) {
            console.log("User fields:", Object.keys(user.toObject()));
        }

        if (!user) {
            return res.status(401).json({ error: "Invalid email/username or password" });
        }

        const storedPassword = user.passwordHash || user.password;
        if (!storedPassword) {
            console.error("No password field found in user document");
            return res.status(500).json({ error: "User account misconfigured" });
        }

        const isValidPassword = await bcrypt.compare(password, storedPassword);
        if (!isValidPassword) {
            return res.status(401).json({ error: "Invalid email/username or password" });
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        const appUser = toStudentAppUser(user);

        res.json({
            message: "Login successful",
            token,
            user: {
                id: appUser._id,
                name: appUser.name,
                username: appUser.username,
                email: appUser.email,
                role: appUser.role,
                profilePicture: appUser.profilePicture,
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

        res.json({ user: toStudentAppUser(user) });
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
            standard,
        } = req.body;

        let safeUsername = username ? username.toLowerCase().trim() : undefined;
        if (safeUsername === "") safeUsername = undefined;

        if (safeUsername) {
            const existingUser = await User.findOne({ username: safeUsername });
            if (existingUser && existingUser._id.toString() !== req.user.userId) {
                return res.status(409).json({ error: "Username already taken" });
            }
        }

        let safeEmail = email ? email.toLowerCase().trim() : undefined;
        if (safeEmail === "") safeEmail = undefined;

        if (safeEmail) {
            const existingEmailUser = await User.findOne({ email: safeEmail });
            if (existingEmailUser && existingEmailUser._id.toString() !== req.user.userId) {
                return res.status(409).json({ error: "Email is already in use by another account" });
            }
        }

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

        res.json({ user: toStudentAppUser(user) });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ error: "Failed to update profile" });
    }
}
