import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { fetchSessionHistory } from "../../store/studentSlice";
import { ROUTES } from "../../utils/constants";
import { formatDate } from "../../utils/helpers";
import "./StudentComponents.css";

export default function SessionsList() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { sessionHistory = [], sessionHistoryLoading, sessionHistoryPagination } = useSelector(
        (state) => state.student
    );
    const [page, setPage] = useState(1);

    useEffect(() => {
        dispatch(fetchSessionHistory({ page, limit: 20 }));
    }, [dispatch, page]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= (sessionHistoryPagination?.pages || 1)) {
            setPage(newPage);
        }
    };

    if (sessionHistoryLoading && page === 1) {
        return <div className="loading">Loading sessions...</div>;
    }

    return (
        <div className="sessions-page">
            <div className="page-header">
                <div className="header-top">
                    <button
                        className="btn-back"
                        onClick={() => navigate(ROUTES.STUDENT.ANALYTICS)}
                    >
                        ← Back to Analytics
                    </button>
                    <h1>📚 Session History</h1>
                </div>
                <p>View details and analysis of all your past learning sessions</p>
            </div>

            <div className="dashboard-content">
                <div className="dashboard-section">
                    <div className="sessions-list">
                        {sessionHistory && sessionHistory.length > 0 ? (
                            sessionHistory.map((session) => (
                                <Link
                                    to={`${ROUTES.STUDENT.RESULTS}/${session._id}`}
                                    state={{ from: 'analytics' }}
                                    key={session._id}
                                    className="session-item clickable"
                                >
                                    <span className="session-type">{session.type}</span>
                                    <span className="session-score">
                                        {session.score?.percentage != null ? `${session.score.percentage}%` : 'N/A'}
                                    </span>
                                    <span className="session-date">{formatDate(session.createdAt)}</span>
                                </Link>
                            ))
                        ) : (
                            <div className="no-data">No sessions found. Start learning!</div>
                        )}
                    </div>

                    {sessionHistoryPagination && sessionHistoryPagination.pages > 1 && (
                        <div className="pagination">
                            <button
                                className="btn-secondary"
                                disabled={page === 1}
                                onClick={() => handlePageChange(page - 1)}
                            >
                                Previous
                            </button>
                            <span className="page-info">
                                Page {page} of {sessionHistoryPagination.pages}
                            </span>
                            <button
                                className="btn-secondary"
                                disabled={page === sessionHistoryPagination.pages}
                                onClick={() => handlePageChange(page + 1)}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
