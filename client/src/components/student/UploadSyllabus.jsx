import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadSyllabus } from "../../services/openai";
import { ROUTES } from "../../utils/constants";
import { parseError } from "../../utils/helpers";
import "./StudentComponents.css";

export default function UploadSyllabus() {
    const navigate = useNavigate();
    const [fileName, setFileName] = useState("");
    const [content, setContent] = useState("");
    const [fileData, setFileData] = useState(null); // For PDF files
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        setError("");
        setFileData(null);

        const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

        try {
            if (isPDF) {
                // For PDFs, read as base64 for server-side parsing
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(",")[1]; // Remove data:...;base64, prefix
                    setFileData({ base64, type: "pdf" });
                    setContent("[PDF file - will be parsed on server]");
                };
                reader.onerror = () => {
                    setError("Failed to read PDF file.");
                };
                reader.readAsDataURL(file);
            } else {
                // For text files, read directly
                const text = await file.text();
                setContent(text);
            }
        } catch (err) {
            setError("Failed to read file. Please try copy-pasting the content.");
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!content.trim() && !fileData) {
            setError("Please provide syllabus content");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            // If we have PDF fileData, send it; otherwise send text content
            const result = await uploadSyllabus(
                fileName || "My Syllabus",
                fileData ? null : content,
                fileData
            );
            setSuccess(`Syllabus uploaded successfully! ${result.syllabus.topics?.length || 0} topics extracted.`);

            setTimeout(() => {
                navigate(ROUTES.STUDENT.STUDY_MATERIAL);
            }, 2000);
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="upload-syllabus">
            <div className="page-header">
                <h1>📤 Upload Syllabus</h1>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form onSubmit={handleSubmit} className="upload-form">
                <div className="form-group">
                    <label>Syllabus Name</label>
                    <input
                        type="text"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="e.g., Data Structures - Semester 4"
                    />
                </div>

                <div className="form-group">
                    <label>Upload File (TXT, PDF text)</label>
                    <div className="file-upload-area">
                        <input
                            type="file"
                            accept=".txt,.pdf,.doc,.docx"
                            onChange={handleFileChange}
                            className="file-input"
                            id="file-input"
                        />
                        <label htmlFor="file-input" className="file-upload-label">
                            <span className="upload-icon">📁</span>
                            <span>Click to upload or drag and drop</span>
                            <span className="file-hint">TXT, PDF, DOC (Max 5MB)</span>
                        </label>
                    </div>
                </div>

                <div className="form-group">
                    <label>Or paste syllabus content directly</label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Paste your syllabus content here...

Example:
Unit 1: Introduction to Data Structures
- Arrays and Linked Lists
- Stacks and Queues
- Time and Space Complexity

Unit 2: Trees and Graphs
- Binary Trees
- BST Operations
- Graph Traversals"
                        rows={15}
                    />
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? "Processing..." : "Upload & Parse Syllabus"}
                    </button>
                </div>
            </form>
        </div>
    );
}
