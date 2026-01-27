import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchSyllabi, setCurrentSession } from "../../store/studentSlice";
import { startSession } from "../../services/openai";
import { ROUTES } from "../../utils/constants";
import { parseError } from "../../utils/helpers";
import CustomDropdown from "../common/CustomDropdown";
import "./StudentComponents.css";

export default function TestSession() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { syllabi } = useSelector((state) => state.student);

    const [selectedSyllabus, setSelectedSyllabus] = useState(null);
    const [testConfig, setTestConfig] = useState({
        sections: 3,
        questionsPerSection: 10,
        timePerQuestion: 90, // seconds
        marksPerQuestion: 2,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        dispatch(fetchSyllabi());
    }, [dispatch]);

    const handleStartTest = async () => {
        if (!selectedSyllabus) {
            setError("Please select a syllabus");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const allTopics = selectedSyllabus.topics?.map((t) => t.name) || [];
            const totalQuestions = testConfig.sections * testConfig.questionsPerSection;
            const totalTime = totalQuestions * testConfig.timePerQuestion;

            const result = await startSession({
                type: "test",
                syllabusId: selectedSyllabus._id,
                topics: allTopics,
                difficulty: "mixed",
                questionCount: totalQuestions,
                timeLimit: totalTime,
            });

            dispatch(setCurrentSession(result.session));
            navigate(`${ROUTES.STUDENT.TEST}/session/${result.session.id}`);
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
        }
    };

    const totalQuestions = testConfig.sections * testConfig.questionsPerSection;
    const totalTime = Math.ceil((totalQuestions * testConfig.timePerQuestion) / 60);
    const totalMarks = totalQuestions * testConfig.marksPerQuestion;

    return (
        <div className="test-session">
            <div className="page-header">
                <h1>📋 Full Test</h1>
                <p>Complete exam simulation with sections and time tracking</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="test-setup">
                <div className="setup-section">
                    <h3>Select Syllabus</h3>
                    <div className="syllabus-list">
                        {syllabi.map((s) => (
                            <div
                                key={s._id}
                                className={`syllabus-option ${selectedSyllabus?._id === s._id ? "selected" : ""}`}
                                onClick={() => setSelectedSyllabus(s)}
                            >
                                <span className="syllabus-icon">📚</span>
                                <div className="syllabus-details">
                                    <h4>{s.fileName}</h4>
                                    <p>{s.topics?.length || 0} topics available</p>
                                </div>
                                {selectedSyllabus?._id === s._id && <span className="check">✓</span>}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="setup-section">
                    <h3>Test Configuration</h3>
                    <div className="config-grid">
                        <div className="config-item">
                            <label>Sections</label>
                            <CustomDropdown
                                value={testConfig.sections}
                                onChange={(value) =>
                                    setTestConfig({ ...testConfig, sections: parseInt(value) })
                                }
                                options={[1, 2, 3, 4, 5].map((n) => ({
                                    value: n,
                                    label: `${n} Section${n > 1 ? "s" : ""}`
                                }))}
                            />
                        </div>
                        <div className="config-item">
                            <label>Questions per Section</label>
                            <CustomDropdown
                                value={testConfig.questionsPerSection}
                                onChange={(value) =>
                                    setTestConfig({ ...testConfig, questionsPerSection: parseInt(value) })
                                }
                                options={[5, 10, 15, 20].map((n) => ({
                                    value: n,
                                    label: `${n} Questions`
                                }))}
                            />
                        </div>
                        <div className="config-item">
                            <label>Time per Question</label>
                            <CustomDropdown
                                value={testConfig.timePerQuestion}
                                onChange={(value) =>
                                    setTestConfig({ ...testConfig, timePerQuestion: parseInt(value) })
                                }
                                options={[
                                    { value: 60, label: "1 minute" },
                                    { value: 90, label: "1.5 minutes" },
                                    { value: 120, label: "2 minutes" }
                                ]}
                            />
                        </div>
                        <div className="config-item">
                            <label>Marks per Question</label>
                            <CustomDropdown
                                value={testConfig.marksPerQuestion}
                                onChange={(value) =>
                                    setTestConfig({ ...testConfig, marksPerQuestion: parseInt(value) })
                                }
                                options={[1, 2, 3, 4, 5].map((n) => ({
                                    value: n,
                                    label: `${n} Mark${n > 1 ? "s" : ""}`
                                }))}
                            />
                        </div>
                    </div>
                </div>

                <div className="test-overview">
                    <h3>Test Overview</h3>
                    <div className="overview-stats">
                        <div className="overview-stat">
                            <span className="stat-value">{totalQuestions}</span>
                            <span className="stat-label">Questions</span>
                        </div>
                        <div className="overview-stat">
                            <span className="stat-value">{totalTime} min</span>
                            <span className="stat-label">Duration</span>
                        </div>
                        <div className="overview-stat">
                            <span className="stat-value">{totalMarks}</span>
                            <span className="stat-label">Total Marks</span>
                        </div>
                        <div className="overview-stat">
                            <span className="stat-value">{testConfig.sections}</span>
                            <span className="stat-label">Sections</span>
                        </div>
                    </div>
                </div>

                <div className="test-rules">
                    <h4>⚠️ Test Rules</h4>
                    <ul>
                        <li>Navigation panel shows all questions</li>
                        <li>You can mark questions for review</li>
                        <li>Test auto-submits when time ends</li>
                        <li>No going back after submission</li>
                    </ul>
                </div>

                <button
                    className="btn-primary btn-start"
                    onClick={handleStartTest}
                    disabled={loading || !selectedSyllabus}
                >
                    {loading ? "Preparing Test..." : "Start Full Test"}
                </button>
            </div>
        </div>
    );
}
