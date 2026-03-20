import { Session } from "../models/Session.js";
import { Question } from "../models/Question.js";
import { Result } from "../models/Result.js";
import { generateQuestions } from "../services/questionService.js";
import { updateUserAnalytics } from "../services/analyticsService.js";
import { evaluateDescriptiveAnswer } from "../services/openaiService.js";

// Start a new session (practice/quiz/test/self-assessment)
export async function startSession(req, res) {
    try {
        const { type, syllabusId, topics, difficulty = "mixed", questionCount = 10, timeLimit, questionMode = "objective", sectionsConfig } = req.body;
        const userId = req.user.userId;

        if (!type || !["practice", "quiz", "test", "self-assessment"].includes(type)) {
            return res.status(400).json({ error: "Valid session type is required" });
        }

        // Generate or fetch questions
        let questions = [];
        let generatedQuestionIds = [];

        if (sectionsConfig && sectionsConfig.length > 0) {
            for (const section of sectionsConfig) {
                const sectionQuestions = await generateQuestions({
                    syllabusId,
                    topics,
                    difficulty,
                    count: section.questionsPerSection,
                    type: undefined,
                    userId,
                    questionMode: section.questionType,
                    excludeIds: generatedQuestionIds,
                });

                // Override marks for this section
                const markedQuestions = sectionQuestions.map(q => {
                    q.marks = section.marksPerQuestion;
                    return q;
                });
                
                questions.push(...markedQuestions);
                
                // Track generated question IDs to prevent duplicates in next iterations
                markedQuestions.forEach(q => {
                    if (q._id) generatedQuestionIds.push(q._id.toString());
                });
            }
        } else {
            questions = await generateQuestions({
                syllabusId,
                topics,
                difficulty,
                count: questionCount,
                type: undefined, // Let questionMode determine the type
                userId,
                questionMode,
            });
        }

        // SAFETY NET: Remove any duplicate questions by _id and text before creating session
        const seenIds = new Set();
        const seenTexts = new Set();
        questions = questions.filter(q => {
            const id = q._id?.toString();
            const text = (q.text || "").toLowerCase().trim();
            if ((id && seenIds.has(id)) || seenTexts.has(text)) {
                return false;
            }
            if (id) seenIds.add(id);
            seenTexts.add(text);
            return true;
        });

        // Create session
        const session = await Session.create({
            userId,
            type,
            syllabusId,
            topics,
            difficulty,
            questions: questions.map((q) => ({
                questionId: q._id,
                questionData: {
                    text: q.text,
                    type: q.type,
                    options: q.options,
                    difficulty: q.difficulty,
                    topic: q.topic,
                    marks: q.marks,
                },
            })),
            answers: [],
            status: "in-progress",
            totalTimeAllowed: timeLimit || null,
            startedAt: new Date(),
        });

        res.status(201).json({
            message: "Session started",
            session: {
                id: session._id,
                type: session.type,
                questionCount: session.questions.length,
                totalTimeAllowed: session.totalTimeAllowed,
                questions: session.questions.map((q, index) => ({
                    index,
                    questionId: q.questionId,
                    text: q.questionData.text,
                    type: q.questionData.type,
                    options: q.questionData.options,
                    difficulty: q.questionData.difficulty,
                    topic: q.questionData.topic,
                    marks: q.questionData.marks,
                })),
            },
        });
    } catch (error) {
        console.error("Start session error:", error);
        res.status(500).json({ error: "Failed to start session" });
    }
}

