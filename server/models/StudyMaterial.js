import mongoose from "mongoose";

const studyMaterialSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        syllabusId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Syllabus",
            required: true,
        },
        topic: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: false,
        },
        mode: {
            type: String,
            enum: ["short", "intermediate", "pro", "combined"],
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        sections: [
            {
                title: String,
                content: String,
                keyPoints: [String],
            },
        ],
        metadata: {
            wordCount: Number,
            estimatedReadTime: Number, // in minutes
        },
    },
    { timestamps: true }
);

// Index for faster queries
studyMaterialSchema.index({ userId: 1, syllabusId: 1 });
studyMaterialSchema.index({ topic: 1, mode: 1 });

export const StudyMaterial = mongoose.model("StudyMaterial", studyMaterialSchema, "studymaterials");
