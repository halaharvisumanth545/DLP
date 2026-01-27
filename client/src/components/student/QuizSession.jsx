import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchSyllabi, setCurrentSession } from "../../store/studentSlice";
import { startSession } from "../../services/openai";
import { ROUTES } from "../../utils/constants";
import { parseError } from "../../utils/helpers";
import "./StudentComponents.css";

export default function QuizSession() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { syllabi } = useSelector((state) => state.student);

    const [selectedSyllabus, setSelectedSyllabus] = useState(null);
    const [selectedTopics, setSelectedTopics] = useState([]);
    const [timeLimit, setTimeLimit] = useState(10); // minutes
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
                <h1>⚡ Quick Quiz</h1>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="quiz-features">
                <div className="feature-badge">⏱️ Countdown timer</div>
                <div className="feature-badge">📝 10 targeted MCQs</div>
                <div className="feature-badge">🎯 Score + feedback</div>
            </div>

            <div className="session-setup">
                <div className="setup-section">
                    <h3>Select Syllabus</h3>
                    <div className="syllabus-grid compact">
                        {syllabi.map((s) => (
                            <div
                                key={s._id}
                                className={`syllabus-card ${selectedSyllabus?._id === s._id ? "selected" : ""}`}
                                onClick={() => {
                                    setSelectedSyllabus(s);
                                    setSelectedTopics([]);
                                }}
                            >
                                <span className="syllabus-name">{s.fileName}</span>
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

                <div className="quiz-summary">
                    <p>📝 10 questions pulled from your selected topics</p>
                    <p>⏱️ {timeLimit}-minute countdown with auto-submit</p>
                    <p>🎯 Review results right after submission</p>
                </div>

                <button
                    className="btn-primary btn-start quiz-start"
                    onClick={handleStartQuiz}
                    disabled={loading || selectedTopics.length === 0}
                >
                    {loading ? "Launching Quiz..." : "⚡ Start Timed Quiz"}
                </button>
            </div>
        </div>
    );
}
