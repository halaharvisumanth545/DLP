import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { getSessionResult } from "../../services/openai";
import { ROUTES } from "../../utils/constants";
import {
    formatPercentage,
    formatTime,
    calculateGrade,
    getDifficultyColor,
    parseError,
} from "../../utils/helpers";
import "./StudentComponents.css";

export default function ResultPage() {
    const { sessionId } = useParams();
    const location = useLocation();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Determine back link properties based on where we came from
    const fromPath = location.state?.from === 'analytics' ? ROUTES.STUDENT.ANALYTICS : ROUTES.STUDENT.DASHBOARD;
    const backLabel = location.state?.from === 'analytics' ? 'Back to Analytics' : 'Back to Dashboard';

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const data = await getSessionResult(sessionId);
                setResult(data.result);
            } catch (err) {
                setError(parseError(err));
            } finally {
                setLoading(false);
            }
        };

        fetchResult();
    }, [sessionId]);

    if (loading) {
        return <div className="loading">Loading results...</div>;
    }

    if (error) {
        return <div className="error">Error: {error}</div>;
    }

    if (!result) {
        return <div className="error">Result not found</div>;
    }

    const grade = calculateGrade(result.score?.percentage || 0);
    const isPassing = result.score?.percentage >= 50;

    return (
        <div className="result-page">
            <div className="result-header">
                <div className={`grade-circle ${isPassing ? "pass" : "fail"}`}>
                    <span className="grade-letter">{grade}</span>
                    <span className="grade-percentage">{formatPercentage(result.score?.percentage)}</span>
                </div>
                <div className="result-title">
                    <h1>{isPassing ? "Congratulations! 🎉" : "Keep Practicing! 💪"}</h1>
                    <p>Your {result.type} session has been completed</p>
                </div>
            </div>

            <div className="score-summary">
                <div className="summary-card">
                    <span className="summary-icon">📊</span>
                    <div>
                        <span className="summary-value">
                            {result.score?.obtained}/{result.score?.total}
                        </span>
                        <span className="summary-label">Score</span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="summary-icon">🎯</span>
                    <div>
                        <span className="summary-value">{formatPercentage(result.accuracy)}</span>
                        <span className="summary-label">Accuracy</span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="summary-icon">⏱️</span>
                    <div>
                        <span className="summary-value">{formatTime(result.timeSpent?.total)}</span>
                        <span className="summary-label">Time Spent</span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="summary-icon">📝</span>
                    <div>
                        <span className="summary-value">
                            {result.questionBreakdown?.correct}/{result.questionBreakdown?.total}
                        </span>
                        <span className="summary-label">Correct</span>
                    </div>
                </div>
            </div>

            <div className="result-breakdown">
                <div className="breakdown-section">
                    <h3>📈 Question Breakdown</h3>
                    <div className="breakdown-chart">
                        <div className="bar-chart">
                            <div
                                className="bar correct"
                                style={{
                                    width: `${(result.questionBreakdown?.correct / result.questionBreakdown?.total) * 100}%`,
                                }}
                            >
                                {result.questionBreakdown?.correct} Correct
                            </div>
                            <div
                                className="bar incorrect"
                                style={{
                                    width: `${(result.questionBreakdown?.incorrect / result.questionBreakdown?.total) * 100}%`,
                                }}
                            >
                                {result.questionBreakdown?.incorrect} Incorrect
                            </div>
                            {result.questionBreakdown?.skipped > 0 && (
                                <div
                                    className="bar skipped"
                                    style={{
                                        width: `${(result.questionBreakdown?.skipped / result.questionBreakdown?.total) * 100}%`,
                                    }}
                                >
                                    {result.questionBreakdown?.skipped} Skipped
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="breakdown-section">
                    <h3>🎚️ Difficulty Analysis</h3>
                    <div className="difficulty-breakdown">
                        {Object.entries(result.difficultyAnalysis || {}).map(([diff, data]) => (
                            <div key={diff} className="difficulty-item">
                                <div className="difficulty-header">
                                    <span
                                        className="difficulty-badge"
                                        style={{ backgroundColor: getDifficultyColor(diff) }}
                                    >
                                        {diff}
                                    </span>
                                    <span className="difficulty-accuracy">{formatPercentage(data.accuracy)}</span>
                                </div>
                                <div className="difficulty-progress">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${data.accuracy}%`, backgroundColor: getDifficultyColor(diff) }}
                                    />
                                </div>
                                <span className="difficulty-stats">
                                    {data.correct}/{data.attempted} correct
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="breakdown-section">
                    <h3>📚 Topic Performance</h3>
                    <div className="topic-breakdown">
                        {result.topicPerformance?.map((topic, index) => (
                            <div key={index} className="topic-item">
                                <div className="topic-info">
                                    <span className="topic-name">{topic.topic}</span>
                                    <span className="topic-stats">
                                        {topic.correct}/{topic.attempted} • {formatTime(topic.timeSpent)}
                                    </span>
                                </div>
                                <div className="topic-progress">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${topic.accuracy}%`,
                                            backgroundColor: topic.accuracy >= 70 ? "#10b981" : topic.accuracy >= 50 ? "#f59e0b" : "#ef4444",
                                        }}
                                    />
                                </div>
                                <span className={`topic-accuracy ${topic.accuracy < 50 ? "low" : ""}`}>
                                    {formatPercentage(topic.accuracy)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="result-actions">
                <Link to={fromPath} className="btn-secondary">
                    {backLabel}
                </Link>
                <Link to={ROUTES.STUDENT.ANALYTICS} className="btn-secondary">
                    View Analytics
                </Link>
                <Link to={ROUTES.STUDENT.PRACTICE} className="btn-primary">
                    Practice More
                </Link>
            </div>
        </div>
    );
}
