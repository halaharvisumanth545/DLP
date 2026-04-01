import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import api, { endpoints } from "../../services/api";
import { calculateReadingTime } from "../../utils/helpers";
import "./ViewMaterial.css"; // We'll create this specific CSS file

import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import ReactMarkdown from 'react-markdown';
import { ClipboardIcon, CheckCircleIcon, XIcon, ListIcon, PlusIcon, SendIcon } from "../common/Icons";

export default function ViewMaterial() {
    const { id } = useParams();
    const [material, setMaterial] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [showChatHistory, setShowChatHistory] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatSessions, setChatSessions] = useState([]);
    const [activeChatSessionId, setActiveChatSessionId] = useState("");
    const [chatSessionLoading, setChatSessionLoading] = useState(false);

    const buildDraftAssistantMessage = () => ({
        id: `assistant-draft-${Date.now()}`,
        role: "assistant",
        text: material?.topic
            ? `Ask me anything about ${material.topic}. I will answer from the study material for this topic.`
            : "Ask me anything about this topic. I will answer from the study material you are viewing.",
        sources: [],
        inScope: true,
    });

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
    const chatMessagesRef = useRef(null);
    const historyPanelRef = useRef(null);
    const historyToggleRef = useRef(null);

    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [chatMessages, isChatOpen]);

    useEffect(() => {
        if (!material?._id) {
            return;
        }

        initializeChatPanel();
    }, [material?._id]);

    useEffect(() => {
        if (!showChatHistory) {
            return undefined;
        }

        const handleOutsideHistoryClick = (event) => {
            const target = event.target;
            if (historyPanelRef.current?.contains(target)) {
                return;
            }

            if (historyToggleRef.current?.contains(target)) {
                return;
            }

            setShowChatHistory(false);
        };

        document.addEventListener("mousedown", handleOutsideHistoryClick);
        document.addEventListener("touchstart", handleOutsideHistoryClick);

        return () => {
            document.removeEventListener("mousedown", handleOutsideHistoryClick);
            document.removeEventListener("touchstart", handleOutsideHistoryClick);
        };
    }, [showChatHistory]);

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

    const ChatMarkdownComponents = {
        p({ node, ...props }) {
            return <p {...props} />;
        },
        ul({ node, ...props }) {
            return <ul {...props} />;
        },
        ol({ node, ...props }) {
            return <ol {...props} />;
        },
        li({ node, ...props }) {
            return <li {...props} />;
        },
        strong({ node, ...props }) {
            return <strong {...props} />;
        },
        em({ node, ...props }) {
            return <em {...props} />;
        },
        code({ inline, className, children, ...props }) {
            if (inline) {
                return (
                    <code className={`material-chat-inline-code ${className || ""}`.trim()} {...props}>
                        {children}
                    </code>
                );
            }

            return (
                <pre className="material-chat-code-block">
                    <code className={className} {...props}>
                        {children}
                    </code>
                </pre>
            );
        },
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

    const normalizeChatSession = (session) => ({
        id: session.id || session._id,
        title: session.title || "New chat",
        topic: session.topic || material?.topic || "",
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        messageCount: session.messageCount || (Array.isArray(session.messages) ? session.messages.length : 0),
        messages: Array.isArray(session.messages)
            ? session.messages.map((message) => ({
                id: message.id || message._id || `${message.role}-${Date.now()}`,
                role: message.role,
                text: message.text,
                sources: Array.isArray(message.sources) ? message.sources : [],
                inScope: message.inScope !== false,
                createdAt: message.createdAt,
            }))
            : [],
    });

    const loadChatSessions = async (preferredSessionId = "") => {
        const response = await api.get(`${endpoints.student.materialChatSessions}/${id}/chat-sessions`);
        const sessions = (response.data.sessions || []).map(normalizeChatSession);
        setChatSessions(sessions);

        if (preferredSessionId) {
            setActiveChatSessionId(preferredSessionId);
        }

        return sessions;
    };

    const createChatSession = async ({ hydrateMessages = true } = {}) => {
        const response = await api.post(`${endpoints.student.materialChatSessions}/${id}/chat-sessions`);
        const session = normalizeChatSession(response.data.session);
        setActiveChatSessionId(session.id);
        if (hydrateMessages) {
            setChatMessages(session.messages);
        }
        return session;
    };

    const resetDraftChat = () => {
        setActiveChatSessionId("");
        setChatInput("");
        setChatMessages([buildDraftAssistantMessage()]);
    };

    const initializeChatPanel = async () => {
        try {
            setChatSessionLoading(true);
            setChatSessions([]);
            setShowChatHistory(false);
            resetDraftChat();
            await loadChatSessions();
        } catch (err) {
            const message = err.response?.data?.error || "Failed to initialize the topic assistant.";
            setChatMessages([
                {
                    id: `assistant-init-${Date.now()}`,
                    role: "assistant",
                    text: message,
                    sources: [],
                },
            ]);
        } finally {
            setChatSessionLoading(false);
        }
    };

    const openChatSession = async (sessionId) => {
        if (!sessionId || sessionId === activeChatSessionId) {
            setShowChatHistory(false);
            return;
        }

        try {
            setChatSessionLoading(true);
            const response = await api.get(`${endpoints.student.materialChatSessions}/${id}/chat-sessions/${sessionId}`);
            const session = normalizeChatSession(response.data.session);
            setActiveChatSessionId(session.id);
            setChatMessages(session.messages);
            setShowChatHistory(false);
            setIsChatOpen(true);
        } catch (err) {
            const message = err.response?.data?.error || "Failed to load that chat session.";
            setChatMessages((currentMessages) => [
                ...currentMessages,
                {
                    id: `assistant-load-error-${Date.now()}`,
                    role: "assistant",
                    text: message,
                    sources: [],
                },
            ]);
        } finally {
            setChatSessionLoading(false);
        }
    };

    const submitChatQuery = async () => {
        const trimmedQuery = chatInput.trim();
        if (!trimmedQuery || chatLoading) {
            return;
        }

        const userMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            text: trimmedQuery,
            sources: [],
        };

        setChatMessages((currentMessages) => [...currentMessages, userMessage]);
        setChatInput("");
        setChatLoading(true);

        try {
            let sessionId = activeChatSessionId;
            if (!sessionId) {
                const session = await createChatSession({ hydrateMessages: false });
                sessionId = session.id;
            }

            const response = await api.post(`${endpoints.student.materialChatSessions}/${id}/chat-sessions/${sessionId}/messages`, {
                query: trimmedQuery,
            });
            const session = normalizeChatSession(response.data.session);
            setActiveChatSessionId(session.id);
            setChatMessages(session.messages);
            await loadChatSessions(session.id);
        } catch (err) {
            const message = err.response?.data?.error || "I could not process that question right now.";
            setChatMessages((currentMessages) => [
                ...currentMessages,
                {
                    id: `assistant-error-${Date.now()}`,
                    role: "assistant",
                    text: message,
                    sources: [],
                },
            ]);
        } finally {
            setChatLoading(false);
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

            <div className="material-chat-shell">
                {isChatOpen && (
                    <div className="material-chat-panel">
                        <div className="material-chat-header">
                            <div>
                                <strong>Topic Assistant</strong>
                            </div>
                            <div className="material-chat-header-actions">
                                <button
                                    type="button"
                                    className="material-chat-action"
                                    ref={historyToggleRef}
                                    onClick={() => setShowChatHistory((open) => !open)}
                                    aria-label="Toggle chat history"
                                    title="History"
                                >
                                    <ListIcon />
                                </button>
                                <button
                                    type="button"
                                    className="material-chat-close"
                                    onClick={() => setIsChatOpen(false)}
                                    aria-label="Close chat"
                                >
                                    <XIcon />
                                </button>
                            </div>
                        </div>

                        {showChatHistory && (
                            <div
                                ref={historyPanelRef}
                                className="material-chat-history material-chat-history--overlay"
                            >
                                <div className="material-chat-history-topbar">
                                    <strong>History</strong>
                                    <div className="material-chat-history-actions">
                                        <button
                                            type="button"
                                            className="material-chat-new-session"
                                            onClick={() => {
                                                setShowChatHistory(false);
                                                resetDraftChat();
                                            }}
                                        >
                                            <PlusIcon />
                                            <span>New chat</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="material-chat-action"
                                            onClick={() => setShowChatHistory(false)}
                                            aria-label="Close history"
                                            title="Close history"
                                        >
                                            <XIcon />
                                        </button>
                                    </div>
                                </div>
                                <div className="material-chat-history-list">
                                    {chatSessions.length > 0 ? (
                                        chatSessions.map((session) => (
                                            <button
                                                key={session.id}
                                                type="button"
                                                className={`material-chat-history-item ${session.id === activeChatSessionId ? "material-chat-history-item--active" : ""}`}
                                                onClick={() => openChatSession(session.id)}
                                            >
                                                <strong>{session.title}</strong>
                                                <span>{new Date(session.lastActivityAt || session.createdAt).toLocaleString()}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="material-chat-empty-state">No previous chats for this material yet.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="material-chat-messages" ref={chatMessagesRef}>
                            {chatSessionLoading && chatMessages.length === 0 ? (
                                <div className="material-chat-empty-state">Preparing a new topic chat...</div>
                            ) : null}
                            {chatMessages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`material-chat-bubble material-chat-bubble--${message.role}`}
                                >
                                    {message.role === "assistant" ? (
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                            components={ChatMarkdownComponents}
                                        >
                                            {message.text}
                                        </ReactMarkdown>
                                    ) : (
                                        <p>{message.text}</p>
                                    )}
                                    {message.sources?.length > 0 && (
                                        <div className="material-chat-sources">
                                            {message.sources.map((source) => (
                                                <span key={source} className="material-chat-source-pill">
                                                    {source}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="material-chat-bubble material-chat-bubble--assistant material-chat-bubble--loading">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            )}
                        </div>

                        <form
                            className="material-chat-form"
                            onSubmit={(e) => {
                                e.preventDefault();
                                submitChatQuery();
                            }}
                        >
                            <textarea
                                className="material-chat-input"
                                placeholder={`Ask about ${material.topic}`}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        submitChatQuery();
                                    }
                                }}
                                rows={1}
                            />
                            <button
                                type="submit"
                                className="material-chat-send"
                                disabled={chatLoading || chatSessionLoading || !chatInput.trim()}
                                aria-label="Send message"
                                title="Send"
                            >
                                <SendIcon />
                            </button>
                        </form>
                    </div>
                )}

                <button
                    type="button"
                    className="material-chat-launcher"
                    onClick={() => setIsChatOpen((open) => !open)}
                    aria-label={isChatOpen ? "Hide topic assistant" : "Open topic assistant"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
