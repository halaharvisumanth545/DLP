import { Question } from "../models/Question.js";
import { Syllabus } from "../models/Syllabus.js";
import { generateQuestionsForTopic } from "./openaiService.js";
import { classifyDifficulty } from "../utils/difficultyClassifier.js";

// Generate or fetch questions for a session
export async function generateQuestions(options = {}) {
    const {
        syllabusId,
        topics = [],
        difficulty = "mixed",
        count = 10,
        type,
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

    // Try to fetch existing questions first
    const query = {
        topic: { $in: availableTopics },
    };

    if (difficulty !== "mixed") {
        query.difficulty = difficulty;
    }

    if (type) {
        query.type = type;
    }

    let questions = await Question.find(query).limit(count);

    // If not enough questions, generate more using AI
    if (questions.length < count) {
        const neededCount = count - questions.length;
        const questionsPerTopic = Math.ceil(neededCount / availableTopics.length);

        for (const topic of availableTopics) {
            if (questions.length >= count) break;

            const difficulties = difficulty === "mixed"
                ? ["easy", "medium", "hard"]
                : [difficulty];

            for (const diff of difficulties) {
                if (questions.length >= count) break;

                try {
                    const generatedQuestions = await generateQuestionsForTopic(topic, {
                        count: questionsPerTopic,
                        difficulty: diff,
                        type: type || "mcq",
                    });

                    // Save generated questions to database
                    for (const q of generatedQuestions) {
                        if (questions.length >= count) break;

                        const newQuestion = await Question.create({
                            syllabusId,
                            topic,
                            type: type || "mcq",
                            text: q.text,
                            options: q.options,
                            correctAnswer: q.correctAnswer,
                            explanation: q.explanation,
                            difficulty: q.difficulty || diff,
                            marks: getMarksForDifficulty(q.difficulty || diff),
                            isAIGenerated: true,
                        });

                        questions.push(newQuestion);
                    }
                } catch (error) {
                    console.error(`Failed to generate questions for ${topic}:`, error);
                }
            }
        }
    }

    // Shuffle questions
    return shuffleArray(questions).slice(0, count);
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
