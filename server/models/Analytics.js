import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        totalSessions: {
            type: Number,
            default: 0,
        },
        totalQuestionsAttempted: {
            type: Number,
            default: 0,
        },
        overallAccuracy: {
            type: Number,
            default: 0,
        },
        avgTimePerQuestion: {
            type: Number, // in seconds
            default: 0,
        },
        weakTopics: [
            {
                topic: String,
                accuracy: Number,
                questionsAttempted: Number,
                lastAttempted: Date,
                improvementNeeded: {
                    type: String,
                    enum: ["high", "medium", "low"],
                },
            },
        ],
        strongTopics: [
            {
                topic: String,
                accuracy: Number,
                questionsAttempted: Number,
            },
        ],
        difficultyPerformance: {
            easy: {
                attempted: { type: Number, default: 0 },
                correct: { type: Number, default: 0 },
                accuracy: { type: Number, default: 0 },
            },
            medium: {
                attempted: { type: Number, default: 0 },
                correct: { type: Number, default: 0 },
                accuracy: { type: Number, default: 0 },
            },
            hard: {
                attempted: { type: Number, default: 0 },
                correct: { type: Number, default: 0 },
                accuracy: { type: Number, default: 0 },
            },
        },
        progressHistory: [
            {
                date: Date,
                sessionsCompleted: Number,
                accuracy: Number,
                avgScore: Number,
            },
        ],
        streaks: {
            current: { type: Number, default: 0 },
            longest: { type: Number, default: 0 },
            lastActiveDate: Date,
        },
    },
    { timestamps: true }
);

// Index
analyticsSchema.index({ userId: 1 });

export const Analytics = mongoose.model("Analytics", analyticsSchema, "analytics");
