import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
    {
        syllabusId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Syllabus",
        },
        topic: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ["mcq", "short", "long", "true-false"],
            default: "mcq",
        },
        text: {
            type: String,
            required: true,
        },
        options: [
            {
                label: String, // A, B, C, D
                text: String,
            },
        ],
        correctAnswer: {
            type: String,
            required: true,
        },
        explanation: {
            type: String,
        },
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            default: "medium",
        },
        marks: {
            type: Number,
            default: 1,
        },
        tags: [String],
        isAIGenerated: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Indexes for efficient queries
questionSchema.index({ topic: 1, difficulty: 1 });
questionSchema.index({ syllabusId: 1, type: 1 });

export const Question = mongoose.model("Question", questionSchema, "questions");
