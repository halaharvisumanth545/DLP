import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { fetchSessionHistory } from "../../store/studentSlice";
import { ROUTES } from "../../utils/constants";
import { formatDate } from "../../utils/helpers";
import { SearchIcon, FilterIcon, XIcon, BookIcon } from "../common/Icons";
import "./StudentComponents.css";

export default function SessionsList() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const filterMode = location.state?.filterMode;

    const { sessionHistory = [], sessionHistoryLoading } = useSelector(
        (state) => state.student
    );

    // Filter state
    const [searchTerm, setSearchTerm] = useState("");
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterSyllabi, setFilterSyllabi] = useState([]); // selected syllabus IDs or "General" Topic

    useEffect(() => {
        // Fetch all sessions (limit: 'all') so we can group them effectively
        dispatch(fetchSessionHistory({ page: 1, limit: 'all', type: filterMode }));
    }, [dispatch, filterMode]);

    // Derive unique syllabi/subjects from sessions for the filter modal
    const uniqueSubjects = useMemo(() => {
        const map = new Map();
        sessionHistory.forEach(s => {
            const subjectId = s.syllabusId?._id || "general";
            const subjectName = s.syllabusId?.fileName || (s.topics?.length ? s.topics[0] : "General Topic");

            if (!map.has(subjectId)) {
                map.set(subjectId, subjectName);
            }
        });
        return Array.from(map, ([id, name]) => ({ id, name }));
    }, [sessionHistory]);

    // Count active filters
    const activeFilterCount = filterSyllabi.length;

    // Filter logic
    const filteredSessions = useMemo(() => {
        return sessionHistory.filter(session => {
            const subjectId = session.syllabusId?._id || "general";
            const subjectName = session.syllabusId?.fileName || (session.topics?.length ? session.topics[0] : "General Topic");
            const typeName = session.type || "";

            // Search matches subject name or session type
            const searchMatches = !searchTerm ||
                subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                typeName.toLowerCase().includes(searchTerm.toLowerCase());

            // Syllabus/Subject filter
            const matchesSubject = filterSyllabi.length === 0 || filterSyllabi.includes(subjectId);

            return searchMatches && matchesSubject;
        });
    }, [sessionHistory, searchTerm, filterSyllabi]);

    // Group filtered sessions
    const groupedSessions = useMemo(() => {
        const groups = new Map();
        filteredSessions.forEach(session => {
            const subjectName = session.syllabusId?.fileName || (session.topics?.length ? session.topics[0] : "General Subject");
            if (!groups.has(subjectName)) groups.set(subjectName, []);
            groups.get(subjectName).push(session);
        });
        return Array.from(groups, ([name, items]) => ({ name, items }));
    }, [filteredSessions]);

    const toggleFilterSubject = (id) => {
        setFilterSyllabi(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };

    const clearAllFilters = () => {
        setFilterSyllabi([]);
    };

    if (sessionHistoryLoading && sessionHistory.length === 0) {
        return <div className="loading">Loading sessions...</div>;
    }

    let backButtonPath = ROUTES.STUDENT.ANALYTICS;
    if (location.state?.from === 'dashboard') {
        backButtonPath = ROUTES.STUDENT.DASHBOARD;
    } else if (location.state?.from === 'analytics') {
        backButtonPath = ROUTES.STUDENT.ANALYTICS;
    } else if (filterMode === 'test') {
        backButtonPath = ROUTES.STUDENT.TEST;
    } else if (filterMode === 'practice') {
        backButtonPath = ROUTES.STUDENT.PRACTICE;
    } else if (filterMode === 'quiz') {
        backButtonPath = ROUTES.STUDENT.QUIZ;
    }

    return (
        <div className="sessions-page saved-materials-page">
            <div className="page-header">
                <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {location.state && (
                            <a className="back-chevron" onClick={() => navigate(backButtonPath)} style={{ cursor: 'pointer' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </a>
                        )}
                        <h1 style={{ margin: 0, width: 'auto', textAlign: 'left' }}>
                            {filterMode ? `${filterMode.charAt(0).toUpperCase() + filterMode.slice(1)} Session History` : "Session History"}
                        </h1>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="search-box" style={{ marginBottom: 0, minWidth: '250px' }}>
                            <span className="search-icon"><SearchIcon /></span>
                            <input
                                type="text"
                                placeholder="Search subjects or types..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            className={`filter-btn${activeFilterCount > 0 ? " filter-btn--active" : ""}`}
                            onClick={() => setShowFilterModal(true)}
                            style={{ height: '38px', padding: '0 16px' }}
                        >
                            <FilterIcon />
                            <span>Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="filter-badge">{activeFilterCount}</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Active filter pills */}
            {activeFilterCount > 0 && (
                <div className="active-filters-bar">
                    {filterSyllabi.map(id => {
                        const s = uniqueSubjects.find(s => s.id === id);
                        return s ? (
                            <span key={id} className="active-filter-pill" onClick={() => toggleFilterSubject(id)}>
                                {s.name} <XIcon />
                            </span>
                        ) : null;
                    })}
                    <button className="clear-filters-link" onClick={clearAllFilters}>Clear all</button>
                </div>
            )}

            <div className="dashboard-content" style={{ marginTop: '20px' }}>
                {filteredSessions.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><BookIcon /></div>
                        <h3>No sessions found</h3>
                        <p>{searchTerm || activeFilterCount > 0 ? "Try adjusting your search or filters." : "You haven't completed any sessions yet."}</p>
                    </div>
                ) : (
                    <div className="materials-grouped">
                        {groupedSessions.map(group => (
                            <div key={group.name} className="syllabus-group">
                                <div className="syllabus-group__header">
                                    <BookIcon />
                                    <h2>{group.name}</h2>
                                    <span className="syllabus-group__count">{group.items.length} session{group.items.length !== 1 ? "s" : ""}</span>
                                </div>
                                <div className="sessions-list" style={{ marginTop: '12px' }}>
                                    {group.items.map((session, index) => {
                                        // Numbering within group (Reverse chronological)
                                        const sessionNumber = group.items.length - index;
                                        const typeName = session.type ? session.type.charAt(0).toUpperCase() + session.type.slice(1) : "Unknown";
                                        const sessionName = `${typeName} Session - ${sessionNumber}`;

                                        return (
                                            <Link
                                                to={`${ROUTES.STUDENT.RESULTS}/${session._id}`}
                                                state={{ from: 'history', filterMode }}
                                                key={session._id}
                                                className="session-item clickable"
                                            >
                                                <div className="session-name-col">
                                                    <span className={`session-type mode-tag ${session.type || 'practice'}`} style={{ marginRight: '8px' }}>
                                                        {session.type}
                                                    </span>
                                                    <span className="session-name">{sessionName}</span>
                                                </div>
                                                <span className="session-score">
                                                    {session.score?.percentage != null ? `${session.score.percentage}%` : 'N/A'}
                                                </span>
                                                <span className="session-date">{formatDate(session.createdAt)}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Filter Modal */}
            {showFilterModal && (
                <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
                    <div className="modal-content filter-modal" onClick={e => e.stopPropagation()}>
                        <div className="filter-modal__header">
                            <h2>Filter Sessions</h2>
                            <button className="filter-modal__close" onClick={() => setShowFilterModal(false)}>
                                <XIcon />
                            </button>
                        </div>

                        {/* Subject filter */}
                        <div className="filter-section">
                            <h4 className="filter-section__title">
                                <BookIcon /> Subjects
                            </h4>
                            <div className="filter-chips">
                                {uniqueSubjects.map(s => (
                                    <button
                                        key={s.id}
                                        className={`filter-chip${filterSyllabi.includes(s.id) ? " filter-chip--selected" : ""}`}
                                        onClick={() => toggleFilterSubject(s.id)}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                                {uniqueSubjects.length === 0 && (
                                    <span className="filter-section__empty">No subjects found</span>
                                )}
                            </div>
                        </div>

                        <div className="filter-modal__footer">
                            <button className="btn-secondary" onClick={clearAllFilters}>
                                Clear All
                            </button>
                            <button className="btn-primary" onClick={() => setShowFilterModal(false)}>
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

