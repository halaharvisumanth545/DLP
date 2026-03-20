import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { endpoints } from "../../services/api";
import { calculateReadingTime } from "../../utils/helpers";
import "./ViewMaterial.css"; // We'll create this specific CSS file

import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import ReactMarkdown from 'react-markdown';
import { ClipboardIcon, CheckCircleIcon } from "../common/Icons";

export default function ViewMaterial() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [material, setMaterial] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const scrollToSection = (index) => {
        const el = document.getElementById(`section-${index}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    useEffect(() => {
        fetchMaterial();
    }, [id]);

    const contentRef = useRef(null);

    // Markdown customization for ViewMaterial (Mirroring StudyMaterial)
    const CopyButton = ({ content }) => {
        const [copied, setCopied] = useState(false);

        const handleCopy = () => {
            navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        return (
            <button
                className={`copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
            >
                {copied ? (
                    <>
                        <CheckCircleIcon /> Copied!
                    </>
                ) : (
                    <>
                        <ClipboardIcon /> Copy
                    </>
                )}
            </button>
        );
    };

    const MarkdownComponents = {
        code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            const codeString = String(children).replace(/\\n$/, '');

            if (!inline && match) {
                return (
                    <div className="code-block">
                        <div className="code-header">
                            <span className="code-language">{language}</span>
                            <CopyButton content={codeString} />
                        </div>
                        <pre>
                            <code className={className} {...props}>
                                {children}
                            </code>
                        </pre>
                    </div>
                );
            }
            return (
                <code className={`inline-code ${className || ''}`} {...props}>
                    {children}
                </code>
            );
        },
        table({ node, ...props }) {
            return (
                <div className="table-responsive" style={{ margin: '16px 0', overflowX: 'auto' }}>
                    <table className="content-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-color)', textAlign: 'left' }} {...props} />
                </div>
            );
        },
        thead({ node, ...props }) {
            return <thead style={{ backgroundColor: 'var(--surface-color)' }} {...props} />;
        },
        th({ node, ...props }) {
            return <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--border-color)', fontWeight: '600' }} {...props} />;
        },
        td({ node, ...props }) {
            return <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }} {...props} />;
        },
        h2({ node, ...props }) {
            return <h3 className="content-heading-2" {...props} />;
        },
        h3({ node, ...props }) {
            return <h4 className="content-heading-3" {...props} />;
        },
        img({ node, src, alt, ...props }) {
            return (
                <figure style={{ margin: '20px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img
                        src={src}
                        alt={alt || 'Illustration'}
                        style={{
                            maxWidth: '100%',
                            width: 'auto',
                            maxHeight: '400px',
                            borderRadius: '10px',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                            display: 'inline-block'
                        }}
                        loading="lazy"
                        {...props}
                    />
                    {alt && <figcaption style={{ marginTop: '8px', fontSize: '0.85rem', color: '#888', fontStyle: 'italic' }}>{alt}</figcaption>}
                </figure>
            );
        }
    };

    const fetchMaterial = async () => {
        try {
            setLoading(true);
            const response = await api.get(`${endpoints.student.materials}/${id}`);
            let fetchedMaterial = response.data.material;

            // Fallback for older materials saved as raw JSON strings
            if (fetchedMaterial && typeof fetchedMaterial.content === 'string' && fetchedMaterial.content.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(fetchedMaterial.content);
                    if (parsed.content) {
                        fetchedMaterial.content = parsed.content;
                        if (parsed.sections && parsed.sections.length > 0) {
                            fetchedMaterial.sections = parsed.sections;
                        }
                    }
                } catch (e) {
                    // Not valid JSON, keep as is
                }
            }

            setMaterial(fetchedMaterial);
        } catch (err) {
            console.error("Error fetching material:", err);
            setError("Failed to load material");
        } finally {
            setLoading(false);
        }
    };



    if (loading) return <div className="view-loading"><div className="spinner"></div> Loading...</div>;
    if (error) return <div className="view-error">{error}</div>;
    if (!material) return <div className="view-error">Material not found</div>;

    return (
        <div className="view-material-container">
            <div className="view-content-wrapper">
                <button onClick={() => window.close()} className="back-btn" title="Close Tab">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <path d="M19 12H5" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Return to Library
                </button>

                <div className="view-paper" ref={contentRef}>
                    <h1>{material.name || material.topic}</h1>

                    <div className="view-meta">
                        <span className="meta-tag"><strong>Topic:</strong> {material.topic}</span>
                        <span className="meta-tag"><strong>Mode:</strong> {material.mode}</span>
                        <span className="meta-tag"><strong>Time:</strong> {calculateReadingTime(material.content)} min</span>
                    </div>

                    {material.sections && material.sections.length > 1 && (
                        <div className="view-toc">
                            <h3>Table of Contents</h3>
                            <ol>
                                {material.sections.map((s, i) => (
                                    <li key={i}>
                                        <button
                                            className="toc-link"
                                            onClick={() => scrollToSection(i)}
                                        >
                                            {s.title}
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {material.sections && material.sections.length > 0 ? (
                        material.sections.map((section, index) => (
                            <div key={index} id={`section-${index}`} className="view-section">
                                <div className="view-section-header">
                                    <h2>{index + 1}. {section.title}</h2>
                                </div>
                                <div className="view-section-body">
                                    <div className="view-content content-rendered">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkMath]}
                                            rehypePlugins={[rehypeKatex, rehypeRaw]}
                                            components={MarkdownComponents}
                                        >
                                            {section.content}
                                        </ReactMarkdown>
                                    </div>

                                    {section.keyPoints?.length > 0 && (
                                        <div className="view-box view-key-points">
                                            <h4>Key Points</h4>
                                            <ul>
                                                {section.keyPoints.map((point, i) => <li key={i}>{point.replace(/^[\s•\-\*]+/, '')}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {section.examples?.length > 0 && (
                                        <div className="view-box examples">
                                            <h4>Examples</h4>
                                            <ul>
                                                {section.examples.map((ex, i) => <li key={i}>{ex.replace(/^[\s•\-\*]+/, '')}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="view-content content-rendered">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex, rehypeRaw]}
                                components={MarkdownComponents}
                            >
                                {material.content}
                            </ReactMarkdown>
                        </div>
                    )}

                    <div className="view-footer">
                        Generated by LearnAI - Digital Learning Platform | {new Date(material.createdAt).toLocaleDateString()}
                    </div>

                    <div className="view-back-top">
                        <button
                            className="btn-back-top"
                            onClick={() => {
                                const container = document.querySelector(".view-material-container");
                                if (container) container.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                        >
                            Back to Top
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
