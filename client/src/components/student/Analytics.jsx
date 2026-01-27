import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom"; // Ensure import
import { fetchAnalytics, fetchWeakTopics } from "../../store/studentSlice";
import { getProgressHistory, getTopicPerformance } from "../../services/openai";
import { formatPercentage, formatTime, getDifficultyColor } from "../../utils/helpers";
import { ROUTES } from "../../utils/constants"; // Ensure import
import "./StudentComponents.css";

export default function Analytics() {
    const dispatch = useDispatch();
    const { analytics, analyticsLoading, weakTopics } = useSelector((state) => state.student);

    const [progressHistory, setProgressHistory] = useState([]);
    const [topicPerformance, setTopicPerformance] = useState([]);
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        dispatch(fetchAnalytics());
        dispatch(fetchWeakTopics());

        // Fetch progress history and process locally for correct timezone
        getProgressHistory(30).then((data) => {
            if (data.rawResults && Array.isArray(data.rawResults)) {
                // Client-side aggregation
                const progressByDate = {};

                data.rawResults.forEach((result) => {
                    // Use local date string to match user's timezone exactly
                    const date = new Date(result.createdAt);
                    // Format: YYYY-MM-DD (Local) - Construct manually to ensure sortability or use CA locale
                    // Using CA locale gives YYYY-MM-DD which is sortable and consistent
                    const dateKey = date.toLocaleDateString('en-CA');

                    if (!progressByDate[dateKey]) {
                        progressByDate[dateKey] = {
                            date: dateKey,
                            sessions: 0,
                            totalAccuracy: 0,
                            totalScore: 0,
                        };
                    }
                    progressByDate[dateKey].sessions++;
                    progressByDate[dateKey].totalAccuracy += result.accuracy || 0;
                    progressByDate[dateKey].totalScore += result.score?.percentage || 0;
                });

                const processedHistory = Object.values(progressByDate)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((day) => ({
                        date: day.date,
                        sessionsCompleted: day.sessions,
                        avgAccuracy: Math.round(day.totalAccuracy / day.sessions),
                        avgScore: Math.round(day.totalScore / day.sessions),
                    }));

                setProgressHistory(processedHistory);
            } else {
                // Fallback to server-side aggregation
                setProgressHistory(data.progressHistory || []);
            }
        });

        getTopicPerformance().then((data) => setTopicPerformance(data.topicPerformance || []));
    }, [dispatch]);

    if (analyticsLoading) {
        return <div className="loading">Loading analytics...</div>;
    }

    const diffPerf = analytics?.difficultyPerformance || {};

    return (
        <div className="analytics-page">
            <div className="page-header">
                <h1>📈 Analytics Dashboard</h1>
                <p>Track your learning progress and identify areas for improvement</p>
            </div>

            <div className="analytics-tabs">
                {["overview", "topics", "progress", "difficulty"].map((tab) => (
                    <button
                        key={tab}
                        className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            <div className="analytics-content">
                {activeTab === "overview" && (
                    <div className="analytics-overview">
                        <div className="stats-grid">
                            <Link to={ROUTES.STUDENT.SESSIONS} className="stat-card large clickable">
                                <span className="stat-icon">📊</span>
                                <div className="stat-content">
                                    <span className="stat-value">{analytics?.totalSessions || 0}</span>
                                    <span className="stat-label">Total Sessions</span>
                                </div>
                            </Link>
                            <div className="stat-card large">
                                <span className="stat-icon">❓</span>
                                <div className="stat-content">
                                    <span className="stat-value">{analytics?.totalQuestionsAttempted || 0}</span>
                                    <span className="stat-label">Questions Attempted</span>
                                </div>
                            </div>
                            <div className="stat-card large" style={{ justifyContent: 'center' }}>
                                <div className="stat-circular">
                                    <div
                                        className="circular-progress"
                                        style={{
                                            background: `conic-gradient(#6366f1 ${analytics?.overallAccuracy || 0}%, rgba(255,255,255,0.1) 0)`
                                        }}
                                    >
                                        <div className="inner-circle">
                                            <span className="percentage">{Math.round(analytics?.overallAccuracy || 0)}%</span>
                                        </div>
                                    </div>
                                    <span className="stat-label">Accuracy</span>
                                </div>
                            </div>
                            <div className="stat-card large">
                                <span className="stat-icon">⏱️</span>
                                <div className="stat-content">
                                    <span className="stat-value">{analytics?.avgTimePerQuestion || 0}s</span>
                                    <span className="stat-label">Avg Time/Question</span>
                                </div>
                            </div>
                        </div>

                        <div className="streaks-section">
                            <div className="stat-card streak current">
                                <span className="stat-icon">🔥</span>
                                <div className="stat-content">
                                    <span className="stat-value">{analytics?.streaks?.current || 0}</span>
                                    <span className="stat-label">Current Day Streak</span>
                                </div>
                            </div>
                            <div className="stat-card streak longest">
                                <span className="stat-icon">🏆</span>
                                <div className="stat-content">
                                    <span className="stat-value">{analytics?.streaks?.longest || 0}</span>
                                    <span className="stat-label">Longest Streak</span>
                                </div>
                            </div>
                        </div>

                        {weakTopics.length > 0 && (
                            <div className="weak-topics-section">
                                <h2>⚠️ Areas Needing Attention</h2>
                                <div className="weak-topics-list">
                                    {weakTopics.slice(0, 5).map((topic, index) => (
                                        <div key={index} className="weak-topic-item">
                                            <span className="topic-name">{topic.topic}</span>
                                            <span className={`topic-accuracy ${topic.accuracy < 40 ? "critical" : "warning"}`}>
                                                {formatPercentage(topic.accuracy)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "topics" && (
                    <div className="analytics-topics">
                        <h3>📚 Topic Performance</h3>
                        <div className="topics-grid">
                            {topicPerformance.map((topic, index) => (
                                <div key={index} className="topic-performance-card">
                                    <div className="card-header">
                                        <h4>{topic.topic}</h4>
                                        <span className={`accuracy-badge ${topic.accuracy >= 80 ? 'high' : topic.accuracy >= 50 ? 'medium' : 'low'}`}>
                                            {formatPercentage(topic.accuracy)}
                                        </span>
                                    </div>
                                    <div className="card-stats">
                                        <div className="stat">
                                            <span className="value">{topic.totalAttempted}</span>
                                            <span className="label">Attempted</span>
                                        </div>
                                        <div className="stat">
                                            <span className="value">{topic.totalCorrect}</span>
                                            <span className="label">Correct</span>
                                        </div>
                                        <div className="stat">
                                            <span className="value">{topic.avgTimePerQuestion}s</span>
                                            <span className="label">Avg Time</span>
                                        </div>
                                    </div>
                                    <div className="Topic-progress">
                                        <div className="progress-bg">
                                            <div
                                                className="progress-fill"
                                                style={{
                                                    width: `${topic.accuracy}%`,
                                                    backgroundColor: topic.accuracy >= 80 ? '#10b981' : topic.accuracy >= 50 ? '#f59e0b' : '#ef4444'
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "progress" && (
                    <div className="analytics-progress">
                        <h3>📅 Learning Trajectory (Last 30 Days)</h3>
                        <div className="progress-chart-container">
                            {progressHistory.length > 0 ? (
                                <>
                                    <div className="chart-y-axis">
                                        <span>100%</span>
                                        <span>75%</span>
                                        <span>50%</span>
                                        <span>25%</span>
                                        <span>0%</span>
                                    </div>
                                    <div className="chart-area-scroll">
                                        <div className="chart-wrapper">
                                            <div className="chart-grid-lines">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </div>
                                            {progressHistory.map((day, index) => (
                                                <div key={index} className="chart-column">
                                                    <div className="bar-wrapper">
                                                        <div
                                                            className="chart-bar"
                                                            style={{ height: `${day.avgAccuracy}%` }}
                                                        >
                                                            <span className="tooltip">
                                                                {day.date}<br />
                                                                <strong>{day.avgAccuracy}%</strong> Accuracy<br />
                                                                {day.sessionsCompleted} Sessions
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="bar-label">{day.date.slice(-5)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="chart-x-axis-title">Timeline (Last 30 Days)</div>
                                    </div>
                                </>
                            ) : (
                                <div className="no-data-state">
                                    <span>No activity recorded yet. Start learning to see your progress!</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "difficulty" && (
                    <div className="analytics-difficulty">
                        <h3>🎚️ Performance by Difficulty</h3>
                        <div className="difficulty-grid">
                            {["easy", "medium", "hard"].map((diff) => {
                                const data = diffPerf[diff] || { attempted: 0, correct: 0, accuracy: 0 };
                                const color = getDifficultyColor(diff);
                                return (
                                    <div key={diff} className="difficulty-stat-card">
                                        <div className="diff-header" style={{ borderColor: color }}>
                                            <h4 style={{ color: color }}>{diff.toUpperCase()}</h4>
                                            <span className="diff-accuracy" style={{ background: `${color}20`, color: color }}>
                                                {formatPercentage(data.accuracy)}
                                            </span>
                                        </div>
                                        <div className="diff-chart">
                                            <div
                                                className="circular-progress small"
                                                style={{
                                                    background: `conic-gradient(${color} ${data.accuracy}%, rgba(255,255,255,0.05) 0)`
                                                }}
                                            >
                                                <div className="inner-circle">
                                                    <span className="score">{data.correct}/{data.attempted}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="diff-footer">
                                            <span>Questions Attempted</span>
                                            <strong>{data.attempted}</strong>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
