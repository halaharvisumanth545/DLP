import mongoose from "mongoose";

// Textbook metadata only — chunk texts + vectors live in Pinecone
const textbookSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        syllabusId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Syllabus",
            default: null,
        },
        fileName: {
            type: String,
            required: true,
            trim: true,
        },
        totalChunks: {
            type: Number,
            default: 0,
        },
        totalPages: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ["processing", "ready", "failed"],
            default: "processing",
        },
        errorMessage: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

textbookSchema.index({ userId: 1, createdAt: -1 });

export const Textbook = mongoose.model("Textbook", textbookSchema, "textbooks");
