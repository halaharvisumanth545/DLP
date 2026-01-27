import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
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
        syllabusId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Syllabus",
        },
        topics: [String],
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard", "mixed"],
            default: "mixed",
        },
        questions: [
            {
                questionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Question",
                },
                questionData: {
                    type: mongoose.Schema.Types.Mixed, // Snapshot of question at time of session
                },
            },
        ],
        answers: [
            {
                questionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Question",
                },
                userAnswer: String,
                isCorrect: Boolean,
                timeSpent: Number, // in seconds
                isSkipped: Boolean,
                markedForReview: Boolean,
            },
        ],
        status: {
            type: String,
            enum: ["in-progress", "completed", "abandoned"],
            default: "in-progress",
        },
        totalTimeAllowed: Number, // in seconds
        timeSpent: Number, // in seconds
        startedAt: Date,
        completedAt: Date,
        score: {
            obtained: Number,
            total: Number,
            percentage: Number,
        },
    },
    { timestamps: true }
);

// Indexes
sessionSchema.index({ userId: 1, type: 1, createdAt: -1 });
sessionSchema.index({ status: 1 });

export const Session = mongoose.model("Session", sessionSchema, "sessions");
