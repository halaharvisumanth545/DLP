import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { clearCurrentSession } from "../../store/studentSlice";
import { submitAnswer, completeSession } from "../../services/openai";
import { ROUTES } from "../../utils/constants";
import { formatTime, getDifficultyColor, parseError } from "../../utils/helpers";
import "./StudentComponents.css";

export default function QuestionView() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { currentSession } = useSelector((state) => state.student);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [markedForReview, setMarkedForReview] = useState(new Set());
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [questionStartTime, setQuestionStartTime] = useState(Date.now());
    const [showExplanation, setShowExplanation] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const questions = currentSession?.questions || [];
    const currentQuestion = questions[currentIndex];
    const isPractice = currentSession?.type === "practice";

    // Timer for timed sessions
    useEffect(() => {
        if (currentSession?.totalTimeAllowed) {
            setTimeRemaining(currentSession.totalTimeAllowed);
        }
    }, [currentSession]);

    useEffect(() => {
        if (timeRemaining === null || timeRemaining <= 0) return;

        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    handleSubmitTest();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeRemaining]);

    // Reset question timer when moving to new question
    useEffect(() => {
        setQuestionStartTime(Date.now());
        setShowExplanation(false);
        setLastResult(null);
    }, [currentIndex]);

    const handleSelectAnswer = (answer) => {
        setAnswers({ ...answers, [currentQuestion.questionId]: answer });
    };

    const handleSubmitAnswer = async () => {
        if (!answers[currentQuestion.questionId]) return;

        setSubmitting(true);
        const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

        try {
            const result = await submitAnswer(sessionId, {
                questionId: currentQuestion.questionId,
                answer: answers[currentQuestion.questionId],
                timeSpent,
                markedForReview: markedForReview.has(currentIndex),
            });

            if (isPractice) {
                setLastResult(result);
                setShowExplanation(true);
            } else {
                // Auto move to next question for non-practice
                if (currentIndex < questions.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                }
            }
        } catch (err) {
            console.error("Submit answer error:", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleMarkForReview = () => {
        const newMarked = new Set(markedForReview);
        if (newMarked.has(currentIndex)) {
            newMarked.delete(currentIndex);
        } else {
            newMarked.add(currentIndex);
        }
        setMarkedForReview(newMarked);
    };

    const handleSubmitTest = async () => {
        try {
            await completeSession(sessionId);
            dispatch(clearCurrentSession());
            navigate(`${ROUTES.STUDENT.RESULTS}/${sessionId}`);
        } catch (err) {
            console.error("Complete session error:", err);
        }
    };

    if (!currentSession || !currentQuestion) {
        return <div className="loading">Loading questions...</div>;
    }

    return (
        <div className="question-view">
            {/* Header with timer and progress */}
            <div className="question-header">
                <div className="session-info">
                    <span className="session-type">{currentSession.type}</span>
                    <span className="progress">
                        Question {currentIndex + 1} of {questions.length}
                    </span>
                </div>
                {timeRemaining !== null && (
                    <div className={`timer ${timeRemaining < 60 ? "warning" : ""}`}>
                        ⏱️ {formatTime(timeRemaining)}
                    </div>
                )}
            </div>

            {/* Navigation panel */}
            <div className="question-nav-panel">
                {questions.map((_, index) => (
                    <button
                        key={index}
                        className={`nav-dot ${index === currentIndex ? "current" : ""} ${answers[questions[index].questionId] ? "answered" : ""
                            } ${markedForReview.has(index) ? "marked" : ""}`}
                        onClick={() => setCurrentIndex(index)}
                    >
                        {index + 1}
                    </button>
                ))}
            </div>

            {/* Question content */}
            <div className="question-content">
                <div className="question-meta">
                    <span
                        className="difficulty-badge"
                        style={{ backgroundColor: getDifficultyColor(currentQuestion.difficulty) }}
                    >
                        {currentQuestion.difficulty}
                    </span>
                    <span className="topic-badge">{currentQuestion.topic}</span>
                    <span className="marks-badge">{currentQuestion.marks} marks</span>
                </div>

                <h2 className="question-text">{currentQuestion.text}</h2>

                <div className="options-list">
                    {currentQuestion.options?.map((option) => (
                        <button
                            key={option.label}
                            className={`option-btn ${answers[currentQuestion.questionId] === option.label ? "selected" : ""
                                } ${showExplanation
                                    ? option.label === lastResult?.correctAnswer
                                        ? "correct"
                                        : answers[currentQuestion.questionId] === option.label
                                            ? "incorrect"
                                            : ""
                                    : ""
                                }`}
                            onClick={() => !showExplanation && handleSelectAnswer(option.label)}
                            disabled={showExplanation}
                        >
                            <span className="option-label">{option.label}</span>
                            <span className="option-text">{option.text}</span>
                        </button>
                    ))}
                </div>

                {showExplanation && lastResult && (
                    <div className={`explanation ${lastResult.isCorrect ? "correct" : "incorrect"}`}>
                        <h4>{lastResult.isCorrect ? "✅ Correct!" : "❌ Incorrect"}</h4>
                        {lastResult.explanation && <p>{lastResult.explanation}</p>}
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div className="question-actions">
                <div className="left-actions">
                    <button
                        className="btn-secondary"
                        onClick={handlePrevious}
                        disabled={currentIndex === 0}
                    >
                        ← Previous
                    </button>
                    <button
                        className={`btn-secondary ${markedForReview.has(currentIndex) ? "marked" : ""}`}
                        onClick={handleMarkForReview}
                    >
                        🔖 {markedForReview.has(currentIndex) ? "Marked" : "Mark for Review"}
                    </button>
                </div>

                <div className="right-actions">
                    {!showExplanation && (
                        <button
                            className="btn-primary"
                            onClick={handleSubmitAnswer}
                            disabled={!answers[currentQuestion.questionId] || submitting}
                        >
                            {submitting ? "Submitting..." : "Submit Answer"}
                        </button>
                    )}

                    {(showExplanation || !isPractice) && currentIndex < questions.length - 1 && (
                        <button className="btn-primary" onClick={handleNext}>
                            Next →
                        </button>
                    )}

                    {currentIndex === questions.length - 1 && (
                        <button className="btn-primary btn-finish" onClick={handleSubmitTest}>
                            Finish Test
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
