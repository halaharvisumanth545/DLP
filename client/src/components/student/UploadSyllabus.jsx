import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { uploadSyllabus } from "../../services/openai";
import { extractTextFromPDF } from "../../utils/pdfExtractor";
import mammoth from "mammoth";
import { ROUTES } from "../../utils/constants";
import { parseError } from "../../utils/helpers";
import "./StudentComponents.css";

export default function UploadSyllabus() {
    const navigate = useNavigate();
    const [fileName, setFileName] = useState("");
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const fileInputRef = useRef(null);

    // Shared file processing logic used by both input change and drag-drop
    const processFile = async (file) => {
        if (!file) return;

        setFileName(file.name);
        setError("");

        const ext = file.name.toLowerCase().split('.').pop();

        try {
            if (ext === 'pdf') {
                setExtracting(true);
                const extractedText = await extractTextFromPDF(file);

                if (!extractedText || !extractedText.trim()) {
                    setError("No text could be extracted from this PDF. It may be scanned/image-based. Please paste the content manually.");
                    setExtracting(false);
                    return;
                }

                setContent(extractedText);
                setExtracting(false);
            } else if (ext === 'docx') {
                setExtracting(true);
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                const text = result.value;

                if (!text || !text.trim()) {
                    setError("No text could be extracted from this DOCX file. Please paste the content manually.");
                    setExtracting(false);
                    return;
                }

                setContent(text);
                setExtracting(false);
            } else {
                // .txt and other plain text files
                const text = await file.text();
                setContent(text);
            }
        } catch (err) {
            console.error("File read error:", err);
            setError("Failed to extract text from the file. Please try copy-pasting the content.");
            setExtracting(false);
        }
    };

    const handleFileChange = (e) => {
        processFile(e.target.files[0]);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!extracting) setDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (extracting) return;

        const file = e.dataTransfer.files[0];
        if (file) {
            // Update the file input so its value stays in sync
            if (fileInputRef.current) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInputRef.current.files = dt.files;
            }
            processFile(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!content.trim()) {
            setError("Please provide syllabus content");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const result = await uploadSyllabus(
                fileName || "My Syllabus",
                content
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
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload Syllabus
                </h1>
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
                    <label>Upload File</label>
                    <div
                        className={`drop-zone${dragOver ? " drop-zone--active" : ""}${extracting ? " drop-zone--extracting" : ""}${fileName ? " drop-zone--has-file" : ""}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => !extracting && fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            accept=".txt,.pdf,.doc,.docx"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            className="drop-zone__input"
                            disabled={extracting}
                        />

                        {extracting ? (
                            <div className="drop-zone__content">
                                <div className="drop-zone__spinner" />
                                <p className="drop-zone__title">Extracting text…</p>
                                <p className="drop-zone__hint">This may take a moment</p>
                            </div>
                        ) : dragOver ? (
                            <div className="drop-zone__content">
                                <span className="drop-zone__icon drop-zone__icon--active">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
                                        <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                                    </svg>
                                </span>
                                <p className="drop-zone__title">Drop it here!</p>
                            </div>
                        ) : fileName ? (
                            <div className="drop-zone__content">
                                <span className="drop-zone__icon drop-zone__icon--success">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M8 12l3 3 5-5" />
                                    </svg>
                                </span>
                                <p className="drop-zone__title">{fileName}</p>
                                <p className="drop-zone__hint">Click or drop another file to replace</p>
                            </div>
                        ) : (
                            <div className="drop-zone__content">
                                <span className="drop-zone__icon">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 16V8m0 0l-3 3m3-3l3 3" />
                                        <path d="M20 16.2A4.5 4.5 0 0017.5 8h-1.08A7 7 0 104 14.9" />
                                    </svg>
                                </span>
                                <p className="drop-zone__title">Drop files here</p>
                                <p className="drop-zone__subtitle">or <span className="drop-zone__browse">browse</span> to upload</p>
                                <p className="drop-zone__hint">PDF, TXT, DOC — Max 5 MB</p>
                            </div>
                        )}
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
                        disabled={extracting}
                    />
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={loading || extracting}>
                        {loading ? "Processing..." : "Upload & Parse Syllabus"}
                    </button>
                </div>
            </form>
        </div>
    );
}