// Submit answer for a question
export async function submitAnswer(req, res) {
    try {
        const { sessionId } = req.params;
        const { questionId, answer, timeSpent, markedForReview = false } = req.body;
        const userId = req.user.userId;

        const session = await Session.findOne({ _id: sessionId, userId, status: "in-progress" });
        if (!session) {
            return res.status(404).json({ error: "Active session not found" });
        }

        // Find the question
        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ error: "Question not found" });
        }

        // Check if correct — descriptive questions get AI evaluation
        const isDescriptive = question.type === "descriptive" || !question.options?.length;
        let isCorrect;
        let descriptiveScore = null;

        if (isDescriptive && answer?.trim()) {
            // Call OpenAI to evaluate the descriptive answer
            const evaluation = await evaluateDescriptiveAnswer({
                question: question.text,
                modelAnswer: question.correctAnswer || question.explanation || "No model answer provided.",
                userAnswer: answer,
            });
            if (evaluation) {
                descriptiveScore = evaluation;
                isCorrect = evaluation.percentage >= 50;
            } else {
                isCorrect = null; // Fallback if evaluation fails
            }
        } else if (isDescriptive) {
            isCorrect = null;
        } else {
            isCorrect = answer?.toLowerCase() === question.correctAnswer?.toLowerCase();
        }

        // Update or add answer
        const existingAnswerIndex = session.answers.findIndex(
            (a) => a.questionId.toString() === questionId
        );

        const answerData = {
            questionId,
            userAnswer: answer,
            isCorrect,
            descriptiveScore,
            timeSpent: timeSpent || 0,
            isSkipped: !answer,
            markedForReview,
        };

        if (existingAnswerIndex >= 0) {
            session.answers[existingAnswerIndex] = answerData;
        } else {
            session.answers.push(answerData);
        }

        await session.save();

        res.json({
            message: "Answer submitted",
            isCorrect: session.type !== "test" ? isCorrect : undefined,
            explanation: session.type === "practice" ? question.explanation : undefined,
            correctAnswer: session.type === "practice" ? question.correctAnswer : undefined,
            descriptiveScore: session.type !== "test" ? descriptiveScore : undefined,
        });
    } catch (error) {
        console.error("Submit answer error:", error);
        res.status(500).json({ error: "Failed to submit answer" });
    }
}

// Complete session and generate results
export async function completeSession(req, res) {
    try {
        const { sessionId } = req.params;
        const { questionSwaps = [] } = req.body;
        const userId = req.user.userId;

        const session = await Session.findOne({ _id: sessionId, userId });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        if (session.status === "completed") {
            const existingResult = await Result.findOne({ sessionId });
            return res.json({ message: "Session already completed", result: existingResult });
        }

        // Calculate scores
        const totalQuestions = session.questions.length;
        const answeredQuestions = session.answers.filter((a) => !a.isSkipped);
        const correctAnswers = session.answers.filter((a) => a.isCorrect);
        const totalMarks = session.questions.reduce((sum, q) => sum + (q.questionData.marks || 1), 0);
        const obtainedMarks = session.questions.reduce((sum, q, i) => {
            const answer = session.answers.find((a) => a.questionId.toString() === q.questionId.toString());
            return sum + (answer?.isCorrect ? (q.questionData.marks || 1) : 0);
        }, 0);

        // Calculate difficulty analysis
        const difficultyAnalysis = { easy: { attempted: 0, correct: 0 }, medium: { attempted: 0, correct: 0 }, hard: { attempted: 0, correct: 0 } };
        session.questions.forEach((q) => {
            const diff = q.questionData.difficulty || "medium";
            const answer = session.answers.find((a) => a.questionId.toString() === q.questionId.toString());
            if (answer && !answer.isSkipped) {
                difficultyAnalysis[diff].attempted++;
                if (answer.isCorrect) difficultyAnalysis[diff].correct++;
            }
        });

        Object.keys(difficultyAnalysis).forEach((diff) => {
            const d = difficultyAnalysis[diff];
            d.accuracy = d.attempted > 0 ? Math.round((d.correct / d.attempted) * 100) : 0;
        });

        // Calculate topic performance
        const topicMap = {};
        session.questions.forEach((q) => {
            const topic = q.questionData.topic || "General";
            if (!topicMap[topic]) topicMap[topic] = { attempted: 0, correct: 0, timeSpent: 0 };
            const answer = session.answers.find((a) => a.questionId.toString() === q.questionId.toString());
            if (answer && !answer.isSkipped) {
                topicMap[topic].attempted++;
                topicMap[topic].timeSpent += answer.timeSpent || 0;
                if (answer.isCorrect) topicMap[topic].correct++;
            }
        });

        const topicPerformance = Object.entries(topicMap).map(([topic, data]) => ({
            topic,
            ...data,
            accuracy: data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0,
        }));

        const totalTimeSpent = session.answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0);

        // Create result
        const result = await Result.create({
            sessionId,
            userId,
            type: session.type,
            score: {
                obtained: obtainedMarks,
                total: totalMarks,
                percentage: Math.round((obtainedMarks / totalMarks) * 100),
            },
            accuracy: Math.round((correctAnswers.length / answeredQuestions.length) * 100) || 0,
            timeSpent: {
                total: totalTimeSpent,
                average: Math.round(totalTimeSpent / totalQuestions),
            },
            difficultyAnalysis,
            topicPerformance,
            questionBreakdown: {
                total: totalQuestions,
                attempted: answeredQuestions.length,
                correct: correctAnswers.length,
                incorrect: answeredQuestions.length - correctAnswers.length,
                skipped: totalQuestions - answeredQuestions.length,
            },
            questionSwaps,
        });

        // Update session status
        session.status = "completed";
        session.completedAt = new Date();
        session.timeSpent = totalTimeSpent;
        session.score = result.score;
        session.questionSwaps = questionSwaps;
        await session.save();

        // Update user analytics
        await updateUserAnalytics(userId, result);

        res.json({
            message: "Session completed",
            result,
        });
    } catch (error) {
        console.error("Complete session error:", error);
        res.status(500).json({ error: "Failed to complete session" });
    }
}

