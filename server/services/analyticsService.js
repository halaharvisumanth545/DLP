import { Analytics } from "../models/Analytics.js";

// Update user analytics after session completion
export async function updateUserAnalytics(userId, result) {
    try {
        let analytics = await Analytics.findOne({ userId });

        if (!analytics) {
            analytics = await Analytics.create({ userId });
        }

        // Update basic stats
        analytics.totalSessions += 1;

        const questionsAttempted = result.questionBreakdown?.attempted || 0;
        const questionsCorrect = result.questionBreakdown?.correct || 0;

        analytics.totalQuestionsAttempted += questionsAttempted;

        // Update overall accuracy (running average)
        if (analytics.totalQuestionsAttempted > 0) {
            const totalCorrect = Math.round(
                (analytics.overallAccuracy / 100) * (analytics.totalQuestionsAttempted - questionsAttempted)
            ) + questionsCorrect;
            analytics.overallAccuracy = Math.round((totalCorrect / analytics.totalQuestionsAttempted) * 100);
        }

        // Update average time
        if (result.timeSpent?.average) {
            analytics.avgTimePerQuestion = Math.round(
                (analytics.avgTimePerQuestion * (analytics.totalSessions - 1) + result.timeSpent.average) /
                analytics.totalSessions
            );
        }

        // Update difficulty performance
        if (result.difficultyAnalysis) {
            for (const diff of ["easy", "medium", "hard"]) {
                if (result.difficultyAnalysis[diff]) {
                    analytics.difficultyPerformance[diff].attempted += result.difficultyAnalysis[diff].attempted || 0;
                    analytics.difficultyPerformance[diff].correct += result.difficultyAnalysis[diff].correct || 0;

                    if (analytics.difficultyPerformance[diff].attempted > 0) {
                        analytics.difficultyPerformance[diff].accuracy = Math.round(
                            (analytics.difficultyPerformance[diff].correct / analytics.difficultyPerformance[diff].attempted) * 100
                        );
                    }
                }
            }
        }

        // Update topic performance and detect weak topics
        if (result.topicPerformance) {
            await updateTopicAnalytics(analytics, result.topicPerformance);
        }

        // Update streaks
        await updateStreaks(analytics);

        // Add to progress history
        const today = new Date().toISOString().split("T")[0];
        const existingDay = analytics.progressHistory.find(
            (p) => p.date.toISOString().split("T")[0] === today
        );

        if (existingDay) {
            existingDay.sessionsCompleted += 1;
            existingDay.accuracy = Math.round(
                (existingDay.accuracy * (existingDay.sessionsCompleted - 1) + result.accuracy) /
                existingDay.sessionsCompleted
            );
            existingDay.avgScore = Math.round(
                (existingDay.avgScore * (existingDay.sessionsCompleted - 1) + result.score.percentage) /
                existingDay.sessionsCompleted
            );
        } else {
            analytics.progressHistory.push({
                date: new Date(),
                sessionsCompleted: 1,
                accuracy: result.accuracy || 0,
                avgScore: result.score?.percentage || 0,
            });
        }

        // Keep only last 30 days of history
        if (analytics.progressHistory.length > 30) {
            analytics.progressHistory = analytics.progressHistory.slice(-30);
        }

        await analytics.save();
        return analytics;
    } catch (error) {
        console.error("Update analytics error:", error);
        throw error;
    }
}

// Update topic-based analytics
async function updateTopicAnalytics(analytics, topicPerformance) {
    const topicMap = {};

    // Build map from existing weak topics
    analytics.weakTopics.forEach((wt) => {
        topicMap[wt.topic] = {
            accuracy: wt.accuracy,
            questionsAttempted: wt.questionsAttempted,
            isWeak: true,
        };
    });

    // Build map from existing strong topics
    analytics.strongTopics.forEach((st) => {
        topicMap[st.topic] = {
            accuracy: st.accuracy,
            questionsAttempted: st.questionsAttempted,
            isWeak: false,
        };
    });

    // Update with new performance data
    topicPerformance.forEach((tp) => {
        if (!topicMap[tp.topic]) {
            topicMap[tp.topic] = {
                accuracy: tp.accuracy,
                questionsAttempted: tp.attempted,
                isWeak: tp.accuracy < 60,
            };
        } else {
            // Running average
            const existing = topicMap[tp.topic];
            const totalAttempted = existing.questionsAttempted + tp.attempted;
            const totalCorrect =
                Math.round((existing.accuracy / 100) * existing.questionsAttempted) + tp.correct;

            topicMap[tp.topic] = {
                accuracy: Math.round((totalCorrect / totalAttempted) * 100),
                questionsAttempted: totalAttempted,
                isWeak: Math.round((totalCorrect / totalAttempted) * 100) < 60,
            };
        }
    });

    // Separate weak and strong topics
    const weakTopics = [];
    const strongTopics = [];

    Object.entries(topicMap).forEach(([topic, data]) => {
        if (data.isWeak) {
            let improvementNeeded = "low";
            if (data.accuracy < 40) improvementNeeded = "high";
            else if (data.accuracy < 60) improvementNeeded = "medium";

            weakTopics.push({
                topic,
                accuracy: data.accuracy,
                questionsAttempted: data.questionsAttempted,
                lastAttempted: new Date(),
                improvementNeeded,
            });
        } else {
            strongTopics.push({
                topic,
                accuracy: data.accuracy,
                questionsAttempted: data.questionsAttempted,
            });
        }
    });

    // Sort by accuracy (worst first for weak, best first for strong)
    analytics.weakTopics = weakTopics.sort((a, b) => a.accuracy - b.accuracy);
    analytics.strongTopics = strongTopics.sort((a, b) => b.accuracy - a.accuracy);
}

// Update user streaks
async function updateStreaks(analytics) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActive = analytics.streaks.lastActiveDate;

    if (lastActive) {
        const lastActiveDate = new Date(lastActive);
        lastActiveDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((today - lastActiveDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            // Same day, no change
        } else if (diffDays === 1) {
            // Consecutive day
            analytics.streaks.current += 1;
            if (analytics.streaks.current > analytics.streaks.longest) {
                analytics.streaks.longest = analytics.streaks.current;
            }
        } else {
            // Streak broken
            analytics.streaks.current = 1;
        }
    } else {
        analytics.streaks.current = 1;
    }

    analytics.streaks.lastActiveDate = today;
}

// Get detailed analytics for a user
export async function getDetailedAnalytics(userId) {
    const analytics = await Analytics.findOne({ userId });

    if (!analytics) {
        return null;
    }

    return {
        summary: {
            totalSessions: analytics.totalSessions,
            totalQuestions: analytics.totalQuestionsAttempted,
            overallAccuracy: analytics.overallAccuracy,
            avgTimePerQuestion: analytics.avgTimePerQuestion,
            currentStreak: analytics.streaks.current,
            longestStreak: analytics.streaks.longest,
        },
        weakAreas: analytics.weakTopics.slice(0, 5),
        strengths: analytics.strongTopics.slice(0, 5),
        difficultyBreakdown: analytics.difficultyPerformance,
        recentProgress: analytics.progressHistory.slice(-7),
    };
}
