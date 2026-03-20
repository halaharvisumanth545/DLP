import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSessionResult, getSessionQuestions } from "../../services/openai";
import { ROUTES } from "../../utils/constants";
import { getDifficultyColor, parseError } from "../../utils/helpers";
import { CheckCircleIcon, XCircleIcon } from "../common/Icons";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import "./StudentComponents.css";

export default function SessionReview() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [result, setResult] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewMode, setViewMode] = useState("questions"); // "questions" or "analysis"

    // Range Filter States
    const [appliedTimeRange, setAppliedTimeRange] = useState([0, 100]);
    const [appliedQuestionRange, setAppliedQuestionRange] = useState([1, 10]);
    const [localTimeRange, setLocalTimeRange] = useState([0, 100]);
    const [localQuestionRange, setLocalQuestionRange] = useState([1, 10]);
    const [isRangesInitialized, setIsRangesInitialized] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [resultData, questionsData] = await Promise.all([
                    getSessionResult(sessionId),
                    getSessionQuestions(sessionId),
                ]);
                setResult(resultData.result);
                setQuestions(questionsData.questions || []);
            } catch (err) {
                setError(parseError(err));
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [sessionId]);

    const currentQuestion = questions[currentIndex];
    const isDescriptive = currentQuestion && (currentQuestion.type === "descriptive" || !currentQuestion.options?.length);

    const handleNext = () => {
        if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
    };

    const handlePrevious = () => {
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    };

    const getPaletteBtnClass = (index) => {
        const q = questions[index];
        if (!q) return "palette-btn";
        const isCurrent = index === currentIndex;

        let cls = "palette-btn";
        if (isCurrent) cls += " palette-btn--current";
        else {
            const isDesc = q.type === "descriptive" || !q.options?.length;
            if (isDesc) {
                if (q.isSkipped) cls += " palette-btn--skipped"; // neutral
                else if (q.descriptiveScore) {
                    cls += q.descriptiveScore.percentage >= 50 ? " palette-btn--correct" : " palette-btn--incorrect";
                }
            } else {
                if (q.isSkipped) cls += " palette-btn--skipped"; // neutral
                else cls += q.isCorrect ? " palette-btn--correct" : " palette-btn--incorrect";
            }
        }
        return cls;
    };

    let cumulativeTime = 0;
    const rawChartData = result?.questionSwaps?.map((swap, index) => {
        const qIndex = questions.findIndex(q => q.questionId === swap.questionId || q.questionId === swap.questionId?._id);
        const qNum = qIndex >= 0 ? qIndex + 1 : 0;
        const qLabel = qNum > 0 ? `Q${qNum}` : "Unknown";
        cumulativeTime += (swap.timeSpent || 0);

        return {
            name: `Swap ${index + 1}`,
            questionLabel: qLabel,
            questionNumber: qNum,
            timeSpent: swap.timeSpent || 0,
            cumulativeTime: cumulativeTime,
        };
    }) || [];

    const chartData = rawChartData.length > 0 ? [
        {
            name: "Start",
            questionLabel: rawChartData[0].questionLabel,
            questionNumber: rawChartData[0].questionNumber,
            timeSpent: 0,
            cumulativeTime: 0,
        },
        ...rawChartData,
    ] : [];

    const totalTimeSwaps = chartData.length > 0 ? chartData[chartData.length - 1].cumulativeTime : 0;
    const maxAllocatedTime = result?.sessionId?.totalTimeAllowed || totalTimeSwaps; // Fix max slider time on early submission

    const totalQs = questions.length || 1;

    useEffect(() => {
        if (!isRangesInitialized && (maxAllocatedTime >= 0 || totalTimeSwaps >= 0) && totalQs > 0) {
            const maxTime = Math.max(maxAllocatedTime, 1); // fallback to 1s if 0 to avoid Recharts domain crash
            setAppliedTimeRange([0, maxTime]);
            setLocalTimeRange([0, maxTime]);
            setAppliedQuestionRange([1, totalQs]);
            setLocalQuestionRange([1, totalQs]);
            setIsRangesInitialized(true);
        }
    }, [maxAllocatedTime, totalTimeSwaps, totalQs, isRangesInitialized]);

    useEffect(() => {
        if (!isRangesInitialized) return;
        const handler = setTimeout(() => {
            setAppliedTimeRange(localTimeRange);
            setAppliedQuestionRange(localQuestionRange);
        }, 2000);
        return () => clearTimeout(handler);
    }, [localTimeRange, localQuestionRange, isRangesInitialized]);

    // Safety checks for chart domains
    const safeTimeDomain = [
        isNaN(appliedTimeRange[0]) ? 0 : appliedTimeRange[0],
        isNaN(appliedTimeRange[1]) || appliedTimeRange[1] <= 0 ? 1 : appliedTimeRange[1]
    ];

    const safeQuestionDomain = [
        isNaN(appliedQuestionRange[0]) ? 1 : appliedQuestionRange[0],
        isNaN(appliedQuestionRange[1]) || appliedQuestionRange[1] < 1 ? 1 : appliedQuestionRange[1]
    ];

    if (loading) return <div className="loading">Loading review...</div>;
    if (error) return <div className="error">Error: {error}</div>;
    if (!questions.length) return <div className="error">No questions found</div>;

    return (
        <div className="exam-layout">
            {/* Top Bar */}
            <div className="exam-topbar">
                <div className="exam-topbar__left">
                    <span className={`session-type-badge review`}>
                        Reviewing {result?.type ? result.type.charAt(0).toUpperCase() + result.type.slice(1) : "Session"}
                    </span>
                    <span className="exam-topbar__progress">
                        {currentIndex + 1} / {questions.length}
                    </span>
                </div>
                <div className="exam-topbar__right" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        className={`exam-btn ${viewMode === 'questions' ? 'exam-btn--primary' : 'exam-btn--secondary'}`}
                        onClick={() => setViewMode('questions')}
                        style={{ padding: '6px 16px' }}
                    >
                        Questions
                    </button>
                    <button
                        className={`exam-btn ${viewMode === 'analysis' ? 'exam-btn--primary' : 'exam-btn--secondary'}`}
                        onClick={() => setViewMode('analysis')}
                        style={{ padding: '6px 16px' }}
                    >
                        Time Analysis
                    </button>
                    <button className="exam-back-btn" onClick={() => navigate(`${ROUTES.STUDENT.RESULTS}/${sessionId}`)} style={{ marginLeft: '8px' }}>
                        Back to Result
                    </button>
                </div>
            </div>

            {/* Main Body */}
            <div className="exam-body-wrapper" style={viewMode === "analysis" ? { gridTemplateColumns: "1fr" } : {}}>
                {viewMode === "analysis" ? (
                    <div className="exam-main" style={{ width: '100%', padding: '24px', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: '24px', color: 'var(--text-main)' }}>Time vs Question Swaps Analysis</h2>

                        {!chartData.length ? (
                            <div className="empty-state">No time tracking data available for this session. Make sure you are spending time and navigating between questions to track swaps.</div>
                        ) : (
                            <>
                                <div style={{ width: '100%', height: 'calc(100vh - 400px)', minHeight: '400px', background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                            <XAxis
                                                type="number"
                                                dataKey="cumulativeTime"
                                                stroke="var(--text-muted)"
                                                tick={{ fill: 'var(--text-muted)' }}
                                                domain={safeTimeDomain}
                                                allowDataOverflow={true}
                                            />
                                            <YAxis
                                                type="number"
                                                dataKey="questionNumber"
                                                stroke="var(--text-muted)"
                                                tick={{ fill: 'var(--text-muted)' }}
                                                domain={safeQuestionDomain}
                                                allowDecimals={false}
                                                allowDataOverflow={true}
                                                label={{ value: 'Question Number', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)' }}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px' }}
                                                labelFormatter={(val) => `Time: ${val}s`}
                                                formatter={(value, name, props) => {
                                                    if (props.payload.name === "Start") return [`${props.payload.questionLabel} (Started)`, `Event: ${props.payload.name}`];
                                                    return [`${props.payload.questionLabel} (${props.payload.timeSpent}s spent)`, `Event: ${props.payload.name}`];
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="questionNumber"
                                                stroke="var(--color-primary)"
                                                strokeWidth={3}
                                                connectNulls={true}
                                                dot={{ r: 4, fill: 'var(--color-primary)', strokeWidth: 0 }}
                                                activeDot={{ r: 8, fill: 'var(--color-primary)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Graph Filters */}
                                <div style={{ marginTop: '24px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ marginBottom: '20px', color: 'var(--text-main)', fontSize: '1.1rem' }}>Adjust Scale & Range (Updates automatically in 2s)</h3>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {/* Time Range Filter */}
                                        <div>
                                            <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Time Scale (seconds)</h4>
                                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                                <div style={{ flex: '1 1 200px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Min Time: <strong style={{ color: 'var(--text-main)' }}>{localTimeRange[0]}s</strong></label>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min={0} max={Math.max(maxAllocatedTime, 1)}
                                                        value={localTimeRange[0]}
                                                        onChange={(e) => setLocalTimeRange([Math.min(Number(e.target.value), localTimeRange[1]), localTimeRange[1]])}
                                                        style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                                                    />
                                                </div>
                                                <div style={{ flex: '1 1 200px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Max Time: <strong style={{ color: 'var(--text-main)' }}>{localTimeRange[1]}s</strong></label>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min={0} max={Math.max(maxAllocatedTime, 1)}
                                                        value={localTimeRange[1]}
                                                        onChange={(e) => setLocalTimeRange([localTimeRange[0], Math.max(Number(e.target.value), localTimeRange[0])])}
                                                        style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Question Range Filter */}
                                        <div>
                                            <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Question Scale</h4>
                                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                                <div style={{ flex: '1 1 200px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Min Question: <strong style={{ color: 'var(--text-main)' }}>Q{localQuestionRange[0]}</strong></label>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min={1} max={totalQs}
                                                        value={localQuestionRange[0]}
                                                        onChange={(e) => setLocalQuestionRange([Math.min(Number(e.target.value), localQuestionRange[1] || 1), localQuestionRange[1]])}
                                                        style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                                                    />
                                                </div>
                                                <div style={{ flex: '1 1 200px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Max Question: <strong style={{ color: 'var(--text-main)' }}>Q{localQuestionRange[1]}</strong></label>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min={1} max={totalQs}
                                                        value={localQuestionRange[1]}
                                                        onChange={(e) => setLocalQuestionRange([localQuestionRange[0], Math.max(Number(e.target.value), localQuestionRange[0] || 1)])}
                                                        style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <>
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

                                {/* MCQ Options */}
                                {!isDescriptive && (
                                    <div className="exam-options-list">
                                        {currentQuestion.options?.map((option) => {
                                            const isCorrectOption = option.label === currentQuestion.correctAnswer;
                                            const isUserAnswer = option.label === currentQuestion.userAnswer;

                                            let optClass = "exam-option";
                                            if (isCorrectOption) optClass += " exam-option--correct";
                                            else if (isUserAnswer) optClass += " exam-option--incorrect";

                                            return (
                                                <div key={option.label} className={optClass} style={{ cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span className="exam-option__label">{option.label}</span>
                                                        <span className="exam-option__text">{option.text}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {isCorrectOption && <span className="review-option-tag correct-tag" style={{ display: 'flex', alignItems: 'center', color: 'var(--success-color)' }} title="Correct Answer"><CheckCircleIcon /></span>}
                                                        {isUserAnswer && !isCorrectOption && <span className="review-option-tag user-tag" style={{ display: 'flex', alignItems: 'center', color: 'var(--error-color)' }} title="Your Answer"><XCircleIcon /></span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Descriptive Review */}
                                {isDescriptive && (
                                    <div className="descriptive-review" style={{ marginTop: '20px' }}>
                                        {currentQuestion.descriptiveScore && (
                                            <div className="descriptive-score-card" style={{ marginBottom: '20px' }}>
                                                <div className="score-header">
                                                    <span className="score-value">{currentQuestion.descriptiveScore.score}/10</span>
                                                    <span className="score-percentage">({currentQuestion.descriptiveScore.percentage}%)</span>
                                                    <span className="score-coverage">{currentQuestion.descriptiveScore.keyPointsCovered}/{currentQuestion.descriptiveScore.totalKeyPoints} key points covered</span>
                                                </div>
                                                {currentQuestion.descriptiveScore.feedback && <p className="score-feedback">{currentQuestion.descriptiveScore.feedback}</p>}
                                            </div>
                                        )}
                                        <div className="descriptive-review-block user-answer-block" style={{ marginBottom: '16px' }}>
                                            <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>Your Answer:</strong>
                                            <div className="exam-descriptive-textarea" style={{ minHeight: '100px', opacity: 0.9, background: 'var(--bg-secondary)' }}>
                                                {currentQuestion.userAnswer || <em className="text-muted">No answer provided</em>}
                                            </div>
                                        </div>
                                        <div className="descriptive-review-block model-answer-block">
                                            <strong style={{ color: 'var(--success-color)', display: 'block', marginBottom: '8px' }}>Model Answer:</strong>
                                            <div className="exam-descriptive-textarea" style={{ minHeight: '100px', opacity: 0.9, borderColor: 'var(--success-color)', background: 'rgba(16, 185, 129, 0.05)' }}>
                                                {currentQuestion.correctAnswer}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Explanation */}
                                {currentQuestion.explanation && (() => {
                                    if (isDescriptive) {
                                        const text = currentQuestion.explanation.replace(/^Key\s*points\s*:\s*/i, '');
                                        const points = text.split(/\d+\)\s*/).filter(Boolean).map(s => s.trim().replace(/\.$/, ''));
                                        if (points.length > 1) {
                                            return (
                                                <div className="review-explanation" style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                                    <strong style={{ display: 'block', marginBottom: '8px' }}>Key Points:</strong>
                                                    <ol style={{ paddingLeft: '20px', margin: 0 }}>{points.map((pt, i) => <li key={i} style={{ marginBottom: '4px' }}>{pt}</li>)}</ol>
                                                </div>
                                            );
                                        }
                                    }
                                    return (
                                        <div className="review-explanation" style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                            <strong style={{ display: 'block', marginBottom: '8px' }}>Explanation:</strong> {currentQuestion.explanation}
                                        </div>
                                    );
                                })()}

                                <div className="review-meta" style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    <span>Time spent: {currentQuestion.timeSpent}s</span>
                                </div>
                            </div>

                            {/* Footer Actions */}
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
                                </div>
                                <div className="exam-footer__right">
                                    <button
                                        className="exam-btn exam-btn--primary"
                                        onClick={handleNext}
                                        disabled={currentIndex === questions.length - 1}
                                    >
                                        Next
                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right: Question Palette Sidebar */}
                        <aside className="exam-sidebar">
                            <div className="exam-sidebar__inner">
                                <div className="palette-title">Question Palette</div>

                                <div className="palette-grid">
                                    {questions.map((q, idx) => (
                                        <button
                                            key={idx}
                                            className={getPaletteBtnClass(idx)}
                                            onClick={() => setCurrentIndex(idx)}
                                            title={`Question ${idx + 1}`}
                                        >
                                            {idx + 1}
                                        </button>
                                    ))}
                                </div>

                                {/* Legend */}
                                <div className="palette-legend" style={{ marginTop: 'auto' }}>
                                    <div className="palette-legend__title">Legend</div>
                                    <div className="legend-item"><span className="legend-swatch legend-swatch--current" /><span>Current</span></div>
                                    <div className="legend-item"><span className="legend-swatch legend-swatch--correct" /><span>Correct / Good</span></div>
                                    <div className="legend-item"><span className="legend-swatch legend-swatch--incorrect" /><span>Incorrect / Bad</span></div>
                                    <div className="legend-item"><span className="legend-swatch legend-swatch--skipped" /><span>Skipped</span></div>
                                </div>
                            </div>
                        </aside>
                    </>
                )}
            </div>
        </div>
    );
}