// Get session by ID
export async function getSession(req, res) {
    try {
        const session = await Session.findOne({
            _id: req.params.sessionId,
            userId: req.user.userId,
        });

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        res.json({ session });
    } catch (error) {
        console.error("Get session error:", error);
        res.status(500).json({ error: "Failed to get session" });
    }
}

// Get session result
export async function getSessionResult(req, res) {
    try {
        const result = await Result.findOne({
            sessionId: req.params.sessionId,
        }).populate("sessionId", "totalTimeAllowed type status");

        if (!result) {
            return res.status(404).json({ error: "Result not found" });
        }

        // Verify ownership
        if (result.userId.toString() !== req.user.userId) {
            return res.status(403).json({ error: "Forbidden" });
        }

        res.json({ result });
    } catch (error) {
        console.error("Get session result error:", error);
        res.status(500).json({ error: "Failed to get session result" });
    }
}

// Get session questions with answers for review
export async function getSessionQuestions(req, res) {
    try {
        const { sessionId } = req.params;
        const userId = req.user.userId;

        const session = await Session.findOne({ _id: sessionId, userId });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        // Build questions with user answers and correct answers
        const questionsWithAnswers = await Promise.all(
            session.questions.map(async (q) => {
                const answer = session.answers.find(
                    (a) => a.questionId.toString() === q.questionId.toString()
                );

                // Get correct answer from Question model
                let correctAnswer = null;
                let explanation = null;
                try {
                    const questionDoc = await Question.findById(q.questionId);
                    if (questionDoc) {
                        correctAnswer = questionDoc.correctAnswer;
                        explanation = questionDoc.explanation;

                        // Fallback if the AI incorrectly generated exactly "N/A"
                        if ((!correctAnswer || correctAnswer === "N/A") && q.questionData.type === "descriptive") {
                            correctAnswer = explanation || "No model answer was generated.";
                        }
                    }
                } catch (err) {
                    // Question may have been deleted
                }

                return {
                    questionId: q.questionId,
                    text: q.questionData.text,
                    type: q.questionData.type || "mcq",
                    options: q.questionData.options,
                    difficulty: q.questionData.difficulty,
                    topic: q.questionData.topic,
                    marks: q.questionData.marks,
                    correctAnswer,
                    explanation,
                    userAnswer: answer?.userAnswer || null,
                    isCorrect: answer?.isCorrect || false,
                    descriptiveScore: answer?.descriptiveScore || null,
                    isSkipped: answer ? answer.isSkipped : true,
                    timeSpent: answer?.timeSpent || 0,
                };
            })
        );

        res.json({ questions: questionsWithAnswers });
    } catch (error) {
        console.error("Get session questions error:", error);
        res.status(500).json({ error: "Failed to get session questions" });
    }
}
