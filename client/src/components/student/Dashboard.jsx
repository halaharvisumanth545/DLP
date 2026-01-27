import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { fetchDashboard } from "../../store/studentSlice";
import { ROUTES } from "../../utils/constants";
import { formatDate, formatPercentage } from "../../utils/helpers";
import "./StudentComponents.css";

export default function Dashboard() {
    const dispatch = useDispatch();
    const { dashboard, dashboardLoading, dashboardError } = useSelector(
        (state) => state.student
    );

    useEffect(() => {
        dispatch(fetchDashboard());
    }, [dispatch]);

    if (dashboardLoading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    if (dashboardError) {
        return <div className="error">Error: {dashboardError}</div>;
    }

    const stats = dashboard?.stats || {};
    const weakTopics = dashboard?.weakTopics || [];

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>Welcome back, {dashboard?.user?.name || "Student"}! 👋</h1>
            </div>

            <div className="dashboard-content">
                <div className="dashboard-section">
                    <div className="stats-grid">
                        <Link to={ROUTES.STUDENT.SYLLABI} className="stat-card clickable">
                            <span className="stat-icon">📚</span>
                            <div className="stat-content">
                                <span className="stat-value">{stats.totalSyllabi || 0}</span>
                                <span className="stat-label">Syllabi Uploaded</span>
                            </div>
                        </Link>
                        <div className="stat-card">
                            <span className="stat-icon">✅</span>
                            <div className="stat-content">
                                <span className="stat-value">{stats.totalSessions || 0}</span>
                                <span className="stat-label">Sessions Completed</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <span className="stat-icon">🎯</span>
                            <div className="stat-content">
                                <span className="stat-value">{formatPercentage(stats.overallAccuracy)}</span>
                                <span className="stat-label">Accuracy</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <span className="stat-icon">🔥</span>
                            <div className="stat-content">
                                <span className="stat-value">{stats.currentStreak || 0}</span>
                                <span className="stat-label">Day Streak</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="weak-topics-section dashboard-section">
                    <h2>📍 Areas to Improve</h2>
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

                {dashboard?.recentSessions?.length > 0 && (
                    <div className="recent-sessions dashboard-section">
                        <h2>📅 Recent Sessions</h2>
                        <div className="sessions-list">
                            {dashboard.recentSessions.map((session) => (
                                <Link
                                    to={`${ROUTES.STUDENT.RESULTS}/${session._id}`}
                                    state={{ from: 'dashboard' }}
                                    key={session._id}
                                    className="session-item clickable"
                                >
                                    <span className="session-type">{session.type}</span>
                                    <span className="session-score">{session.score?.percentage || 0}%</span>
                                    <span className="session-date">{formatDate(session.createdAt)}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
