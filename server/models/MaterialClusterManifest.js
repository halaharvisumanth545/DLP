import mongoose from "mongoose";

const clusterSummarySchema = new mongoose.Schema(
    {
        clusterId: String,
        label: String,
        strategy: String,
        chunkCount: Number,
        sectionTitles: [String],
        sampleText: String,
        firstChunkIndex: Number,
        lastChunkIndex: Number,
        clusterRank: Number,
    },
    { _id: false }
);

const materialClusterManifestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        syllabusId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Syllabus",
            default: null,
            index: true,
        },
        sourceType: {
            type: String,
            enum: ["google-doc"],
            required: true,
        },
        sourceId: {
            type: String,
            required: true,
        },
        documentTitle: {
            type: String,
            required: true,
        },
        sourceUrl: {
            type: String,
            default: "",
        },
        chunkCount: {
            type: Number,
            default: 0,
        },
        clusterCount: {
            type: Number,
            default: 0,
        },
        sectionCount: {
            type: Number,
            default: 0,
        },
        clusteringStrategy: {
            type: String,
            default: "",
        },
        embeddingModel: {
            type: String,
            default: "",
        },
        embeddingDim: {
            type: Number,
            default: 0,
        },
        clusters: [clusterSummarySchema],
    },
    { timestamps: true }
);

materialClusterManifestSchema.index(
    { userId: 1, sourceType: 1, sourceId: 1 },
    { unique: true }
);

export const MaterialClusterManifest = mongoose.model(
    "MaterialClusterManifest",
    materialClusterManifestSchema,
    "material_cluster_manifests"
);
