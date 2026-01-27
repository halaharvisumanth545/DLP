import mongoose from "mongoose";

const syllabusSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        fileName: {
            type: String,
            required: true,
            trim: true,
        },
        originalContent: {
            type: String,
            required: true,
        },
        topics: [
            {
                name: { type: String, required: true },
                subtopics: [String],
                estimatedHours: Number,
            },
        ],
        parsedData: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        status: {
            type: String,
            enum: ["pending", "parsed", "failed"],
            default: "pending",
        },
    },
    { timestamps: true }
);

// Index for faster queries
syllabusSchema.index({ userId: 1, createdAt: -1 });

export const Syllabus = mongoose.model("Syllabus", syllabusSchema, "syllabi");
