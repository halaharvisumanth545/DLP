import mongoose from "mongoose";

const resultSchema = new mongoose.Schema(
    {
        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Session",
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["practice", "quiz", "test", "self-assessment"],
            required: true,
        },
        score: {
            obtained: Number,
            total: Number,
            percentage: Number,
        },
        accuracy: {
            type: Number, // Percentage of correct answers
        },
        timeSpent: {
            total: Number, // in seconds
            average: Number, // average per question
        },
        difficultyAnalysis: {
            easy: {
                attempted: Number,
                correct: Number,
                accuracy: Number,
            },
            medium: {
                attempted: Number,
                correct: Number,
                accuracy: Number,
            },
            hard: {
                attempted: Number,
                correct: Number,
                accuracy: Number,
            },
        },
        topicPerformance: [
            {
                topic: String,
                attempted: Number,
                correct: Number,
                accuracy: Number,
                timeSpent: Number,
            },
        ],
        questionBreakdown: {
            total: Number,
            attempted: Number,
            correct: Number,
            incorrect: Number,
            skipped: Number,
        },
        questionSwaps: [
            {
                questionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Question",
                },
                timeSpent: Number,
                timestamp: Date,
            }
        ],
    },
    { timestamps: true }
);

// Indexes
resultSchema.index({ userId: 1, createdAt: -1 });
resultSchema.index({ sessionId: 1 }, { unique: true });

export const Result = mongoose.model("Result", resultSchema, "results");
