import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api, { endpoints } from "../../services/api";
import { ROUTES } from "../../utils/constants";
import "./StudentComponents.css";
import "./SyllabusManager.css";

export default function SyllabusManager() {
    const [syllabi, setSyllabi] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // State for expanding/editing
    const [expandedSyllabusId, setExpandedSyllabusId] = useState(null);
    const [editingSyllabus, setEditingSyllabus] = useState(null); // The one being edited (copy)
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSyllabi();
    }, []);

    const fetchSyllabi = async () => {
        try {
            setLoading(true);
            const response = await api.get(endpoints.student.syllabi);
            setSyllabi(response.data.syllabi || []);
        } catch (err) {
            console.error("Error fetching syllabi:", err);
            setError("Failed to load syllabi.");
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id) => {
        if (expandedSyllabusId === id) {
            setExpandedSyllabusId(null);
            setEditingSyllabus(null);
        } else {
            setExpandedSyllabusId(id);
            // Initialize editing state with deep copy to avoid direct mutation
            const syllabus = syllabi.find(s => s._id === id);
            if (syllabus) {
                setEditingSyllabus(JSON.parse(JSON.stringify(syllabus)));
            }
        }
    };

    const handleTopicChange = (topicIndex, field, value) => {
        if (!editingSyllabus) return;
        const newTopics = [...editingSyllabus.topics];
        newTopics[topicIndex] = { ...newTopics[topicIndex], [field]: value };
        setEditingSyllabus({ ...editingSyllabus, topics: newTopics });
    };

    const handleSubtopicChange = (topicIndex, subtopicIndex, value) => {
        if (!editingSyllabus) return;
        const newTopics = [...editingSyllabus.topics];
        const newSubtopics = [...newTopics[topicIndex].subtopics];
        newSubtopics[subtopicIndex] = value;
        newTopics[topicIndex].subtopics = newSubtopics;
        setEditingSyllabus({ ...editingSyllabus, topics: newTopics });
    };

    const addSubtopic = (topicIndex) => {
        if (!editingSyllabus) return;
        const newTopics = [...editingSyllabus.topics];
        newTopics[topicIndex].subtopics.push("");
        setEditingSyllabus({ ...editingSyllabus, topics: newTopics });
    };

    const removeSubtopic = (topicIndex, subtopicIndex) => {
        if (!editingSyllabus) return;
        const newTopics = [...editingSyllabus.topics];
        newTopics[topicIndex].subtopics.splice(subtopicIndex, 1);
        setEditingSyllabus({ ...editingSyllabus, topics: newTopics });
    };

    const addTopic = () => {
        if (!editingSyllabus) return;
        const newTopics = [...editingSyllabus.topics];
        newTopics.push({ name: "New Topic", subtopics: [], estimatedHours: 0 });
        setEditingSyllabus({ ...editingSyllabus, topics: newTopics });
    };

    const removeTopic = (topicIndex) => {
        if (!editingSyllabus) return;
        if (!confirm("Are you sure you want to remove this topic?")) return;
        const newTopics = [...editingSyllabus.topics];
        newTopics.splice(topicIndex, 1);
        setEditingSyllabus({ ...editingSyllabus, topics: newTopics });
    };

    const handleSave = async () => {
        if (!editingSyllabus) return;
        try {
            setSaving(true);
            const response = await api.put(`${endpoints.student.syllabi}/${editingSyllabus._id}`, {
                topics: editingSyllabus.topics
            });

            // Update local list
            const updatedSyllabus = response.data.syllabus;
            setSyllabi(syllabi.map(s => s._id === updatedSyllabus._id ? updatedSyllabus : s));
            setExpandedSyllabusId(null); // Collapse after save or keep open? Let's collapse for now or update ID
            setExpandedSyllabusId(updatedSyllabus._id); // Keep open to show updated state
            setEditingSyllabus(JSON.parse(JSON.stringify(updatedSyllabus))); // Reset edit state
            alert("Syllabus updated successfully!");
        } catch (err) {
            console.error("Error saving syllabus:", err);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="loading">Loading syllabi...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="syllabus-manager">
            <div className="page-header">
                <h1>📚 Syllabus Manager</h1>
                <Link to={ROUTES.STUDENT.UPLOAD_SYLLABUS} className="btn-primary">
                    + Upload New Syllabus
                </Link>
            </div>

            <div className="syllabi-list">
                {syllabi.length === 0 ? (
                    <div className="empty-state">
                        <p>No syllabi uploaded yet.</p>
                        <Link to={ROUTES.STUDENT.UPLOAD_SYLLABUS}>Upload your first syllabus</Link>
                    </div>
                ) : (
                    syllabi.map((syllabus) => (
                        <div key={syllabus._id} className={`syllabus-card ${expandedSyllabusId === syllabus._id ? 'expanded' : ''}`}>
                            <div className="syllabus-header" onClick={() => toggleExpand(syllabus._id)}>
                                <div className="syllabus-info">
                                    <h3>{syllabus.fileName}</h3>
                                    <span className={`status-badge ${syllabus.status}`}>{syllabus.status}</span>
                                    <span className="date-badge">{new Date(syllabus.createdAt).toLocaleDateString()}</span>
                                </div>
                                <span className="expand-icon">{expandedSyllabusId === syllabus._id ? '▲' : '▼'}</span>
                            </div>

                            {expandedSyllabusId === syllabus._id && editingSyllabus && (
                                <div className="syllabus-details">
                                    <div className="topics-editor">
                                        <div className="editor-header">
                                            <h4>Topics & Subtopics</h4>
                                            <button className="btn-add-topic" onClick={addTopic}>+ Add Topic</button>
                                        </div>

                                        {editingSyllabus.topics.map((topic, tIndex) => (
                                            <div key={tIndex} className="topic-item">
                                                <div className="topic-row">
                                                    <input
                                                        type="text"
                                                        className="topic-name-input"
                                                        value={topic.name}
                                                        onChange={(e) => handleTopicChange(tIndex, 'name', e.target.value)}
                                                        placeholder="Topic Name"
                                                    />
                                                    <button className="btn-remove" onClick={() => removeTopic(tIndex)} title="Remove Topic">×</button>
                                                </div>

                                                <div className="subtopics-list">
                                                    {topic.subtopics.map((subtopic, sIndex) => (
                                                        <div key={sIndex} className="subtopic-row">
                                                            <span>•</span>
                                                            <input
                                                                type="text"
                                                                className="subtopic-input"
                                                                value={subtopic}
                                                                onChange={(e) => handleSubtopicChange(tIndex, sIndex, e.target.value)}
                                                                placeholder="Subtopic"
                                                            />
                                                            <button className="btn-remove-sub" onClick={() => removeSubtopic(tIndex, sIndex)} title="Remove Subtopic">×</button>
                                                        </div>
                                                    ))}
                                                    <button className="btn-add-sub" onClick={() => addSubtopic(tIndex)}>+ Add Subtopic</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="action-buttons">
                                        <button className="btn-save" onClick={handleSave} disabled={saving}>
                                            {saving ? "Saving..." : "Save Changes"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
