import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchSyllabi, setCurrentSession } from "../../store/studentSlice";
import { startSession } from "../../services/openai";
import { ROUTES } from "../../utils/constants";
import { parseError } from "../../utils/helpers";
import { BookIcon } from "../common/Icons";
import "./StudentComponents.css";

export default function QuizSession() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { syllabi } = useSelector((state) => state.student);

    const [selectedSyllabus, setSelectedSyllabus] = useState(null);
    const [selectedTopics, setSelectedTopics] = useState([]);
    const [timeLimit, setTimeLimit] = useState(10); // minutes
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

    const handleStartQuiz = async () => {
        if (selectedTopics.length === 0) {
            setError("Please select at least one topic");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const result = await startSession({
                type: "quiz",
                syllabusId: selectedSyllabus?._id,
                topics: selectedTopics,
                difficulty: "mixed",
                questionCount: 10,
                timeLimit: timeLimit * 60, // Convert to seconds
                questionMode,
            });

            dispatch(setCurrentSession(result.session));
            navigate(`${ROUTES.STUDENT.QUIZ}/session/${result.session.id}`);
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="quiz-session">
            <div className="page-header">
                <div className="page-header-row">
                    <h1>Quick Quiz</h1>
                    <Link
                        to={ROUTES.STUDENT.SESSIONS}
                        state={{ filterMode: 'quiz' }}
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
                                    {topic.name}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="setup-section">
                    <h3>Time Limit</h3>
                    <div className="time-selector">
                        {[5, 10, 15, 20].map((mins) => (
                            <button
                                key={mins}
                                className={`time-btn ${timeLimit === mins ? "active" : ""}`}
                                onClick={() => setTimeLimit(mins)}
                            >
                                {mins} min
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
                    <h3>Quiz Overview</h3>
                    <div className="overview-stats">
                        <div className="overview-stat">
                            <span className="stat-value">10</span>
                            <span className="stat-label">Questions</span>
                        </div>
                        <div className="overview-stat">
                            <span className="stat-value">{timeLimit} min</span>
                            <span className="stat-label">Duration</span>
                        </div>
                        <div className="overview-stat">
                            <span className="stat-value" style={{ textTransform: 'capitalize' }}>{questionMode}</span>
                            <span className="stat-label">Mode</span>
                        </div>
                        <div className="overview-stat">
                            <span className="stat-value">Auto</span>
                            <span className="stat-label">Submission</span>
                        </div>
                    </div>
                </div>

                <button
                    className="btn-primary btn-start quiz-start"
                    onClick={handleStartQuiz}
                    disabled={loading || selectedTopics.length === 0}
                >
                    {loading ? "Launching Quiz..." : "Start Timed Quiz"}
                </button>
            </div>
        </div>
    );
}
