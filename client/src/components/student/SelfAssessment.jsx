import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchSyllabi, setCurrentSession } from "../../store/studentSlice";
import { startSession } from "../../services/openai";
import { ROUTES } from "../../utils/constants";
import { parseError } from "../../utils/helpers";
import "./StudentComponents.css";

export default function SelfAssessment() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { syllabi } = useSelector((state) => state.student);

    const [selectedSyllabus, setSelectedSyllabus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        dispatch(fetchSyllabi());
    }, [dispatch]);

    const handleStartAssessment = async () => {
        if (!selectedSyllabus) {
            setError("Please select a syllabus");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const allTopics = selectedSyllabus.topics?.map((t) => t.name) || [];

            const result = await startSession({
                type: "self-assessment",
                syllabusId: selectedSyllabus._id,
                topics: allTopics,
                difficulty: "mixed",
                questionCount: 20,
            });

            dispatch(setCurrentSession(result.session));
            navigate(`${ROUTES.STUDENT.SELF_ASSESSMENT}/session/${result.session.id}`);
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="self-assessment">
            <div className="page-header">
                <h1>🎯 Self Assessment</h1>
                <p>Comprehensive assessment covering your entire syllabus</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="assessment-info">
                <div className="info-card">
                    <span className="info-icon">📊</span>
                    <h3>Full Coverage</h3>
                    <p>Questions from all topics in your syllabus</p>
                </div>
                <div className="info-card">
                    <span className="info-icon">🎚️</span>
                    <h3>Mixed Difficulty</h3>
                    <p>Easy, medium, and hard questions combined</p>
                </div>
                <div className="info-card">
                    <span className="info-icon">🤖</span>
                    <h3>AI Evaluation</h3>
                    <p>Detailed analysis of your strengths and weaknesses</p>
                </div>
            </div>

            <div className="assessment-setup">
                <h3>Select Syllabus for Assessment</h3>
                <div className="syllabus-list">
                    {syllabi.map((s) => (
                        <div
                            key={s._id}
                            className={`syllabus-option ${selectedSyllabus?._id === s._id ? "selected" : ""}`}
                            onClick={() => setSelectedSyllabus(s)}
                        >
                            <div className="syllabus-info">
                                <span className="syllabus-icon">📚</span>
                                <div>
                                    <h4>{s.fileName}</h4>
                                    <p>{s.topics?.length || 0} topics • Mixed difficulty</p>
                                </div>
                            </div>
                            <div className="syllabus-check">
                                {selectedSyllabus?._id === s._id && "✓"}
                            </div>
                        </div>
                    ))}
                </div>

                {selectedSyllabus && (
                    <div className="assessment-summary">
                        <h3>Assessment Overview</h3>
                        <ul>
                            <li>📝 20 Questions (4-5 per difficulty level)</li>
                            <li>📚 Topics: All {selectedSyllabus.topics?.length || 0} topics</li>
                            <li>⏱️ No time limit - work at your own pace</li>
                            <li>📊 Detailed performance report at the end</li>
                        </ul>
                    </div>
                )}

                <button
                    className="btn-primary btn-start"
                    onClick={handleStartAssessment}
                    disabled={loading || !selectedSyllabus}
                >
                    {loading ? "Preparing Assessment..." : "Start Self Assessment"}
                </button>
            </div>
        </div>
    );
}
