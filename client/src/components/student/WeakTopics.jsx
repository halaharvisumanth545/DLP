import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { fetchWeakTopics } from "../../store/studentSlice";
import { ROUTES } from "../../utils/constants";
import { formatPercentage } from "../../utils/helpers";
import "./StudentComponents.css";

export default function WeakTopics() {
    const dispatch = useDispatch();
    const { weakTopics, weakTopicsLoading } = useSelector((state) => state.student);

    useEffect(() => {
        dispatch(fetchWeakTopics());
    }, [dispatch]);

    if (weakTopicsLoading) {
        return <div className="loading">Loading weak topics...</div>;
    }

    return (
        <div className="weak-topics-page">
            <div className="page-header">
                <h1>📍 Weak Topics Analysis</h1>
                <p>Focus on these areas to improve your overall performance</p>
            </div>

            {weakTopics.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">🎉</span>
                    <h3>No Weak Topics Detected!</h3>
                    <p>Great job! Keep practicing to maintain your performance.</p>
                    <Link to={ROUTES.STUDENT.PRACTICE} className="btn-primary">
                        Continue Practicing
                    </Link>
                </div>
            ) : (
                <>
                    <div className="weak-topics-summary">
                        <div className="summary-stat">
                            <span className="stat-value">{weakTopics.length}</span>
                            <span className="stat-label">Topics Need Attention</span>
                        </div>
                        <div className="summary-stat">
                            <span className="stat-value">
                                {weakTopics.filter((t) => t.improvementNeeded === "high").length}
                            </span>
                            <span className="stat-label">High Priority</span>
                        </div>
                    </div>

                    <div className="weak-topics-list">
                        {weakTopics.map((topic, index) => (
                            <div key={index} className={`weak-topic-card ${topic.improvementNeeded}`}>
                                <div className="topic-header">
                                    <span className="topic-rank">#{index + 1}</span>
                                    <h3 className="topic-name">{topic.topic}</h3>
                                    <span className={`priority-badge ${topic.improvementNeeded}`}>
                                        {topic.improvementNeeded === "high"
                                            ? "🔴 High Priority"
                                            : topic.improvementNeeded === "medium"
                                                ? "🟡 Medium"
                                                : "🟢 Low"}
                                    </span>
                                </div>

                                <div className="topic-stats">
                                    <div className="stat-item">
                                        <span className="stat-label">Current Accuracy</span>
                                        <span className={`stat-value ${topic.accuracy < 40 ? "critical" : "warning"}`}>
                                            {formatPercentage(topic.accuracy)}
                                        </span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Questions Attempted</span>
                                        <span className="stat-value">{topic.questionsAttempted}</span>
                                    </div>
                                </div>

                                <div className="topic-progress">
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${topic.accuracy}%`,
                                                backgroundColor: topic.accuracy < 40 ? "#ef4444" : "#f59e0b",
                                            }}
                                        />
                                    </div>
                                    <span className="progress-target">Target: 70%</span>
                                </div>

                                <div className="topic-actions">
                                    <Link
                                        to={`${ROUTES.STUDENT.PRACTICE}?topic=${encodeURIComponent(topic.topic)}`}
                                        className="btn-primary btn-sm"
                                    >
                                        Practice This Topic
                                    </Link>
                                    <Link
                                        to={`${ROUTES.STUDENT.STUDY_MATERIAL}?topic=${encodeURIComponent(topic.topic)}`}
                                        className="btn-secondary btn-sm"
                                    >
                                        Study Material
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="improvement-tips">
                        <h3>💡 Tips for Improvement</h3>
                        <ul>
                            <li>Focus on high-priority topics first</li>
                            <li>Review study material before practicing</li>
                            <li>Start with easier questions, then progress to harder ones</li>
                            <li>Practice consistently - aim for at least 10 questions per topic daily</li>
                            <li>Review explanations for incorrect answers</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}
