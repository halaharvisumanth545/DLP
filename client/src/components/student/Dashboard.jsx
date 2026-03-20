import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { fetchDashboard } from "../../store/studentSlice";
import { ROUTES } from "../../utils/constants";
import { formatDate, formatPercentage } from "../../utils/helpers";
import Confetti from "react-confetti";

import {
    BookIcon,
    LayersIcon,
    TargetIcon,
    FireIcon,
    ClipboardIcon,
    LightningIcon
} from "../common/Icons";
import "./StudentComponents.css";

export default function Dashboard() {
    const dispatch = useDispatch();
    const { dashboard, dashboardLoading, dashboardError } = useSelector(
        (state) => state.student
    );
    const [showStreakModal, setShowStreakModal] = useState(false);

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
                <h1>Welcome back, {dashboard?.user?.name || "Student"}!</h1>
            </div>

            <div className="dashboard-content">
                <div className="dashboard-section">
                    <div className="stats-grid">
                        <Link to={ROUTES.STUDENT.SYLLABI} className="stat-card clickable">
                            <span className="stat-icon"><BookIcon /></span>
                            <div className="stat-content">
                                <span className="stat-value">{stats.totalSyllabi || 0}</span>
                                <span className="stat-label">Syllabus Uploaded</span>
                            </div>
                        </Link>
                        <Link to={ROUTES.STUDENT.SESSIONS} state={{ from: 'dashboard' }} className="stat-card clickable">
                            <span className="stat-icon"><LayersIcon /></span>
                            <div className="stat-content">
                                <span className="stat-value">{stats.totalSessions || 0}</span>
                                <span className="stat-label">Sessions Completed</span>
                            </div>
                        </Link>
                        <Link to={ROUTES.STUDENT.SAVED_MATERIALS} state={{ from: 'dashboard' }} className="stat-card clickable">
                            <span className="stat-icon"><ClipboardIcon /></span>
                            <div className="stat-content">
                                <span className="stat-value">{stats.totalMaterialsGenerated || 0}</span>
                                <span className="stat-label">Materials Generated</span>
                            </div>
                        </Link>
                        <div className="stat-card">
                            <span className="stat-icon"><TargetIcon /></span>
                            <div className="stat-content">
                                <span className="stat-value">{formatPercentage(stats.overallAccuracy)}</span>
                                <span className="stat-label">Accuracy</span>
                            </div>
                        </div>
                        <div className="stat-card clickable" onClick={() => setShowStreakModal(true)}>
                            <span className="stat-icon"><LightningIcon /></span>
                            <div className="stat-content">
                                <span className="stat-value">
                                    <span className="custom-tooltip">
                                        {stats.visitingStreak || 0}
                                        <span className="tooltip-text">Visiting Streak: {stats.visitingStreak || 0}</span>
                                    </span>
                                    <span> / </span>
                                    <span className="custom-tooltip">
                                        {stats.practiceStreak || 0}
                                        <span className="tooltip-text">Practice Streak: {stats.practiceStreak || 0}</span>
                                    </span>
                                </span>
                                <span className="stat-label">Streaks</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="weak-topics-section dashboard-section">
                    <h2>Areas to Improve</h2>
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
                        <h2>Recent Sessions</h2>
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

            {/* Streak Details Modal */}
            {showStreakModal && (
                <div className="modal-overlay" onClick={() => setShowStreakModal(false)}>
                    <Confetti
                        width={window.innerWidth}
                        height={window.innerHeight}
                        recycle={false}
                        numberOfPieces={400}
                        gravity={0.12}
                    />
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <span className="stat-icon" style={{ fontSize: '2rem' }}><FireIcon /></span>
                            <h2 style={{ margin: 0 }}>Streak Details</h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--gray-50)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <LightningIcon />
                                    <span style={{ fontWeight: 500, color: 'var(--text-heading)' }}>Visiting Streak</span>
                                </div>
                                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>{stats.visitingStreak || 0}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--gray-50)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FireIcon />
                                    <span style={{ fontWeight: 500, color: 'var(--text-heading)' }}>Practice Streak</span>
                                </div>
                                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-secondary)' }}>{stats.practiceStreak || 0}</span>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn-primary"
                                style={{ width: '100%' }}
                                onClick={() => setShowStreakModal(false)}
                            >
                                Awesome
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
