import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api, { endpoints } from "../../services/api";
import { fetchSyllabi } from "../../store/studentSlice";
import { parseError } from "../../utils/helpers";
import "./StudentComponents.css";

export default function MaterialLoad() {
    const dispatch = useDispatch();
    const { syllabi, syllabiLoading } = useSelector((state) => state.student);

    const [docsUrl, setDocsUrl] = useState("");
    const [selectedSyllabusId, setSelectedSyllabusId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [result, setResult] = useState(null);

    useEffect(() => {
        dispatch(fetchSyllabi());
    }, [dispatch]);

    const selectedSyllabus = useMemo(
        () => syllabi.find((syllabus) => syllabus._id === selectedSyllabusId) || null,
        [selectedSyllabusId, syllabi]
    );

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!docsUrl.trim()) {
            setError("Please provide a Google Docs URL.");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");
        setResult(null);

        try {
            const response = await api.post(endpoints.materialLoad.ingestGoogleDoc, {
                docsUrl: docsUrl.trim(),
                syllabusId: selectedSyllabusId || undefined,
            });

            setResult(response.data.ingestion || null);
            setSuccess(response.data.message || "Google Doc ingested successfully.");
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
        }
    };

    const clusterSummary = Array.isArray(result?.clusterSummary) ? result.clusterSummary : [];

    return (
        <div className="material-load upload-syllabus">
            <div className="page-header">
                <h1>Material Load</h1>
                <p>
                    Ingest a Google Doc into Pinecone with section-aware semantic clustering.
                    If you attach a syllabus, chunk grouping will also align itself to your topic structure.
                </p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form onSubmit={handleSubmit} className="upload-form">
                <div className="form-group">
                    <label>Google Docs URL</label>
                    <input
                        type="url"
                        value={docsUrl}
                        onChange={(event) => setDocsUrl(event.target.value)}
                        placeholder="https://docs.google.com/document/d/..."
                    />
                </div>

                <div className="form-group">
                    <label>Optional Syllabus Guidance</label>
                    <select
                        value={selectedSyllabusId}
                        onChange={(event) => setSelectedSyllabusId(event.target.value)}
                        disabled={syllabiLoading}
                    >
                        <option value="">
                            {syllabiLoading ? "Loading syllabi..." : "No syllabus guidance"}
                        </option>
                        {syllabi.map((syllabus) => (
                            <option key={syllabus._id} value={syllabus._id}>
                                {syllabus.fileName} {syllabus.topics?.length ? `(${syllabus.topics.length} topics)` : ""}
                            </option>
                        ))}
                    </select>
                    <div className="material-load__hint">
                        {selectedSyllabus
                            ? `Guided clustering will bias chunk assignment toward the topics in "${selectedSyllabus.fileName}".`
                            : "Without a syllabus, the system falls back to pure semantic clustering from the document itself."}
                    </div>
                </div>

                <div className="form-group">
                    <label>Workflow Summary</label>
                    <div className="material-load__helper">
                        <p>Input: Google Docs URL with structural heading extraction</p>
                        <p>Split: Section-aware recursive chunking (`chunkSize=700`, `chunkOverlap=80`)</p>
                        <p>Embeddings: OpenAI `text-embedding-3-small`</p>
                        <p>Clustering: Hybrid semantic grouping with optional syllabus hints</p>
                        <p>Storage: Pinecone upsert with cluster metadata + Mongo cluster manifest</p>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? "Running Material Load..." : "Ingest Google Doc"}
                    </button>
                </div>
            </form>

            {result && (
                <div className="material-load__result">
                    <div className="material-load__result-header">
                        <div>
                            <h3>Ingestion Result</h3>
                            <p>
                                {result.documentTitle || "Untitled Google Doc"}
                                {result.clusteringEnabled ? ` · ${result.clusteringStrategy}` : ""}
                            </p>
                        </div>
                        <div className="material-load__badge">
                            {result.clustersCreated || 0} Clusters
                        </div>
                    </div>

                    <div className="material-load__grid">
                        <div>
                            <span>Document ID</span>
                            <strong>{result.documentId}</strong>
                        </div>
                        <div>
                            <span>Sections Detected</span>
                            <strong>{result.sectionCount || 0}</strong>
                        </div>
                        <div>
                            <span>Chunks Created</span>
                            <strong>{result.chunksCreated}</strong>
                        </div>
                        <div>
                            <span>Cluster Strategy</span>
                            <strong>{result.clusteringStrategy || "Chunk only"}</strong>
                        </div>
                        <div>
                            <span>Embedding Model</span>
                            <strong>{result.embeddingModel}</strong>
                        </div>
                        <div>
                            <span>Embedding Dimension</span>
                            <strong>{result.embeddingDim}</strong>
                        </div>
                        <div>
                            <span>Pinecone Index</span>
                            <strong>{result.pineconeIndex}</strong>
                        </div>
                        <div>
                            <span>Namespace</span>
                            <strong>{result.namespace}</strong>
                        </div>
                    </div>

                    {clusterSummary.length > 0 && (
                        <div className="material-load__clusters">
                            <div className="material-load__clusters-head">
                                <h4>Cluster Preview</h4>
                                <span>{clusterSummary.length} grouped learning areas</span>
                            </div>

                            <div className="material-load__cluster-list">
                                {clusterSummary.map((cluster) => (
                                    <article key={cluster.clusterId} className="material-load__cluster-card">
                                        <div className="material-load__cluster-top">
                                            <div>
                                                <h5>{cluster.label}</h5>
                                                <p>{cluster.strategy}</p>
                                            </div>
                                            <div className="material-load__cluster-count">
                                                {cluster.chunkCount} chunks
                                            </div>
                                        </div>

                                        {Array.isArray(cluster.sectionTitles) && cluster.sectionTitles.length > 0 && (
                                            <div className="material-load__cluster-tags">
                                                {cluster.sectionTitles.map((title) => (
                                                    <span key={`${cluster.clusterId}-${title}`}>{title}</span>
                                                ))}
                                            </div>
                                        )}

                                        {cluster.sampleText && (
                                            <p className="material-load__cluster-sample">
                                                {cluster.sampleText}
                                            </p>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
