import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { MaterialClusterManifest } from "../models/MaterialClusterManifest.js";
import { Syllabus } from "../models/Syllabus.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function buildWorkflowArgs({ docsUrl, userId, syllabusId }) {
    const scriptPath = join(__dirname, "..", "langgraph", "material_load_graph.py");
    const args = [scriptPath, "--docs-url", docsUrl];

    if (userId) {
        args.push("--user-id", String(userId));
    }

    if (syllabusId) {
        args.push("--syllabus-id", String(syllabusId));
    }

    return args;
}

function parseWorkflowOutput(stdout, stderr) {
    const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i -= 1) {
        try {
            return JSON.parse(lines[i]);
        } catch (_error) {
            continue;
        }
    }

    throw new Error(stderr || stdout || "Python workflow did not return valid JSON output.");
}

function serializeTopicHints(syllabus) {
    if (!syllabus?.topics || !Array.isArray(syllabus.topics)) {
        return "";
    }

    const hints = syllabus.topics
        .map((topic) => {
            const name = typeof topic?.name === "string" ? topic.name.trim() : "";
            if (!name) return null;

            const subtopics = Array.isArray(topic?.subtopics)
                ? topic.subtopics
                    .map((subtopic) => (typeof subtopic === "string" ? subtopic.trim() : ""))
                    .filter(Boolean)
                : [];

            return {
                name,
                subtopics,
            };
        })
        .filter(Boolean);

    return hints.length > 0 ? JSON.stringify(hints) : "";
}

async function loadSyllabusContext({ syllabusId, userId }) {
    if (!syllabusId || !userId) {
        return null;
    }

    const syllabus = await Syllabus.findOne({
        _id: syllabusId,
        userId,
    }).select("topics fileName");

    if (!syllabus) {
        throw new Error("Selected syllabus was not found for this user.");
    }

    return syllabus;
}

async function persistClusterManifest({ userId, syllabusId, ingestion }) {
    if (!userId || !ingestion?.documentId) {
        return;
    }

    await MaterialClusterManifest.findOneAndUpdate(
        {
            userId,
            sourceType: "google-doc",
            sourceId: ingestion.documentId,
        },
        {
            userId,
            syllabusId: syllabusId || null,
            sourceType: "google-doc",
            sourceId: ingestion.documentId,
            documentTitle: ingestion.documentTitle || "Untitled Google Doc",
            sourceUrl: ingestion.sourceUrl || "",
            chunkCount: ingestion.chunksCreated || 0,
            clusterCount: ingestion.clustersCreated || 0,
            sectionCount: ingestion.sectionCount || 0,
            clusteringStrategy: ingestion.clusteringStrategy || "",
            embeddingModel: ingestion.embeddingModel || "",
            embeddingDim: ingestion.embeddingDim || 0,
            clusters: Array.isArray(ingestion.clusterSummary) ? ingestion.clusterSummary : [],
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        }
    );
}

export async function runMaterialLoadWorkflow({ docsUrl, userId, syllabusId }) {
    const pythonBin = process.env.MATERIAL_LOAD_PYTHON_BIN || "python3";
    const syllabus = await loadSyllabusContext({ syllabusId, userId });
    const args = buildWorkflowArgs({ docsUrl, userId, syllabusId });
    const childEnv = {
        ...process.env,
    };
    const topicHintsJson = serializeTopicHints(syllabus);

    if (topicHintsJson) {
        childEnv.MATERIAL_LOAD_TOPIC_HINTS_JSON = topicHintsJson;
    } else {
        delete childEnv.MATERIAL_LOAD_TOPIC_HINTS_JSON;
    }

    return new Promise((resolve, reject) => {
        const child = spawn(pythonBin, args, {
            env: childEnv,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", (error) => {
            reject(new Error("Unable to start Python workflow: " + error.message));
        });

        child.on("close", async (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || ("Python workflow exited with code " + code)));
                return;
            }

            try {
                const result = parseWorkflowOutput(stdout, stderr);
                await persistClusterManifest({
                    userId,
                    syllabusId,
                    ingestion: result,
                });
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    });
}
