import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { endpoints } from "../../services/api";
import { calculateReadingTime } from "../../utils/helpers";
import "./ViewMaterial.css"; // We'll create this specific CSS file

export default function ViewMaterial() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [material, setMaterial] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchMaterial();
    }, [id]);

    const contentRef = useRef(null);

    useEffect(() => {
        if (material && window.renderMathInElement && contentRef.current) {
            // Use requestAnimationFrame for smoother timing than setTimeout
            requestAnimationFrame(() => {
                if (contentRef.current) {
                    window.renderMathInElement(contentRef.current, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false },
                            { left: '\\(', right: '\\)', display: false },
                            { left: '\\[', right: '\\]', display: true }
                        ],
                        throwOnError: false
                    });
                }
            });
        }
    }, [material]);

    const fetchMaterial = async () => {
        try {
            setLoading(true);
            const response = await api.get(`${endpoints.student.materials}/${id}`);
            setMaterial(response.data.material);
        } catch (err) {
            console.error("Error fetching material:", err);
            setError("Failed to load material");
        } finally {
            setLoading(false);
        }
    };

    // Helper to format content for display (similar to PDF logic but React-friendly)
    const renderContent = (text) => {
        if (!text) return null;

        // This is a simplified version of the logic. 
        // For a true "PDF" look, we might want to preserve the HTML-like structure 
        // or re-use the formatContentWithCode logic if we want syntax highlighting.
        // Given the requirement is "fully and perfectly styled HTML page", 
        // we can reuse the `formatContentForPDF` logic but render it using dangerouslySetInnerHTML
        // OR we can map it to React components.
        // Let's go with dangerouslySetInnerHTML for fidelity to the PDF output which IS HTML.

        return <div dangerouslySetInnerHTML={{ __html: formatContentForPDF(text) }} />;
    };

    // Reusing the PDF formatting logic exactly as requested
    const formatContentForPDF = (text) => {
        if (!text) return '';
        const lines = text.split('\n');
        let html = '';
        let inList = false;
        let i = 0;

        while (i < lines.length) {
            const trimmed = lines[i].trim();

            if (!trimmed) {
                if (inList) { html += '</ul>'; inList = false; }
                i++; continue;
            }

            // Code blocks
            if (trimmed.startsWith('```') && trimmed !== '```') {
                const langMatch = trimmed.match(/^```(\w+)?/);
                const language = langMatch?.[1] || 'code';
                let codeContent = '';
                i++;
                while (i < lines.length && !lines[i].trim().startsWith('```')) {
                    codeContent += lines[i] + '\n';
                    i++;
                }
                i++;
                html += `<div class="code-block-view"><span class="code-label">${language.toUpperCase()}</span><pre><code>${codeContent.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
                continue;
            }

            if (trimmed === '```') { i++; continue; }

            // Headers
            if (trimmed.startsWith('### ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h4 class="view-h4">${trimmed.substring(4)}</h4>`;
                i++; continue;
            }
            if (trimmed.startsWith('## ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h3 class="view-h3">${trimmed.substring(3)}</h3>`;
                i++; continue;
            }

            // Bullet points
            if (trimmed.startsWith('- ')) {
                if (!inList) { html += '<ul class="view-list">'; inList = true; }
                let content = trimmed.substring(2);
                content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
                html += `<li>${content}</li>`;
                i++; continue;
            }

            // Close list
            if (inList) { html += '</ul>'; inList = false; }

            // Paragraphs
            let content = trimmed;
            content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
            html += `<p>${content}</p>`;
            i++;
        }
        if (inList) html += '</ul>';
        return html;
    };

    if (loading) return <div className="view-loading"><div className="spinner"></div> Loading...</div>;
    if (error) return <div className="view-error">{error}</div>;
    if (!material) return <div className="view-error">Material not found</div>;

    return (
        <div className="view-material-container">
            <div className="view-content-wrapper">
                <button onClick={() => navigate("/student/saved-materials")} className="back-btn">
                    ← Back to Library
                </button>

                <div className="view-paper" ref={contentRef}>
                    <h1>📚 {material.name || material.topic}</h1>

                    <div className="view-meta">
                        <span className="meta-tag"><strong>Topic:</strong> {material.topic}</span>
                        <span className="meta-tag"><strong>Mode:</strong> {material.mode}</span>
                        <span className="meta-tag"><strong>Time:</strong> {calculateReadingTime(material.content)} min</span>
                    </div>

                    {material.sections && material.sections.length > 1 && (
                        <div className="view-toc">
                            <h3>📋 Table of Contents</h3>
                            <ol>
                                {material.sections.map((s, i) => <li key={i}>{s.title}</li>)}
                            </ol>
                        </div>
                    )}

                    {material.sections && material.sections.length > 0 ? (
                        material.sections.map((section, index) => (
                            <div key={index} className="view-section">
                                <div className="view-section-header">
                                    <h2>{index + 1}. {section.title}</h2>
                                </div>
                                <div className="view-section-body">
                                    {section.overview && <div className="view-overview">{section.overview}</div>}

                                    <div className="view-content">
                                        {renderContent(section.content)}
                                    </div>

                                    {section.keyPoints?.length > 0 && (
                                        <div className="view-box view-key-points">
                                            <h4>🔑 Key Points</h4>
                                            <ul>
                                                {section.keyPoints.map((point, i) => <li key={i}>{point}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {section.examples?.length > 0 && (
                                        <div className="view-box examples">
                                            <h4>💡 Examples</h4>
                                            <ul>
                                                {section.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="view-content">{renderContent(material.content)}</div>
                    )}

                    <div className="view-footer">
                        Generated by LearnAI - Digital Learning Platform | {new Date(material.createdAt).toLocaleDateString()}
                    </div>
                </div>
            </div>
        </div>
    );
}
