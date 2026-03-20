import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchSyllabi, setCurrentSession } from "../../store/studentSlice";
import { startSession } from "../../services/openai";
import { ROUTES } from "../../utils/constants";
import { parseError } from "../../utils/helpers";
import CustomDropdown from "../common/CustomDropdown";
import { BookIcon } from "../common/Icons";
import "./StudentComponents.css";

const DEFAULT_SECTION = {
    questionsPerSection: 10,
    timePerQuestion: 90,
    marksPerQuestion: 2,
    questionType: "objective",
};

const QUESTION_OPTIONS = [5, 10, 15, 20].map((n) => ({ value: n, label: `${n} Questions` }));
const QUESTION_TYPE_OPTIONS = [
    { value: "objective", label: "Objective" },
    { value: "descriptive", label: "Descriptive" },
    { value: "mixed", label: "Mixed" },
];

/** Free-entry minute input for time-per-question (0.5 – 30 min) */
function TimeInput({ value, onChange }) {
    const minutes = +(value / 60).toFixed(2);

    const handleManual = (e) => {
        const mins = parseFloat(e.target.value);
        if (!isNaN(mins) && mins >= 0.5 && mins <= 30) {
            onChange(Math.round(mins * 60));
        }
    };

    return (
        <div className="time-manual-input">
            <input
                type="number"
                min={0.5}
                max={30}
                step={0.5}
                value={minutes}
                onChange={handleManual}
                className="time-number-input"
                title="Enter minutes (0.5 – 30)"
            />
            <span className="time-unit">min</span>
        </div>
    );
}

/** Typable marks input (1 – 15) with inline over-limit warning */
function MarksInput({ value, onChange }) {
    const [raw, setRaw] = useState(String(value));
    const overLimit = parseInt(raw) > 15;
    const invalid = isNaN(parseInt(raw)) || parseInt(raw) < 1;

    const handleChange = (e) => {
        const v = e.target.value;
        setRaw(v);
        const n = parseInt(v);
        if (!isNaN(n) && n >= 1 && n <= 15) {
            onChange(n);
        }
    };

    return (
        <div className="marks-input-wrapper">
            <div className={`time-manual-input${overLimit || invalid ? " input-error-border" : ""}`}>
                <input
                    type="number"
                    min={1}
                    max={15}
                    step={1}
                    value={raw}
                    onChange={handleChange}
                    className="time-number-input"
                    title="Enter marks per question (1 – 15)"
                />
                <span className="time-unit">marks</span>
            </div>
            {overLimit && (
                <p className="marks-over-limit">
                    Maximum marks per question is 15.
                </p>
            )}
        </div>
    );
}

function buildSections(count, prev) {
    return Array.from({ length: count }, (_, i) => prev[i] ?? { ...DEFAULT_SECTION });
}

