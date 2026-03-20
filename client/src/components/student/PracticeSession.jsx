import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchSyllabi, setCurrentSession } from "../../store/studentSlice";
import { startSession } from "../../services/openai";
import { ROUTES, DIFFICULTY_LEVELS } from "../../utils/constants";
import { parseError } from "../../utils/helpers";
import { BookIcon } from "../common/Icons";
import "./StudentComponents.css";

export default function PracticeSession() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { syllabi } = useSelector((state) => state.student);

    const [selectedSyllabus, setSelectedSyllabus] = useState(null);
    const [selectedTopics, setSelectedTopics] = useState([]);
    const [difficulty, setDifficulty] = useState("mixed");
    const [questionCount, setQuestionCount] = useState(10);
    const [questionMode, setQuestionMode] = useState("objective");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        dispatch(fetchSyllabi());
    }, [dispatch]);

    const handleTopicToggle = (topicName) => {
        setSelectedTopics((prev) =>
            prev.includes(topicName)
                ? prev.filter((t) => t !== topicName)
                : [...prev, topicName]
        );
    };

    const handleStartSession = async () => {
        if (selectedTopics.length === 0) {
            setError("Please select at least one topic");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const result = await startSession({
                type: "practice",
                syllabusId: selectedSyllabus?._id,
                topics: selectedTopics,
                difficulty,
                questionCount,
                questionMode,
            });

            dispatch(setCurrentSession(result.session));
            navigate(`${ROUTES.STUDENT.PRACTICE}/session/${result.session.id}`);
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="practice-session">
            <div className="page-header">
                <div className="page-header-row">
                    <h1>Practice Session</h1>
                    <Link
                        to={ROUTES.STUDENT.SESSIONS}
                        state={{ filterMode: 'practice' }}
                        className="btn-secondary"
                        style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        History
                    </Link>
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="session-setup">
                <div className="setup-section">
                    <h3>Select Syllabus</h3>
                    <div className="syllabus-grid">
                        {syllabi.map((s) => (
                            <div
                                key={s._id}
                                className={`syllabus-card ${selectedSyllabus?._id === s._id ? "selected" : ""}`}
                                onClick={() => {
                                    setSelectedSyllabus(s);
                                    setSelectedTopics([]);
                                }}
                            >
                                <span className="syllabus-icon"><BookIcon /></span>
                                <span className="syllabus-name">{s.fileName}</span>
                                <span className="topic-count">{s.topics?.length || 0} topics</span>
                            </div>
                        ))}
                    </div>
                </div>

                {selectedSyllabus && (
                    <div className="setup-section">
                        <h3>Select Topics</h3>
                        <div className="topics-grid">
                            {selectedSyllabus.topics?.map((topic, index) => (
                                <div
                                    key={index}
                                    className={`topic-chip ${selectedTopics.includes(topic.name) ? "selected" : ""}`}
                                    onClick={() => handleTopicToggle(topic.name)}
                                >
                                    <span>{topic.name}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            className="btn-text"
                            onClick={() =>
                                setSelectedTopics(selectedSyllabus.topics?.map((t) => t.name) || [])
                            }
                        >
                            Select All
                        </button>
                    </div>
                )}

                <div className="setup-section">
                    <h3>Difficulty Level</h3>
                    <div className="difficulty-selector">
                        {Object.entries(DIFFICULTY_LEVELS).map(([key, value]) => (
                            <button
                                key={key}
                                className={`difficulty-btn ${difficulty === value ? "active" : ""} ${value}`}
                                onClick={() => setDifficulty(value)}
                            >
                                {key}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="setup-section">
                    <h3>Number of Questions</h3>
                    <div className="question-count-selector">
                        {[5, 10, 15, 20, 25].map((count) => (
                            <button
                                key={count}
                                className={`count-btn ${questionCount === count ? "active" : ""}`}
                                onClick={() => setQuestionCount(count)}
                            >
                                {count}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="setup-section">
                    <h3>Question Mode</h3>
                    <div className="difficulty-selector">
                        {["objective", "descriptive", "mixed"].map((mode) => (
                            <button
                                key={mode}
                                className={`difficulty-btn ${questionMode === mode ? "active" : ""}`}
                                onClick={() => setQuestionMode(mode)}
                            >
                                {mode === "objective" ? "Objective" : mode === "descriptive" ? "Descriptive" : "Mixed"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="test-overview">
                    <h3>Session Summary</h3>
                    <div className="overview-stats">
                        <div className="overview-stat">
                            <span className="stat-value">{selectedTopics.length}</span>
                            <span className="stat-label">Topics</span>
                        </div>
                        <div className="overview-stat">
                            <span className="stat-value" style={{ textTransform: 'capitalize' }}>{difficulty}</span>
                            <span className="stat-label">Difficulty</span>
                        </div>
                        <div className="overview-stat">
                            <span className="stat-value">{questionCount}</span>
                            <span className="stat-label">Questions</span>
                        </div>
                        <div className="overview-stat">
                            <span className="stat-value" style={{ textTransform: 'capitalize' }}>{questionMode}</span>
                            <span className="stat-label">Mode</span>
                        </div>
                    </div>
                </div>

                <button
                    className="btn-primary btn-start"
                    onClick={handleStartSession}
                    disabled={loading || selectedTopics.length === 0}
                >
                    {loading ? "Starting..." : "Start Practice Session"}
                </button>
            </div>
        </div>
    );
}
