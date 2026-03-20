import { Question } from "../models/Question.js";
import { Syllabus } from "../models/Syllabus.js";
import { Session } from "../models/Session.js";
import { generateQuestionsForTopic } from "./openaiService.js";
import { classifyDifficulty } from "../utils/difficultyClassifier.js";
import { distributeAcrossBloomLevels } from "../utils/bloomTaxonomy.js";

// Generate or fetch questions for a session
export async function generateQuestions(options = {}) {
    const {
        syllabusId,
        topics = [],
        difficulty = "mixed",
        count = 10,
        type,
        userId,
        questionMode = "objective",
        excludeIds = [],
    } = options;

    let availableTopics = topics;

    // If syllabusId is provided, get topics from syllabus
    if (syllabusId && topics.length === 0) {
        const syllabus = await Syllabus.findById(syllabusId);
        if (syllabus && syllabus.topics) {
            availableTopics = syllabus.topics.map((t) => t.name);
        }
    }

    // If no topics available, use a default
    if (availableTopics.length === 0) {
        availableTopics = ["General Knowledge"];
    }

    // Collect question IDs the user has seen in recent sessions (last 20)
    let usedQuestionIds = [];
    if (userId) {
        try {
            const recentSessions = await Session.find({ userId })
                .sort({ createdAt: -1 })
                .limit(20)
                .select("questions.questionId");
            usedQuestionIds = recentSessions.flatMap(
                (s) => s.questions.map((q) => q.questionId).filter(Boolean)
            );
        } catch (err) {
            console.error("Error fetching recent sessions for exclusion:", err);
        }
    }

    // Combine recent session exclusions with provided exclusions from current session loop
    let allExcludedIds = [...usedQuestionIds];
    if (excludeIds && excludeIds.length > 0) {
        allExcludedIds = [...allExcludedIds, ...excludeIds];
    }

    // Determine question type based on questionMode
    let questionType = type;
    if (!questionType) {
        if (questionMode === "descriptive") questionType = "descriptive";
        else if (questionMode === "objective") questionType = "mcq";
        // For "mixed", we'll handle both types below
    }

    // For mixed mode, split count between MCQ and descriptive
    if (questionMode === "mixed" && !type) {
        const mcqCount = Math.ceil(count / 2);
        const descCount = count - mcqCount;

        const mcqQuestions = await fetchOrGenerateQuestions({
            availableTopics, usedQuestionIds: allExcludedIds, difficulty, questionType: "mcq",
            count: mcqCount, syllabusId,
        });
        const descQuestions = await fetchOrGenerateQuestions({
            availableTopics, usedQuestionIds: allExcludedIds, difficulty, questionType: "descriptive",
            count: descCount, syllabusId,
        });

        // Dedup across MCQ + descriptive by _id and text
        return deduplicateQuestions(shuffleArray([...mcqQuestions, ...descQuestions])).slice(0, count);
    }

    const result = await fetchOrGenerateQuestions({
        availableTopics, usedQuestionIds: allExcludedIds, difficulty,
        questionType: questionType || "mcq", count, syllabusId,
    });

    // Final dedup by _id and text before returning to caller
    return deduplicateQuestions(result).slice(0, count);
}

// Deduplicate questions by both _id and normalized text
function deduplicateQuestions(questions) {
    const seenIds = new Set();
    const seenTexts = new Set();
    const unique = [];

    for (const q of questions) {
        const id = q._id?.toString();
        const text = normalizeText(q.text || "");

        // Skip if we've seen this exact document _id or this text
        if ((id && seenIds.has(id)) || seenTexts.has(text)) {
            continue;
        }

        if (id) seenIds.add(id);
        seenTexts.add(text);
        unique.push(q);
    }

    if (unique.length < questions.length) {
        console.warn(`[generateQuestions] Removed ${questions.length - unique.length} duplicate questions by _id/text.`);
    }

    return unique;
}

