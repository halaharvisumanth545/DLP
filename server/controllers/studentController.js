import { User } from "../models/User.js";
import { Syllabus } from "../models/Syllabus.js";
import { Session } from "../models/Session.js";
import { Analytics } from "../models/Analytics.js";

// Get student dashboard data
export async function getDashboard(req, res) {
    try {
        const userId = req.user.userId;

        // Debug logging
        console.log("Dashboard request for userId:", userId);

        // Get user info
        const user = await User.findById(userId).select("-passwordHash");

        console.log("User found:", user ? "Yes" : "No");

        if (!user) {
            console.error("User not found for ID:", userId);
            return res.status(404).json({ error: "User not found" });
        }

        // Get recent syllabi
        const recentSyllabi = await Syllabus.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select("fileName topics status createdAt");

        // Get recent sessions
        const recentSessions = await Session.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select("type status score completedAt createdAt");

        // Get analytics summary
        const analytics = await Analytics.findOne({ userId });

        res.json({
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
            },
            stats: {
                totalSyllabi: await Syllabus.countDocuments({ userId }),
                totalSessions: analytics?.totalSessions || 0,
                overallAccuracy: analytics?.overallAccuracy || 0,
                currentStreak: analytics?.streaks?.current || 0,
            },
            recentSyllabi,
            recentSessions,
            weakTopics: analytics?.weakTopics?.slice(0, 5) || [],
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).json({ error: "Failed to load dashboard" });
    }
}

// Get all syllabi for the user
export async function getSyllabi(req, res) {
    try {
        const syllabi = await Syllabus.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .select("fileName topics status createdAt");

        res.json({ syllabi });
    } catch (error) {
        console.error("Get syllabi error:", error);
        res.status(500).json({ error: "Failed to get syllabi" });
    }
}

// Get single syllabus details
export async function getSyllabusById(req, res) {
    try {
        const syllabus = await Syllabus.findOne({
            _id: req.params.id,
            userId: req.user.userId,
        });

        if (!syllabus) {
            return res.status(404).json({ error: "Syllabus not found" });
        }

        res.json({ syllabus });
    } catch (error) {
        console.error("Get syllabus error:", error);
        res.status(500).json({ error: "Failed to get syllabus" });
    }
}

// Update syllabus topics
export async function updateSyllabus(req, res) {
    try {
        const { id } = req.params;
        const { topics } = req.body;

        const syllabus = await Syllabus.findOne({
            _id: id,
            userId: req.user.userId,
        });

        if (!syllabus) {
            return res.status(404).json({ error: "Syllabus not found" });
        }

        syllabus.topics = topics;
        await syllabus.save();

        res.json({ syllabus });
    } catch (error) {
        console.error("Update syllabus error:", error);
        res.status(500).json({ error: "Failed to update syllabus" });
    }
}

// Get user's session history
export async function getSessionHistory(req, res) {
    try {
        const { type, limit = 20, page = 1 } = req.query;

        const query = { userId: req.user.userId };
        if (type) query.type = type;

        const sessions = await Session.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .select("type status score topics difficulty completedAt createdAt");

        const total = await Session.countDocuments(query);

        res.json({
            sessions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Get session history error:", error);
        res.status(500).json({ error: "Failed to get session history" });
    }
}
