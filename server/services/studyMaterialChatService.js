import { MaterialClusterManifest } from "../models/MaterialClusterManifest.js";
import { StudyMaterial } from "../models/StudyMaterial.js";
import { Syllabus } from "../models/Syllabus.js";
import { retrieveRelevantChunks } from "./ragService.js";
import { generateTextReply } from "../config/openai.js";

const GREETING_PATTERN = /^(hi|hello|hey|hii|hiii|good morning|good afternoon|good evening|yo|namaste)\b/i;
const TOKEN_PATTERN = /[a-z0-9]+/g;
const STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for", "from", "how",
    "i", "in", "is", "it", "me", "my", "of", "on", "or", "please", "the", "this", "to",
    "what", "when", "where", "which", "who", "why", "with", "you", "your",
]);
const SCOPED_RELEVANCE_THRESHOLD = 0.42;
const SYLLABUS_RELEVANCE_THRESHOLD = 0.48;
const MAX_CLUSTER_IDS = 6;
const MAX_CONTEXT_CHUNKS = 5;

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(value) {
    const matches = normalizeText(value).match(TOKEN_PATTERN) || [];
    return matches.filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function uniqueStrings(values) {
    return Array.from(new Set(values.filter(Boolean)));
}

function lexicalSimilarity(left, right) {
    const leftText = normalizeText(left);
    const rightText = normalizeText(right);

    if (!leftText || !rightText) {
        return 0;
    }

    if (leftText === rightText) {
        return 1;
    }

    if (leftText.includes(rightText) || rightText.includes(leftText)) {
        return 0.86;
    }

    const leftTokens = tokenize(leftText);
    const rightTokens = tokenize(rightText);
    if (leftTokens.length === 0 || rightTokens.length === 0) {
        return 0;
    }

    const leftSet = new Set(leftTokens);
    const rightSet = new Set(rightTokens);
    let overlap = 0;

    leftSet.forEach((token) => {
        if (rightSet.has(token)) {
            overlap += 1;
        }
    });

    if (overlap === 0) {
        return 0;
    }

    return overlap / Math.max(leftSet.size, rightSet.size);
}

function extractTopicContext(material) {
    const scopedTopic = String(material?.topic || "").trim();
    const topicParts = scopedTopic
        .split(" - ")
        .map((part) => part.trim())
        .filter(Boolean);
    const primaryTopic = topicParts[0] || scopedTopic;
    const focusedSubtopic = topicParts.slice(1).join(" - ").trim();
    const sectionTitles = Array.isArray(material?.sections)
        ? material.sections.map((section) => String(section?.title || "").trim()).filter(Boolean)
        : [];

    return {
        scopedTopic,
        primaryTopic,
        focusedSubtopic,
        sectionTitles,
        labels: uniqueStrings([scopedTopic, primaryTopic, focusedSubtopic, ...sectionTitles]),
    };
}

function selectScopedClusterIds(manifests, materialContext) {
    if (!Array.isArray(manifests) || manifests.length === 0) {
        return [];
    }

    const candidates = [];

    manifests.forEach((manifest) => {
        (manifest.clusters || []).forEach((cluster) => {
            const clusterTexts = uniqueStrings([
                cluster.label,
                ...(cluster.sectionTitles || []),
            ]);

            let bestScore = 0;
            clusterTexts.forEach((clusterText) => {
                materialContext.labels.forEach((label) => {
                    bestScore = Math.max(bestScore, lexicalSimilarity(clusterText, label));
                });
            });

            if (materialContext.focusedSubtopic) {
                bestScore = Math.max(bestScore, lexicalSimilarity(cluster.label, materialContext.focusedSubtopic) + 0.08);
            }

            if (materialContext.primaryTopic) {
                bestScore = Math.max(bestScore, lexicalSimilarity(cluster.label, materialContext.primaryTopic) + 0.03);
            }

            if (bestScore >= 0.28) {
                candidates.push({
                    clusterId: cluster.clusterId,
                    score: bestScore,
                });
            }
        });
    });

    return uniqueStrings(
        candidates
            .sort((left, right) => right.score - left.score)
            .slice(0, MAX_CLUSTER_IDS)
            .map((candidate) => candidate.clusterId)
    );
}

function bestChunkScore(chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
        return 0;
    }

    return chunks.reduce((best, chunk) => {
        const score = typeof chunk.score === "number" ? chunk.score : 0;
        return Math.max(best, score);
    }, 0);
}

function chunkAlignmentScore(chunks, materialContext) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
        return 0;
    }

    let bestScore = 0;
    chunks.forEach((chunk) => {
        const labels = uniqueStrings([
            chunk.sectionTitle,
            chunk.clusterLabel,
            chunk.documentTitle,
        ]);

        labels.forEach((chunkLabel) => {
            materialContext.labels.forEach((materialLabel) => {
                bestScore = Math.max(bestScore, lexicalSimilarity(chunkLabel, materialLabel));
            });
        });
    });

    return bestScore;
}