export default function TestSession() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { syllabi } = useSelector((state) => state.student);

    const [selectedSyllabus, setSelectedSyllabus] = useState(null);
    const [sections, setSections] = useState([{ ...DEFAULT_SECTION }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        dispatch(fetchSyllabi());
    }, [dispatch]);

    const addSection = () =>
        setSections((prev) => [...prev, { ...DEFAULT_SECTION }]);

    const deleteSection = (index) =>
        setSections((prev) => prev.filter((_, i) => i !== index));

    const updateSection = (index, field, value) => {
        setSections((prev) =>
            prev.map((s, i) =>
                i === index
                    ? { ...s, [field]: field === "questionType" ? value : parseInt(value) }
                    : s
            )
        );
    };

    // Validate: no section has marks > 15
    const hasMarksError = sections.some((s) => s.marksPerQuestion > 15);

    const handleStartTest = async () => {
        if (!selectedSyllabus) {
            setError("Please select a syllabus");
            return;
        }
        if (hasMarksError) {
            setError("Please fix marks per question — maximum allowed is 15.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const allTopics = selectedSyllabus.topics?.map((t) => t.name) || [];
            const totalQuestions = sections.reduce((sum, s) => sum + s.questionsPerSection, 0);
            const totalTime = sections.reduce(
                (sum, s) => sum + s.questionsPerSection * s.timePerQuestion,
                0
            );

            const result = await startSession({
                type: "test",
                syllabusId: selectedSyllabus._id,
                topics: allTopics,
                difficulty: "mixed",
                questionCount: totalQuestions,
                timeLimit: totalTime,
                sectionsConfig: sections.map((s, i) => ({
                    section: i + 1,
                    questionsPerSection: s.questionsPerSection,
                    timePerQuestion: s.timePerQuestion,
                    marksPerQuestion: s.marksPerQuestion,
                    questionType: s.questionType,
                })),
            });

            dispatch(setCurrentSession(result.session));
            navigate(`${ROUTES.STUDENT.TEST}/session/${result.session.id}`);
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
        }
    };

    // Derived totals
    const totalQuestions = sections.reduce((sum, s) => sum + s.questionsPerSection, 0);
    const totalTime = Math.ceil(
        sections.reduce((sum, s) => sum + s.questionsPerSection * s.timePerQuestion, 0) / 60
    );
    const totalMarks = sections.reduce(
        (sum, s) => sum + s.questionsPerSection * s.marksPerQuestion,
        0
    );

    return (
        <div className="test-session">
            <div className="page-header">
                <div className="page-header-row">
                    <h1>Full Test</h1>
                    <Link
                        to={ROUTES.STUDENT.SESSIONS}
                        state={{ filterMode: 'test' }}
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

            <div className="test-setup">
                {/* Syllabus Selection */}
                <div className="setup-section">
                    <h3>Select Syllabus</h3>
                    <div className="syllabus-grid">
                        {syllabi.map((s) => (
                            <div
                                key={s._id}
                                className={`syllabus-card ${selectedSyllabus?._id === s._id ? "selected" : ""}`}
                                onClick={() => setSelectedSyllabus(s)}
                            >
                                <span className="syllabus-icon"><BookIcon /></span>
                                <span className="syllabus-name">{s.fileName}</span>
                                <span className="topic-count">{s.topics?.length || 0} topics</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Test Configuration */}
                <div className="setup-section">
                    <h3>Test Configuration</h3>

                    {/* Per-section configuration */}
                    <div className="section-configs">
                        {sections.map((sec, i) => (
                            <div key={i} className="section-config-row">
                                <div className="section-config-label">
                                    <span className="section-badge">Section {i + 1}</span>
                                </div>
                                <div className="section-config-fields">
                                    <div className="config-item">
                                        <label>Questions</label>
                                        <CustomDropdown
                                            value={sec.questionsPerSection}
                                            onChange={(v) => updateSection(i, "questionsPerSection", v)}
                                            options={QUESTION_OPTIONS}
                                        />
                                    </div>
                                    <div className="config-item">
                                        <label>Time / Question</label>
                                        <TimeInput
                                            value={sec.timePerQuestion}
                                            onChange={(v) => updateSection(i, "timePerQuestion", v)}
                                        />
                                    </div>
                                    <div className="config-item">
                                        <label>Marks / Question</label>
                                        <MarksInput
                                            value={sec.marksPerQuestion}
                                            onChange={(v) => updateSection(i, "marksPerQuestion", v)}
                                        />
                                    </div>
                                    <div className="config-item">
                                        <label>Question Type</label>
                                        <CustomDropdown
                                            value={sec.questionType}
                                            onChange={(v) => updateSection(i, "questionType", v)}
                                            options={QUESTION_TYPE_OPTIONS}
                                        />
                                    </div>
                                </div>
                                {/* Delete button */}
                                <button
                                    className="btn-delete-section"
                                    onClick={() => deleteSection(i)}
                                    disabled={sections.length === 1}
                                    title={sections.length === 1 ? "At least one section is required" : `Delete Section ${i + 1}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                        <path d="M10 11v6" />
                                        <path d="M14 11v6" />
                                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add section */}
                    <div className="add-section-row">
                        <button className="btn-add-section" onClick={addSection}>
                            + Section
                        </button>
                    </div>
                </div>

                {/* Test Overview */}
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
                            <span className="stat-value">{sections.length}</span>
                            <span className="stat-label">Sections</span>
                        </div>
                    </div>
                </div>

                {/* Test Rules */}
                <div className="test-rules">
                    <h4>Test Rules</h4>
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
                    disabled={loading || !selectedSyllabus || hasMarksError}
                >
                    {loading ? "Preparing Test..." : "Start Full Test"}
                </button>
            </div>
        </div>
    );
}
