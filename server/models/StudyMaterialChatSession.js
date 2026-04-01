import mongoose from "mongoose";

const studyMaterialChatMessageSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ["user", "assistant"],
            required: true,
        },
        text: {
            type: String,
            required: true,
            trim: true,
        },
        sources: {
            type: [String],
            default: [],
        },
        inScope: {
            type: Boolean,
            default: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: true }
);

const studyMaterialChatSessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        materialId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "StudyMaterial",
            required: true,
            index: true,
        },
        syllabusId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Syllabus",
            required: true,
            index: true,
        },
        topic: {
            type: String,
            required: true,
            trim: true,
        },
        title: {
            type: String,
            default: "New chat",
            trim: true,
        },
        messages: {
            type: [studyMaterialChatMessageSchema],
            default: [],
        },
        lastActivityAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    { timestamps: true }
);

studyMaterialChatSessionSchema.index({ userId: 1, materialId: 1, lastActivityAt: -1 });

export const StudyMaterialChatSession = mongoose.model(
    "StudyMaterialChatSession",
    studyMaterialChatSessionSchema,
    "study_material_chat_sessions"
);
