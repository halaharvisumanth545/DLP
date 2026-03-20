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
    const [submittedAnswers, setSubmittedAnswers] = useState(new Set());
    const [markedForReview, setMarkedForReview] = useState(new Set());
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [questionStartTime, setQuestionStartTime] = useState(Date.now());
    const [showExplanation, setShowExplanation] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [results, setResults] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0); // for Test palette navigation
    const [questionSwaps, setQuestionSwaps] = useState([]);

    const questions = currentSession?.questions || [];
    const currentQuestion = questions[currentIndex];
    const isPractice = currentSession?.type === "practice";
    const isTest = currentSession?.type === "test";
    const isDescriptive = currentQuestion && (currentQuestion.type === "descriptive" || !currentQuestion.options?.length);

    // Build sections for Test palette navigation
    const sectionsConfig = currentSession?.sectionsConfig || null;
    const paletteGroups = (() => {
        if (!isTest || !sectionsConfig) {
            return [{ label: "Questions", questions: questions.map((_, i) => i) }];
        }
        const groups = [];
        let offset = 0;
        sectionsConfig.forEach((sec, idx) => {
            const count = sec.questionsPerSection || 0;
            const indices = Array.from({ length: count }, (_, i) => offset + i);
            groups.push({ label: `Section ${sec.section || idx + 1}`, questions: indices });
            offset += count;
        });
        return groups;
    })();

    const currentPaletteGroup = paletteGroups[currentSectionIndex] || paletteGroups[0];

    // Timer
    useEffect(() => {
        if (currentSession?.totalTimeAllowed) {
            setTimeRemaining(currentSession.totalTimeAllowed);
        }
    }, [currentSession]);

    useEffect(() => {
        if (timeRemaining === null || timeRemaining <= 0) return;
        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) { handleSubmitTest(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [timeRemaining]);

    // Reset per question and track time
    useEffect(() => {
        setQuestionStartTime(Date.now());
        setShowExplanation(false);
        setLastResult(null);
        
        const currentQId = currentSession?.questions?.[currentIndex]?.questionId;
        const startTime = Date.now();
        
        return () => {
            if (currentQId) {
                const timeSpent = Math.round((Date.now() - startTime) / 1000);
                setQuestionSwaps(prev => [...prev, {
                    questionId: currentQId,
                    timeSpent,
                    timestamp: new Date().toISOString()
                }]);
            }
        };
    }, [currentIndex, currentSession]);

    const handleSelectAnswer = (answer) => {
        if (showExplanation) return;
        setAnswers({ ...answers, [currentQuestion.questionId]: answer });
    };

    const handleSubmitAnswer = async () => {
        if (!isPractice) {
            if (!answers[currentQuestion.questionId] && !isDescriptive) return;
            if (isDescriptive && !answers[currentQuestion.questionId]?.trim()) return;
        }
        setSubmitting(true);
        const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
        try {
            const result = await submitAnswer(sessionId, {
                questionId: currentQuestion.questionId,
                answer: answers[currentQuestion.questionId],
                timeSpent,
                markedForReview: markedForReview.has(currentIndex),
            });
            setSubmittedAnswers(prev => new Set(prev).add(currentQuestion.questionId));
            if (isPractice) {
                setLastResult(result);
                setResults(prev => ({ ...prev, [currentQuestion.questionId]: result }));
                setShowExplanation(true);
            } else {
                if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
            }
        } catch (err) {
            console.error("Submit answer error:", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
    };

    const handlePrevious = () => {
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    };

    const handleMarkForReview = () => {
        const newMarked = new Set(markedForReview);
        if (newMarked.has(currentIndex)) newMarked.delete(currentIndex);
        else newMarked.add(currentIndex);
        setMarkedForReview(newMarked);
    };

    const handleSubmitTest = async () => {
        const timeSpentFinal = Math.round((Date.now() - questionStartTime) / 1000);
        const finalSwaps = [...questionSwaps, {
            questionId: currentQuestion?.questionId,
            timeSpent: timeSpentFinal,
            timestamp: new Date().toISOString()
        }].filter(s => s.questionId);

        try {
            await completeSession(sessionId, { questionSwaps: finalSwaps });
            dispatch(clearCurrentSession());
            navigate(`${ROUTES.STUDENT.RESULTS}/${sessionId}`);
        } catch (err) {
            console.error("Complete session error:", err);
        }
    };

    const getPaletteBtnClass = (index) => {
        const q = questions[index];
        if (!q) return "palette-btn";
        const isCurrent = index === currentIndex;
        const isAnswered = submittedAnswers.has(q.questionId);
        const isMarked = markedForReview.has(index);
        const res = results[q.questionId];

        let cls = "palette-btn";
        if (isCurrent) cls += " palette-btn--current";
        else if (isMarked) cls += " palette-btn--marked";
        else if (isPractice && res) {
            const isDesc = q.type === "descriptive" || !q.options?.length;
            if (isDesc && res.descriptiveScore) {
                cls += res.descriptiveScore.percentage >= 50 ? " palette-btn--correct" : " palette-btn--incorrect";
            } else {
                cls += res.isCorrect ? " palette-btn--correct" : " palette-btn--incorrect";
            }
        } else if (isAnswered) cls += " palette-btn--answered";
        return cls;
    };

    const answeredCount = submittedAnswers.size;
    const markedCount = markedForReview.size;

    // Practice answer card helpers
    const getResultHeading = (res) => {
        const ds = res?.descriptiveScore;
        if (isDescriptive && ds) {
            if (ds.percentage >= 80) return { text: "Excellent!", cls: "correct" };
            if (ds.percentage >= 50) return { text: "Good Attempt", cls: "neutral" };
            return { text: "Needs Improvement", cls: "incorrect" };
        }
        if (res?.isCorrect === true) return { text: "Correct!", cls: "correct" };
        if (res?.isCorrect === false) return { text: "Incorrect", cls: "incorrect" };
        return { text: "Answer Submitted", cls: "neutral" };
    };

    if (!currentSession || !currentQuestion) {
        return <div className="loading">Loading questions...</div>;
    }

    const heading = lastResult ? getResultHeading(lastResult) : null;

    return (
        <div className="exam-layout">
            {/* ── Top Bar ── */}
            <div className="exam-topbar">
                <div className="exam-topbar__left">
                    <span className={`session-type-badge ${currentSession.type}`}>
                        {currentSession.type.charAt(0).toUpperCase() + currentSession.type.slice(1)}
                    </span>
                    <span className="exam-topbar__progress">
                        {currentIndex + 1} / {questions.length}
                    </span>
                </div>
                <div className="exam-topbar__right">
                    {timeRemaining !== null && (
                        <div className={`exam-timer ${timeRemaining < 60 ? "exam-timer--warning" : ""}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {formatTime(timeRemaining)}
                        </div>
                    )}
                    <button className="exam-submit-btn" onClick={handleSubmitTest}>
                        Submit Test
                    </button>
                </div>
            </div>

            {/* ── Main Body ── */}
            <div className="exam-body-wrapper">
                {/* Left: Question Area */}
                <div className="exam-main">
                    {/* Question Meta */}
                    <div className="exam-question-meta">
                        <div className="exam-question-label">
                            <span className="exam-q-number">Q{currentIndex + 1}</span>
                            <span
                                className="exam-difficulty-badge"
                                style={{ background: getDifficultyColor(currentQuestion.difficulty) }}
                            >
                                {currentQuestion.difficulty}
                            </span>
                            {currentQuestion.topic && (
                                <span className="exam-topic-badge">{currentQuestion.topic}</span>
                            )}
                        </div>
                        <span className="exam-marks-badge">{currentQuestion.marks} mark{currentQuestion.marks !== 1 ? "s" : ""}</span>
                    </div>

                    {/* Scrollable Question + Options */}
                    <div className="exam-question-body">
                        <p className="exam-question-text">{currentQuestion.text}</p>

                        {/* MCQ */}
                        {!isDescriptive && (
                            <div className="exam-options-list">
                                {currentQuestion.options?.map((option) => {
                                    let optClass = "exam-option";
                                    if (showExplanation) {
                                        if (option.label === lastResult?.correctAnswer) optClass += " exam-option--correct";
                                        else if (answers[currentQuestion.questionId] === option.label) optClass += " exam-option--incorrect";
                                    } else if (answers[currentQuestion.questionId] === option.label) {
                                        optClass += " exam-option--selected";
                                    }
                                    return (
                                        <button
                                            key={option.label}
                                            className={optClass}
                                            onClick={() => handleSelectAnswer(option.label)}
                                            disabled={showExplanation}
                                        >
                                            <span className="exam-option__label">{option.label}</span>
                                            <span className="exam-option__text">{option.text}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Descriptive */}
                        {isDescriptive && (
                            <div className="exam-descriptive-section">
                                <label className="exam-descriptive-label">Your Answer</label>
                                <textarea
                                    className="exam-descriptive-textarea"
                                    placeholder="Type your answer here... Include key points and important concepts."
                                    value={answers[currentQuestion.questionId] || ""}
                                    onChange={(e) => setAnswers({ ...answers, [currentQuestion.questionId]: e.target.value })}
                                    disabled={showExplanation}
                                    rows={7}
                                />
                            </div>
                        )}

                        {/* ── Practice: Answer Reveal Card ── */}
                        {isPractice && showExplanation && lastResult && (
                            <div className={`answer-reveal-card answer-reveal-card--${heading.cls}`}>
                                <div className="answer-reveal-card__header">
                                    <span className={`answer-reveal-verdict answer-reveal-verdict--${heading.cls}`}>
                                        {heading.cls === "correct" && "✓ "}{heading.cls === "incorrect" && "✗ "}{heading.text}
                                    </span>
                                    {isDescriptive && lastResult.descriptiveScore && (
                                        <span className="answer-reveal-score">
                                            {lastResult.descriptiveScore.score}/10
                                            &nbsp;·&nbsp;
                                            {lastResult.descriptiveScore.keyPointsCovered}/{lastResult.descriptiveScore.totalKeyPoints} key pts
                                        </span>
                                    )}
                                </div>

                                {isDescriptive && lastResult.descriptiveScore?.feedback && (
                                    <p className="answer-reveal-feedback">{lastResult.descriptiveScore.feedback}</p>
                                )}

                                {isDescriptive && lastResult.correctAnswer && (
                                    <div className="answer-reveal-model">
                                        <span className="answer-reveal-model__label">Model Answer</span>
                                        <p>{lastResult.correctAnswer}</p>
                                    </div>
                                )}

                                {!isDescriptive && lastResult.correctAnswer && (
                                    <div className="answer-reveal-model">
                                        <span className="answer-reveal-model__label">Correct Answer</span>
                                        <p><strong>{lastResult.correctAnswer}</strong></p>
                                    </div>
                                )}

                                {lastResult.explanation && (() => {
                                    if (isDescriptive) {
                                        const text = lastResult.explanation.replace(/^Key\s*points\s*:\s*/i, '');
                                        const points = text.split(/\d+\)\s*/).filter(Boolean).map(s => s.trim().replace(/\.$/, ''));
                                        if (points.length > 1) {
                                            return (
                                                <div className="answer-reveal-keypoints">
                                                    <span className="answer-reveal-model__label">Key Points</span>
                                                    <ol>{points.map((pt, i) => <li key={i}>{pt}</li>)}</ol>
                                                </div>
                                            );
                                        }
                                    }
                                    return (
                                        <div className="answer-reveal-model">
                                            <span className="answer-reveal-model__label">Explanation</span>
                                            <p>{lastResult.explanation}</p>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* ── Footer Actions ── */}
                    <div className="exam-footer">
                        <div className="exam-footer__left">
                            <button
                                className="exam-btn exam-btn--secondary"
                                onClick={handlePrevious}
                                disabled={currentIndex === 0}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                Previous
                            </button>
                            <button
                                className={`exam-btn exam-btn--mark ${markedForReview.has(currentIndex) ? "exam-btn--mark-active" : ""}`}
                                onClick={handleMarkForReview}
                            >
                                🔖 {markedForReview.has(currentIndex) ? "Marked" : "Mark for Review"}
                            </button>
                        </div>

                        <div className="exam-footer__right">
                            {!showExplanation && (
                                <button
                                    className="exam-btn exam-btn--primary"
                                    onClick={handleSubmitAnswer}
                                    disabled={submitting || (!isPractice && (isDescriptive ? !answers[currentQuestion.questionId]?.trim() : !answers[currentQuestion.questionId]))}
                                >
                                    {submitting
                                        ? <><span className="btn-spinner" />Evaluating...</>
                                        : isPractice && (!answers[currentQuestion.questionId] || (isDescriptive && !answers[currentQuestion.questionId]?.trim()))
                                            ? "Show Answer"
                                            : "Submit Answer"
                                    }
                                </button>
                            )}

                            {(showExplanation || !isPractice) && currentIndex < questions.length - 1 && (
                                <button className="exam-btn exam-btn--primary" onClick={handleNext}>
                                    Next
                                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </button>
                            )}

                            {currentIndex === questions.length - 1 && (
                                <button className="exam-btn exam-btn--finish" onClick={handleSubmitTest}>
                                    Finish & Submit
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Question Palette Sidebar */}
                <aside className="exam-sidebar">
                    <div className="exam-sidebar__inner">
                        <div className="palette-title">Question Palette</div>

                        {/* Section Navigator — Test only, only if multiple sections */}
                        {isTest && paletteGroups.length > 1 && (
                            <div className="palette-section-nav">
                                <button
                                    className="palette-section-nav__arrow"
                                    onClick={() => {
                                        const newIdx = Math.max(0, currentSectionIndex - 1);
                                        setCurrentSectionIndex(newIdx);
                                        // Navigate to first question of that section
                                        const firstQ = paletteGroups[newIdx]?.questions[0];
                                        if (firstQ !== undefined) setCurrentIndex(firstQ);
                                    }}
                                    disabled={currentSectionIndex === 0}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                </button>
                                <span className="palette-section-nav__label">{currentPaletteGroup.label}</span>
                                <button
                                    className="palette-section-nav__arrow"
                                    onClick={() => {
                                        const newIdx = Math.min(paletteGroups.length - 1, currentSectionIndex + 1);
                                        setCurrentSectionIndex(newIdx);
                                        // Navigate to first question of that section
                                        const firstQ = paletteGroups[newIdx]?.questions[0];
                                        if (firstQ !== undefined) setCurrentIndex(firstQ);
                                    }}
                                    disabled={currentSectionIndex === paletteGroups.length - 1}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </button>
                            </div>
                        )}

                        {/* Single section label for Practice/Quiz */}
                        {!isTest && (
                            <div className="palette-section-label">All Questions</div>
                        )}

                        {/* Palette Grid */}
                        <div className="palette-grid">
                            {currentPaletteGroup.questions.map((qIdx) => (
                                <button
                                    key={qIdx}
                                    className={getPaletteBtnClass(qIdx)}
                                    onClick={() => setCurrentIndex(qIdx)}
                                    title={`Question ${qIdx + 1}`}
                                >
                                    {qIdx + 1}
                                </button>
                            ))}
                        </div>

                        {/* Stats pills */}
                        <div className="palette-stats">
                            <div className="palette-stat-pill">
                                <span className="palette-stat-pill__count">{answeredCount}</span>
                                Answered
                            </div>
                            <div className="palette-stat-pill">
                                <span className="palette-stat-pill__count">{markedCount}</span>
                                Marked
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="palette-legend">
                            <div className="palette-legend__title">Legend</div>
                            <div className="legend-item"><span className="legend-swatch legend-swatch--current" /><span>Current</span></div>
                            <div className="legend-item"><span className="legend-swatch legend-swatch--answered" /><span>Answered</span></div>
                            <div className="legend-item"><span className="legend-swatch legend-swatch--marked" /><span>Marked for Review</span></div>
                            {isPractice && <>
                                <div className="legend-item"><span className="legend-swatch legend-swatch--correct" /><span>Correct</span></div>
                                <div className="legend-item"><span className="legend-swatch legend-swatch--incorrect" /><span>Incorrect</span></div>
                            </>}
                            <div className="legend-item"><span className="legend-swatch legend-swatch--default" /><span>Not Visited</span></div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
