import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { endpoints } from "../../services/api";
import { ROUTES } from "../../utils/constants";
import { formatDate } from "../../utils/helpers";
import CustomDropdown from "../common/CustomDropdown";
import "./StudentComponents.css";

export default function SavedMaterials() {
    const navigate = useNavigate();
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterMode, setFilterMode] = useState("all");

    useEffect(() => {
        fetchMaterials();
    }, []);

    const fetchMaterials = async () => {
        try {
            setLoading(true);
            const response = await api.get(endpoints.student.getAllMaterials);
            setMaterials(response.data.materials || []);
            setError(null);
        } catch (err) {
            console.error("Error fetching materials:", err);
            setError("Failed to load saved materials. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation(); // Prevent card click
        if (!window.confirm("Are you sure you want to delete this study material?")) return;

        try {
            await api.delete(`${endpoints.student.deleteMaterial}/${id}`);
            setMaterials(materials.filter(m => m._id !== id));
        } catch (err) {
            console.error("Error deleting material:", err);
            alert("Failed to delete material");
        }
    };

    const filteredMaterials = materials.filter(material => {
        const matchesSearch = (material.name || material.topic).toLowerCase().includes(searchTerm.toLowerCase());
        const matchesMode = filterMode === "all" || material.mode === filterMode;
        return matchesSearch && matchesMode;
    });

    if (loading) return <div className="loading">Loading your library...</div>;

    return (
        <div className="saved-materials-page">
            <div className="page-header">
                <div>
                    <h1>Saved Materials</h1>
                    <p>Your personal library of generated study content</p>
                </div>
                <Link to={ROUTES.STUDENT.STUDY_MATERIAL} className="create-btn">
                    + New Material
                </Link>
            </div>

            <div className="filters-bar">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search topics..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <CustomDropdown
                    options={[
                        { value: 'all', label: 'All Modes' },
                        { value: 'short', label: 'Short' },
                        { value: 'intermediate', label: 'Intermediate' },
                        { value: 'pro', label: 'Pro' }
                    ]}
                    value={filterMode}
                    onChange={(value) => setFilterMode(value)}
                    className="mode-filter-dropdown"
                />
            </div>

            {error && <div className="error-message">{error}</div>}

            {filteredMaterials.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📚</div>
                    <h3>No materials found</h3>
                    <p>{searchTerm || filterMode !== 'all' ? "Try adjusting your filters" : "Generate your first study material to see it here"}</p>
                    {!searchTerm && filterMode === 'all' && (
                        <Link to={ROUTES.STUDENT.STUDY_MATERIAL} className="cta-btn">
                            Generate Material
                        </Link>
                    )}
                </div>
            ) : (
                <div className="materials-grid">
                    {filteredMaterials.map((material) => (
                        <div
                            className="material-card"
                            key={material._id}
                            onClick={() => navigate(`/student/view-material/${material._id}`)}
                        >
                            <div className={`mode-badge ${material.mode}`}>{material.mode}</div>
                            <div className="card-content">
                                <h3>{material.name || material.topic}</h3>
                                <p className="topic-name">{material.topic}</p>
                                <div className="meta-info">
                                    <span>📅 {formatDate(material.createdAt)}</span>
                                    {material.metadata?.wordCount && (
                                        <span>📝 ~{material.metadata.wordCount} words</span>
                                    )}
                                </div>
                            </div>
                            <div className="card-actions">
                                <button
                                    className="delete-btn"
                                    onClick={(e) => handleDelete(e, material._id)}
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