function buildGreetingReply(materialContext) {
    const focusLabel = materialContext.focusedSubtopic || materialContext.primaryTopic || "this topic";
    return `Hello. Ask me anything about ${focusLabel}, and I will answer from the study material you are viewing.`;
}

function buildOutOfScopeReply(materialContext) {
    const focusLabel = materialContext.focusedSubtopic || materialContext.primaryTopic || "this topic";
    return `The question asked is out of the topic that you are studying right now. Please ask any queries about ${focusLabel}.`;
}

function formatContextChunks(chunks) {
    return chunks
        .slice(0, MAX_CONTEXT_CHUNKS)
        .map((chunk, index) => {
            const label = chunk.sectionTitle || chunk.clusterLabel || chunk.documentTitle || "Study Material";
            return `Excerpt ${index + 1} | ${label}\n${chunk.text}`;
        })
        .join("\n\n");
}

function buildSourceBadges(chunks) {
    return uniqueStrings(
        (chunks || [])
            .map((chunk) => chunk.sectionTitle || chunk.clusterLabel || chunk.documentTitle || "")
            .filter(Boolean)
    ).slice(0, 3);
}

function normalizeConversationHistory(history) {
    if (!Array.isArray(history)) {
        return [];
    }

    return history
        .filter((item) => item && (item.role === "user" || item.role === "assistant"))
        .slice(-6)
        .map((item) => ({
            role: item.role,
            content: String(item.text || "").trim(),
        }))
        .filter((item) => item.content.length > 0);
}

export async function answerStudyMaterialQuery({ materialId, userId, query, history = [] }) {
    const cleanedQuery = String(query || "").trim();
    if (cleanedQuery.length < 1) {
        throw new Error("A query is required.");
    }

    const material = await StudyMaterial.findOne({
        _id: materialId,
        userId,
    }).lean();

    if (!material) {
        throw new Error("Study material not found.");
    }

    const syllabus = await Syllabus.findOne({
        _id: material.syllabusId,
        userId,
    }).select("fileName").lean();

    const materialContext = extractTopicContext(material);

    if (GREETING_PATTERN.test(cleanedQuery)) {
        return {
            answer: buildGreetingReply(materialContext),
            inScope: true,
            sources: [],
        };
    }

    const manifests = await MaterialClusterManifest.find({
        userId,
        syllabusId: material.syllabusId,
    }).select("clusters").lean();

    const scopedClusterIds = selectScopedClusterIds(manifests, materialContext);
    const scopedFilter = {
        userId,
        syllabusId: String(material.syllabusId),
        ...(scopedClusterIds.length > 0 ? { clusterIds: scopedClusterIds } : {}),
    };

    const scopedChunks = await retrieveRelevantChunks(cleanedQuery, scopedFilter, MAX_CONTEXT_CHUNKS, {
        failSilently: true,
    });

    const scopedScore = bestChunkScore(scopedChunks);
    const scopedAlignment = chunkAlignmentScore(scopedChunks, materialContext);
    const canAnswerFromScopedChunks = scopedClusterIds.length > 0
        ? scopedScore >= SCOPED_RELEVANCE_THRESHOLD
        : scopedScore >= SCOPED_RELEVANCE_THRESHOLD && scopedAlignment >= 0.26;

    if (canAnswerFromScopedChunks) {
        const contextText = formatContextChunks(scopedChunks);
        const promptMessages = [
            ...normalizeConversationHistory(history),
            {
                role: "user",
                content: `Current study scope: ${materialContext.scopedTopic || materialContext.primaryTopic}
Syllabus: ${syllabus?.fileName || "Active syllabus"}
Student question: ${cleanedQuery}

Use only the study excerpts below to answer. If a fact is not supported by the excerpts, say that the current study material does not show enough evidence for it.

${contextText}`,
            },
        ];
        const answer = await generateTextReply(
            promptMessages,
            {
                systemPrompt: "You are LearnAI's study assistant. Answer only from the provided study excerpts, keep the tone clear and academic, and keep answers concise but helpful. Do not answer outside the given scope.",
                maxTokens: 500,
                temperature: 0.2,
                fallbackText: contextText || "I found relevant study material, but I could not generate a response right now.",
            }
        );

        return {
            answer,
            inScope: true,
            sources: buildSourceBadges(scopedChunks),
        };
    }

    const syllabusChunks = await retrieveRelevantChunks(cleanedQuery, {
        userId,
        syllabusId: String(material.syllabusId),
    }, 3, {
        failSilently: true,
    });

    const syllabusScore = bestChunkScore(syllabusChunks);
    const syllabusAlignment = chunkAlignmentScore(syllabusChunks, materialContext);
    if (syllabusScore >= SYLLABUS_RELEVANCE_THRESHOLD || scopedClusterIds.length > 0 || syllabusAlignment < 0.22) {
        return {
            answer: buildOutOfScopeReply(materialContext),
            inScope: false,
            sources: [],
        };
    }

    return {
        answer: buildOutOfScopeReply(materialContext),
        inScope: false,
        sources: [],
    };
}
