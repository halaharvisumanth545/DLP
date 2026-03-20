import { Analytics } from "../models/Analytics.js";
import { Result } from "../models/Result.js";
import { Session } from "../models/Session.js";

// Get user analytics
export async function getAnalytics(req, res) {
    try {
        const userId = req.user.userId;

        const analytics = await Analytics.findOne({ userId });
        if (!analytics) {
            return res.json({
                analytics: {
                    totalSessions: 0,
                    totalQuestionsAttempted: 0,
                    overallAccuracy: 0,
                    avgTimePerQuestion: 0,
                    weakTopics: [],
                    strongTopics: [],
                    difficultyPerformance: {
                        easy: { attempted: 0, correct: 0, accuracy: 0 },
                        medium: { attempted: 0, correct: 0, accuracy: 0 },
                        hard: { attempted: 0, correct: 0, accuracy: 0 },
                    },
                    progressHistory: [],
                    streaks: { current: 0, longest: 0 },
                },
            });
        }

        res.json({ analytics });
    } catch (error) {
        console.error("Get analytics error:", error);
        res.status(500).json({ error: "Failed to get analytics" });
    }
}

// Get weak topics
export async function getWeakTopics(req, res) {
    try {
        const userId = req.user.userId;

        const analytics = await Analytics.findOne({ userId });

        const weakTopics = analytics?.weakTopics?.filter(t => t.accuracy < 50) || [];

        // Sort by improvement needed
        const sortedWeakTopics = weakTopics
            .sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.improvementNeeded] - priorityOrder[b.improvementNeeded];
            })
            .slice(0, 10);

        res.json({ weakTopics: sortedWeakTopics });
    } catch (error) {
        console.error("Get weak topics error:", error);
        res.status(500).json({ error: "Failed to get weak topics" });
    }
}

// Get progress over time
export async function getProgressHistory(req, res) {
    try {
        const userId = req.user.userId;
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Get results from the past N days
        const results = await Result.find({
            userId,
            createdAt: { $gte: startDate },
        }).sort({ createdAt: 1 }).select("createdAt accuracy score.percentage"); // Optimization

        // Group by date (Server-side default aggregation - UTC)
        const progressByDate = {};
        results.forEach((result) => {
            const dateKey = result.createdAt.toISOString().split("T")[0];
            if (!progressByDate[dateKey]) {
                progressByDate[dateKey] = {
                    date: dateKey,
                    sessions: 0,
                    totalAccuracy: 0,
                    totalScore: 0,
                };
            }
            progressByDate[dateKey].sessions++;
            progressByDate[dateKey].totalAccuracy += result.accuracy || 0;
            progressByDate[dateKey].totalScore += result.score?.percentage || 0;
        });

        const progressHistory = Object.values(progressByDate).map((day) => ({
            date: day.date,
            sessionsCompleted: day.sessions,
            avgAccuracy: Math.round(day.totalAccuracy / day.sessions),
            avgScore: Math.round(day.totalScore / day.sessions),
        }));

        // Return both processed (legacy/UTC) and raw data (for client-side local grouping)
        res.json({ progressHistory, rawResults: results });
    } catch (error) {
        console.error("Get progress history error:", error);
        res.status(500).json({ error: "Failed to get progress history" });
    }
}

// Get topic-wise performance
export async function getTopicPerformance(req, res) {
    try {
        const userId = req.user.userId;

        const results = await Result.find({ userId });

        // Aggregate topic performance across all sessions
        const topicMap = {};
        results.forEach((result) => {
            result.topicPerformance?.forEach((tp) => {
                if (!topicMap[tp.topic]) {
                    topicMap[tp.topic] = {
                        topic: tp.topic,
                        totalAttempted: 0,
                        totalCorrect: 0,
                        totalTimeSpent: 0,
                        sessions: 0,
                    };
                }
                topicMap[tp.topic].totalAttempted += tp.attempted;
                topicMap[tp.topic].totalCorrect += tp.correct;
                topicMap[tp.topic].totalTimeSpent += tp.timeSpent;
                topicMap[tp.topic].sessions++;
            });
        });

        const topicPerformance = Object.values(topicMap)
            .map((tp) => ({
                topic: tp.topic,
                totalAttempted: tp.totalAttempted,
                totalCorrect: tp.totalCorrect,
                accuracy: tp.totalAttempted > 0
                    ? Math.round((tp.totalCorrect / tp.totalAttempted) * 100)
                    : 0,
                avgTimePerQuestion: tp.totalAttempted > 0
                    ? Math.round(tp.totalTimeSpent / tp.totalAttempted)
                    : 0,
                sessions: tp.sessions,
            }))
            .sort((a, b) => b.totalAttempted - a.totalAttempted);

        res.json({ topicPerformance });
    } catch (error) {
        console.error("Get topic performance error:", error);
        res.status(500).json({ error: "Failed to get topic performance" });
    }
}

// Get difficulty-wise performance
export async function getDifficultyPerformance(req, res) {
    try {
        const userId = req.user.userId;

        const analytics = await Analytics.findOne({ userId });

        res.json({
            difficultyPerformance: analytics?.difficultyPerformance || {
                easy: { attempted: 0, correct: 0, accuracy: 0 },
                medium: { attempted: 0, correct: 0, accuracy: 0 },
                hard: { attempted: 0, correct: 0, accuracy: 0 },
            },
        });
    } catch (error) {
        console.error("Get difficulty performance error:", error);
        res.status(500).json({ error: "Failed to get difficulty performance" });
    }
}