// Normalize text for deduplication — catches near-duplicates
function normalizeText(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Valid bloom levels for sanitization
const VALID_BLOOM_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

// Fetch from DB or generate via AI
async function fetchOrGenerateQuestions({ availableTopics, usedQuestionIds, difficulty, questionType, count, syllabusId }) {
    // Try to fetch existing questions, excluding recently used ones
    const query = {
        topic: { $in: availableTopics },
    };

    if (usedQuestionIds.length > 0) {
        query._id = { $nin: usedQuestionIds };
    }

    if (difficulty !== "mixed") {
        query.difficulty = difficulty;
    }

    if (questionType) {
        query.type = questionType;
    }

    // Fetch ALL matching questions from DB — we'll dedup in-memory
    const rawQuestions = await Question.find(query);
    let questions = [];
    const seenTexts = new Set();

    // Filter duplicates from DB using normalized text — scan ALL results
    for (const q of rawQuestions) {
        const normalized = normalizeText(q.text);
        if (!seenTexts.has(normalized)) {
            seenTexts.add(normalized);
            questions.push(q);
        }
        // Don't break early — collect up to count unique questions
        if (questions.length >= count) break;
    }

    console.log(`[Question Generation] Found ${questions.length} unique questions from DB (from ${rawQuestions.length} total records). Need ${count}.`);

    // If not enough unique questions, generate more using AI with Bloom's Taxonomy
    if (questions.length < count) {
        const neededCount = count - questions.length;
        const MAX_PER_REQUEST = 15;
        const MAX_RETRIES = 2;

        // Distribute needed count across topics
        const questionsPerTopic = Math.ceil(neededCount / availableTopics.length);

        // Log the Bloom's target distribution for debugging
        const bloomDistribution = distributeAcrossBloomLevels(neededCount, difficulty);
        console.log(`[Question Generation] Need ${neededCount} more questions. Bloom's target:`, bloomDistribution.map(d => `${d.bloomLevel}=${d.count}`).join(", "));

        for (const topic of availableTopics) {
            if (questions.length >= count) break;

            let topicNeeded = Math.min(questionsPerTopic, count - questions.length);
            let retryCount = 0;

            while (topicNeeded > 0 && questions.length < count && retryCount <= MAX_RETRIES) {
                const batchSize = Math.min(MAX_PER_REQUEST, topicNeeded, count - questions.length);

                // Pass ALL seen texts as exclusion context (cross-topic)
                const allExistingTexts = [...seenTexts];

                try {
                    // Use "mixed" bloom level — the AI prompt will instruct it to
                    // distribute questions across all 6 cognitive levels in one call
                    const generatedQuestions = await generateQuestionsForTopic(topic, {
                        count: batchSize,
                        difficulty: difficulty === "mixed"
                            ? ["easy", "medium", "hard"][Math.floor(Math.random() * 3)]
                            : difficulty,
                        type: questionType || "mcq",
                        existingQuestions: allExistingTexts,
                        bloomLevel: "mixed",
                    });

                    if (!generatedQuestions || generatedQuestions.length === 0) {
                        console.warn(`No questions generated for topic ${topic}. Retrying...`);
                        retryCount++;
                        continue;
                    }

                    let addedInBatch = 0;

                    // Save generated questions to database
                    for (const q of generatedQuestions) {
                        if (questions.length >= count || topicNeeded <= 0) break;

                        const qText = q.question || q.text || `Question regarding ${topic}`;
                        const normalizedQText = normalizeText(qText);

                        // Prevent duplicates — normalized comparison
                        if (seenTexts.has(normalizedQText)) {
                            console.log(`Skipping duplicate generated question: ${qText.substring(0, 60)}...`);
                            continue;
                        }
                        seenTexts.add(normalizedQText);

                        const isDesc = questionType === "descriptive";

                        // Parse options to ensure they match mongoose format
                        let parsedOptions = [];
                        if (!isDesc && Array.isArray(q.options)) {
                            parsedOptions = q.options.map((opt, index) => {
                                const fallbackLabel = String.fromCharCode(65 + index); // A, B, C, D...
                                if (typeof opt === 'string') return { label: fallbackLabel, text: opt };
                                return {
                                    label: opt.label || fallbackLabel,
                                    text: opt.text || ""
                                };
                            });
                        }

                        // Parse correct answer
                        let parsedCorrectAnswer = q.correctAnswer || q.answer || q.modelAnswer || "";
                        if (!parsedCorrectAnswer && isDesc) {
                            parsedCorrectAnswer = q.explanation || "N/A";
                        } else if (!parsedCorrectAnswer && !isDesc && parsedOptions.length > 0) {
                            parsedCorrectAnswer = parsedOptions[0].label || "A";
                        }

                        // Sanitize difficulty
                        const diffValue = (q.difficulty || difficulty || "medium").toLowerCase();

                        // Sanitize bloom level — ensure it's valid
                        const rawBloom = (q.bloomLevel || "understand").toLowerCase();
                        const bloomValue = VALID_BLOOM_LEVELS.includes(rawBloom) ? rawBloom : "understand";

                        try {
                            const newQuestion = await Question.create({
                                syllabusId,
                                topic,
                                type: questionType || "mcq",
                                text: qText,
                                options: parsedOptions,
                                correctAnswer: parsedCorrectAnswer || "N/A",
                                explanation: q.explanation || "No explanation provided.",
                                difficulty: diffValue,
                                marks: getMarksForDifficulty(diffValue),
                                bloomLevel: bloomValue,
                                isAIGenerated: true,
                            });

                            questions.push(newQuestion);
                            topicNeeded--;
                            addedInBatch++;
                        } catch (dbError) {
                            // Handle duplicate key error gracefully
                            if (dbError.code === 11000) {
                                console.log(`DB duplicate rejected: ${qText.substring(0, 60)}...`);
                                continue;
                            }
                            throw dbError;
                        }
                    }

                    // If no new unique questions were added, retry
                    if (addedInBatch === 0) {
                        retryCount++;
                        console.log(`[Retry ${retryCount}/${MAX_RETRIES}] No unique questions added for ${topic}. Retrying...`);
                        continue;
                    }

                    // Reset retry count on success
                    retryCount = 0;

                } catch (error) {
                    console.error(`Failed to generate questions for ${topic}:`, error);
                    retryCount++;
                    if (retryCount > MAX_RETRIES) break;
                }
            }
        }
    }

    // FINAL SAFETY NET: Absolute deduplication before returning
    const finalTexts = new Set();
    const uniqueQuestions = [];
    for (const q of questions) {
        const normalized = normalizeText(q.text);
        if (!finalTexts.has(normalized)) {
            finalTexts.add(normalized);
            uniqueQuestions.push(q);
        }
    }

    if (uniqueQuestions.length < questions.length) {
        console.warn(`[Question Generation] Final dedup removed ${questions.length - uniqueQuestions.length} duplicates from output.`);
    }

    // Shuffle and return
    return shuffleArray(uniqueQuestions).slice(0, count);
}

// Get marks based on difficulty
function getMarksForDifficulty(difficulty) {
    switch (difficulty) {
        case "easy":
            return 1;
        case "medium":
            return 2;
        case "hard":
            return 3;
        default:
            return 1;
    }
}

// Fisher-Yates shuffle
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get questions by topic
export async function getQuestionsByTopic(topic, options = {}) {
    const { difficulty, type, limit = 20 } = options;

    const query = { topic };

    if (difficulty) query.difficulty = difficulty;
    if (type) query.type = type;

    return Question.find(query).limit(limit);
}

// Create a custom question
export async function createQuestion(questionData) {
    const difficulty = classifyDifficulty(questionData);

    return Question.create({
        ...questionData,
        difficulty: questionData.difficulty || difficulty,
        marks: questionData.marks || getMarksForDifficulty(difficulty),
    });
}

// Get question statistics
export async function getQuestionStats(syllabusId) {
    const pipeline = [
        { $match: { syllabusId } },
        {
            $group: {
                _id: {
                    topic: "$topic",
                    difficulty: "$difficulty",
                },
                count: { $sum: 1 },
            },
        },
        {
            $group: {
                _id: "$_id.topic",
                difficulties: {
                    $push: {
                        difficulty: "$_id.difficulty",
                        count: "$count",
                    },
                },
                total: { $sum: "$count" },
            },
        },
    ];

    return Question.aggregate(pipeline);
}
