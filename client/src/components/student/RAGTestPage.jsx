import { useState, useRef, useEffect } from "react";
import api, { endpoints } from "../../services/api";
import "./StudentComponents.css";

export default function RAGTestPage() {
    // ─── State ───────────────────────────────────────────────────
    const [textbooks, setTextbooks] = useState([]);
    const [fileName, setFileName] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState(null);

    // Generate state
    const [genTopic, setGenTopic] = useState("");
    const [genMode, setGenMode] = useState("short");
    const [selectedTextbook, setSelectedTextbook] = useState("");
    const [generating, setGenerating] = useState(false);
    const [genResult, setGenResult] = useState(null);

    const fileInputRef = useRef(null);

    // ─── Load textbooks on mount ──────────────────────────────────
    useEffect(() => {
        loadTextbooks();
    }, []);

    const loadTextbooks = async () => {
        try {
            const res = await api.get(endpoints.rag.textbooks);
            setTextbooks(res.data.textbooks || []);
        } catch (err) {
            console.error("Failed to load textbooks:", err);
        }
    };

    // ─── 1. Upload Textbook ──────────────────────────────────────
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
        }
    };

    const handleUpload = async () => {
        const file = fileInputRef.current?.files[0];
        if (!file) {
            setError("Please select a PDF file first.");
            return;
        }

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            setError("Only PDF files are supported.");
            return;
        }

        setUploading(true);
        setError("");
        setSuccess("");
        setUploadProgress("Uploading & processing... (this may take 2-3 minutes for large PDFs)");

        try {
            // Send as FormData (multipart/form-data) — file streams to server directly
            const formData = new FormData();
            formData.append("pdf", file);

            const res = await api.post(endpoints.rag.uploadTextbook, formData, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 300000, // 5 min timeout for large PDFs
            });

            setSuccess(`✅ "${file.name}" ingested successfully — ${res.data.textbook.totalChunks} chunks created from ${res.data.textbook.totalPages} pages`);
            setUploadProgress("");
            setFileName("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            loadTextbooks();
        } catch (err) {
            setError(err.response?.data?.details || err.response?.data?.error || "Upload failed.");
            setUploadProgress("");
        } finally {
            setUploading(false);
        }
    };

    // ─── 2. Search ───────────────────────────────────────────────
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setSearching(true);
        setSearchResults(null);
        setError("");

        try {
            const body = { query: searchQuery, topK: 5 };
            if (selectedTextbook) body.textbookId = selectedTextbook;

            const res = await api.post(endpoints.rag.search, body);
            setSearchResults(res.data);
        } catch (err) {
            setError(err.response?.data?.details || "Search failed.");
        } finally {
            setSearching(false);
        }
    };

    // ─── 3. Generate with RAG ────────────────────────────────────
    const handleGenerate = async () => {
        if (!genTopic.trim()) return;

        setGenerating(true);
        setGenResult(null);
        setError("");

        try {
            const body = { topic: genTopic, mode: genMode };
            if (selectedTextbook) body.textbookId = selectedTextbook;

            const res = await api.post(endpoints.rag.generateWithRAG, body);
            setGenResult(res.data);
        } catch (err) {
            setError(err.response?.data?.details || "Generation failed.");
        } finally {
            setGenerating(false);
        }
    };

    // ─── 4. Delete textbook ──────────────────────────────────────
    const handleDelete = async (id, name) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

        try {
            await api.delete(`${endpoints.rag.textbooks}/${id}`);
            setSuccess(`Deleted "${name}".`);
            loadTextbooks();
        } catch (err) {
            setError("Failed to delete textbook.");
        }
    };

    // ─── Render ──────────────────────────────────────────────────
    return (
        <div className="rag-test-page" style={{ padding: "20px", maxWidth: "1100px", margin: "0 auto" }}>
            <div className="page-header">
                <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        <circle cx="12" cy="10" r="3" />
                        <path d="M12 13v2" />
                    </svg>
                    RAG Test Lab
                </h1>
                <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
                    Upload textbooks, search for content, and generate textbook-grounded study material.
                </p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* ── Section 1: Upload ───────────────────────────── */}
            <div className="card" style={{ marginBottom: "24px" }}>
                <h2 style={{ marginBottom: "16px", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.3rem" }}>📄</span> Upload Textbook PDF
                </h2>

                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                        type="file"
                        accept=".pdf"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        style={{ flex: "1", minWidth: "200px" }}
                    />
                    <button
                        className="btn-primary"
                        onClick={handleUpload}
                        disabled={uploading || !fileName}
                        style={{ whiteSpace: "nowrap" }}
                    >
                        {uploading ? "Processing..." : "Upload & Index"}
                    </button>
                </div>

                {uploadProgress && (
                    <div style={{ marginTop: "12px", padding: "12px 16px", background: "var(--bg-card-hover, #f0f0ff)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="spinner" style={{ width: "18px", height: "18px", border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        <span style={{ color: "var(--text-secondary)" }}>{uploadProgress}</span>
                    </div>
                )}

                {/* Uploaded textbooks list */}
                {textbooks.length > 0 && (
                    <div style={{ marginTop: "16px" }}>
                        <h3 style={{ fontSize: "0.95rem", marginBottom: "8px", color: "var(--text-secondary)" }}>
                            Uploaded Textbooks ({textbooks.length})
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {textbooks.map((tb) => (
                                <div
                                    key={tb._id}
                                    style={{
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        padding: "10px 14px", borderRadius: "8px",
                                        background: "var(--bg-card-hover, #f8f8ff)",
                                        border: "1px solid var(--border-color, #e0e0e0)",
                                    }}
                                >
                                    <div>
                                        <strong>{tb.fileName}</strong>
                                        <span style={{ marginLeft: "12px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                            {tb.totalPages} pages · {tb.totalChunks} chunks ·
                                            <span style={{
                                                marginLeft: "4px",
                                                color: tb.status === "ready" ? "#22c55e" : tb.status === "failed" ? "#ef4444" : "#eab308",
                                                fontWeight: 600,
                                            }}>
                                                {tb.status}
                                            </span>
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(tb._id, tb.fileName)}
                                        style={{
                                            background: "none", border: "none", color: "#ef4444",
                                            cursor: "pointer", fontSize: "1.1rem", padding: "4px 8px",
                                        }}
                                        title="Delete"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Textbook selector (shared) ──────────────────── */}
            {textbooks.filter(t => t.status === "ready").length > 0 && (
                <div className="card" style={{ marginBottom: "24px", padding: "14px 20px" }}>
                    <label style={{ fontWeight: 600, marginRight: "12px" }}>Filter by textbook:</label>
                    <select
                        value={selectedTextbook}
                        onChange={(e) => setSelectedTextbook(e.target.value)}
                        style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", minWidth: "200px" }}
                    >
                        <option value="">All textbooks</option>
                        {textbooks.filter(t => t.status === "ready").map((tb) => (
                            <option key={tb._id} value={tb._id}>{tb.fileName}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* ── Section 2: Search ──────────────────────────── */}
            <div className="card" style={{ marginBottom: "24px" }}>
                <h2 style={{ marginBottom: "16px", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.3rem" }}>🔍</span> Semantic Search
                </h2>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search your textbook, e.g. 'explain binary search trees'"
                        style={{ flex: 1 }}
                    />
                    <button
                        className="btn-primary"
                        onClick={handleSearch}
                        disabled={searching || !searchQuery.trim()}
                        style={{ whiteSpace: "nowrap" }}
                    >
                        {searching ? "Searching..." : "Search"}
                    </button>
                </div>

                {searchResults && (
                    <div style={{ marginTop: "16px" }}>
                        <h3 style={{ fontSize: "0.95rem", marginBottom: "10px", color: "var(--text-secondary)" }}>
                            Found {searchResults.results.length} relevant chunks for "{searchResults.query}"
                        </h3>
                        {searchResults.results.map((r, i) => (
                            <div
                                key={i}
                                style={{
                                    padding: "14px 16px", marginBottom: "10px", borderRadius: "8px",
                                    border: "1px solid var(--border-color, #e0e0e0)",
                                    background: "var(--bg-card-hover, #fafafa)",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                    <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#6366f1" }}>
                                        {r.fileName} · ~p.{r.pageEstimate}
                                    </span>
                                    <span style={{
                                        fontSize: "0.8rem", fontWeight: 600,
                                        color: r.score > 0.8 ? "#22c55e" : r.score > 0.6 ? "#eab308" : "#9ca3af",
                                    }}>
                                        {(r.score * 100).toFixed(1)}% match
                                    </span>
                                </div>
                                <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-primary)", whiteSpace: "pre-wrap", maxHeight: "150px", overflow: "auto" }}>
                                    {r.text}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Section 3: Generate with RAG ───────────────── */}
            <div className="card" style={{ marginBottom: "24px" }}>
                <h2 style={{ marginBottom: "16px", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.3rem" }}>🤖</span> Generate with RAG
                </h2>

                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                        type="text"
                        value={genTopic}
                        onChange={(e) => setGenTopic(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                        placeholder="Enter a topic, e.g. 'Binary Search Trees'"
                        style={{ flex: 1, minWidth: "200px" }}
                    />
                    <select
                        value={genMode}
                        onChange={(e) => setGenMode(e.target.value)}
                        style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
                    >
                        <option value="short">Short</option>
                        <option value="detailed">Detailed</option>
                    </select>
                    <button
                        className="btn-primary"
                        onClick={handleGenerate}
                        disabled={generating || !genTopic.trim()}
                        style={{ whiteSpace: "nowrap" }}
                    >
                        {generating ? "Generating..." : "Generate"}
                    </button>
                </div>

                {generating && (
                    <div style={{ marginTop: "16px", padding: "16px", textAlign: "center", color: "var(--text-secondary)" }}>
                        <div className="spinner" style={{ width: "24px", height: "24px", margin: "0 auto 10px", border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        <p>Retrieving textbook context & generating material...</p>
                    </div>
                )}

                {genResult && (
                    <div style={{ marginTop: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                            <span style={{
                                padding: "4px 12px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600,
                                background: genResult.ragContextUsed ? "#dcfce7" : "#fef3c7",
                                color: genResult.ragContextUsed ? "#16a34a" : "#ca8a04",
                            }}>
                                {genResult.ragContextUsed
                                    ? `✅ RAG Active — ${genResult.chunksUsed} chunks used`
                                    : "⚠️ No textbook context found — generated from AI knowledge"
                                }
                            </span>
                        </div>

                        {genResult.material && (
                            <div style={{ border: "1px solid var(--border-color)", borderRadius: "10px", padding: "20px", background: "var(--bg-card, #fff)" }}>
                                <h3 style={{ marginBottom: "6px" }}>{genResult.material.title}</h3>
                                {genResult.material.overview && (
                                    <p style={{ color: "var(--text-secondary)", marginBottom: "16px", fontStyle: "italic" }}>
                                        {genResult.material.overview}
                                    </p>
                                )}
                                {genResult.material.sections?.map((sec, i) => (
                                    <div key={i} style={{ marginBottom: "20px" }}>
                                        <h4 style={{ color: "#6366f1", marginBottom: "8px" }}>{sec.title}</h4>
                                        <div
                                            style={{ lineHeight: 1.7 }}
                                            dangerouslySetInnerHTML={{ __html: sec.content }}
                                        />
                                        {sec.keyPoints?.length > 0 && (
                                            <div style={{ marginTop: "10px", padding: "10px 14px", background: "#f0f0ff", borderRadius: "8px" }}>
                                                <strong style={{ fontSize: "0.85rem", color: "#6366f1" }}>Key Points:</strong>
                                                <ul style={{ margin: "6px 0 0 16px", fontSize: "0.9rem" }}>
                                                    {sec.keyPoints.map((kp, j) => <li key={j}>{kp}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Inline spinner animation */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
