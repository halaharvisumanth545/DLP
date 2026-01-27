import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchSyllabi } from "../../store/studentSlice";
import api, { endpoints } from "../../services/api";
import { generateMaterial, generateComprehensiveMaterial } from "../../services/openai";
import { STUDY_MODES } from "../../utils/constants";
import { parseError, calculateReadingTime } from "../../utils/helpers";
import CustomDropdown from "../common/CustomDropdown";
import "./StudentComponents.css";

export default function StudyMaterial() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const materialId = searchParams.get("id");

    const { syllabi, syllabiLoading } = useSelector((state) => state.student);

    const [selectedSyllabus, setSelectedSyllabus] = useState(null);
    const [selectedTopic, setSelectedTopic] = useState("");
    const [selectedMode, setSelectedMode] = useState("intermediate");
    const [material, setMaterial] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState("");

    const [error, setError] = useState("");

    // Save modal state
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [materialName, setMaterialName] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        dispatch(fetchSyllabi());
    }, [dispatch]);

    // Load saved material if ID is present
    useEffect(() => {
        if (materialId) {
            fetchSavedMaterial(materialId);
        }
    }, [materialId]);

    const fetchSavedMaterial = async (id) => {
        try {
            setLoading(true);
            setLoadingStatus("Loading saved material...");
            setError("");

            const response = await api.get(`${endpoints.student.materials}/${id}`);
            const savedMaterial = response.data.material;

            if (savedMaterial) {
                setMaterial(savedMaterial);
                setSelectedTopic(savedMaterial.topic);
                setSelectedMode(savedMaterial.mode);
                // Note: We might not have the syllabus loaded yet, but we can set it if we find it
                // Logic to set selectedSyllabus will be handled when syllabi are loaded
            }
        } catch (err) {
            console.error("Error loading material:", err);
            setError("Failed to load the saved study material.");
        } finally {
            setLoading(false);
            setLoadingStatus("");
        }
    };

    // Update selected syllabus when material and syllabi are available
    useEffect(() => {
        if (material && syllabi.length > 0 && !selectedSyllabus) {
            // Try to find the syllabus for this material
            // The material object from backend might need to include syllabusId or we match by logic
            // Ideally the backend response for material includes syllabusId
            // Let's assume the material object has syllabusId map to it.
            // Looking at the controller: getStudyMaterialById returns { material }
            // and material model has syllabusId.

            if (material.syllabusId) {
                const syllabus = syllabi.find(s => s._id === material.syllabusId);
                if (syllabus) {
                    setSelectedSyllabus(syllabus);
                }
            }
        }
    }, [material, syllabi, selectedSyllabus]);

    // Ref for the material content container
    const contentRef = useRef(null);

    // Trigger KaTeX rendering when material updates
    useEffect(() => {
        if (material && window.renderMathInElement && contentRef.current) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                try {
                    window.renderMathInElement(contentRef.current, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false },
                            { left: '\\(', right: '\\)', display: false },
                            { left: '\\[', right: '\\]', display: true }
                        ],
                        throwOnError: false
                    });
                } catch (e) {
                    console.error("KaTeX rendering error:", e);
                }
            });
        }
    }, [material]);


    // Get selected topic object with subtopics
    const getSelectedTopicObj = () => {
        if (!selectedSyllabus || !selectedTopic) return null;
        return selectedSyllabus.topics?.find(t => t.name === selectedTopic);
    };

    // Helper function to format content with code block detection
    const formatContentWithCode = (text) => {
        if (!text) return [];

        // Split content by code blocks (```language\ncode\n```)
        const parts = [];
        const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            // Add text before code block
            if (match.index > lastIndex) {
                const textBefore = text.slice(lastIndex, match.index);
                parts.push({ type: 'text', content: textBefore });
            }

            // Add code block
            parts.push({
                type: 'code-block',
                language: match[1] || 'plaintext',
                content: match[2].trim()
            });

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push({ type: 'text', content: text.slice(lastIndex) });
        }

        // If no code blocks found, return the whole text as one part
        if (parts.length === 0) {
            parts.push({ type: 'text', content: text });
        }

        return parts;
    };

    // Helper to format inline code within text
    const formatInlineCode = (text) => {
        if (!text) return text;
        // Replace `code` with styled span
        let formatted = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        // Replace **bold** with strong tags
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        return formatted;
    };

    // Render content part (text or code block)
    const renderContentPart = (part, index) => {
        if (part.type === 'code-block') {
            return (
                <div key={index} className="code-block">
                    <div className="code-header">
                        <span className="code-language">{part.language}</span>
                        <button
                            className="copy-btn"
                            onClick={() => {
                                navigator.clipboard.writeText(part.content);
                            }}
                        >
                            📋 Copy
                        </button>
                    </div>
                    <pre><code>{part.content}</code></pre>
                </div>
            );
        }

        // Text part - split by lines and handle markdown headers, bullets, and inline code
        const elements = [];
        const lines = part.content.split('\n');
        let currentList = [];

        const flushList = () => {
            if (currentList.length > 0) {
                elements.push(
                    <ul key={`${index}-list-${elements.length}`} className="content-list">
                        {currentList.map((item, i) => (
                            <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineCode(item) }} />
                        ))}
                    </ul>
                );
                currentList = [];
            }
        };

        lines.forEach((line, pIndex) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                flushList();
                return;
            }

            // Check for markdown headers
            if (trimmedLine.startsWith('### ')) {
                flushList();
                elements.push(
                    <h4 key={`${index}-${pIndex}`} className="content-heading-3">
                        {trimmedLine.substring(4)}
                    </h4>
                );
                return;
            }
            if (trimmedLine.startsWith('## ')) {
                flushList();
                elements.push(
                    <h3 key={`${index}-${pIndex}`} className="content-heading-2">
                        {trimmedLine.substring(3)}
                    </h3>
                );
                return;
            }

            // Check for bullet points
            if (trimmedLine.startsWith('- ')) {
                currentList.push(trimmedLine.substring(2));
                return;
            }

            // Regular paragraph
            flushList();
            elements.push(
                <p
                    key={`${index}-${pIndex}`}
                    dangerouslySetInnerHTML={{ __html: formatInlineCode(trimmedLine) }}
                />
            );
        });

        flushList(); // Flush any remaining list items
        return elements;
    };

    // Mode configuration for UI
    const MODE_CONFIG = [
        {
            id: STUDY_MODES.SHORT,
            label: "Short",
            icon: "⚡",
            description: "Quick overview covering key concepts"
        },
        {
            id: STUDY_MODES.INTERMEDIATE,
            label: "Intermediate",
            icon: "📘",
            description: "Balanced explanation with core details"
        },
        {
            id: STUDY_MODES.PRO,
            label: "Pro",
            icon: "🎓",
            description: "Comprehensive deep dive with all nuances"
        }
    ];

    const handleGenerate = async () => {
        if (!selectedSyllabus || !selectedTopic) {
            setError("Please select a syllabus and topic");
            return;
        }

        setLoading(true);
        setError("");
        setMaterial(null);
        setLoadingStatus("Preparing content generation...");

        try {
            const topicObj = getSelectedTopicObj();
            const subtopics = topicObj?.subtopics || [];

            // Use comprehensive generation for intermediate/pro modes with subtopics
            if ((selectedMode === "intermediate" || selectedMode === "pro") && subtopics.length > 0) {
                setLoadingStatus(`Generating content for ${subtopics.length} subtopics...`);
                const result = await generateComprehensiveMaterial(selectedTopic, subtopics, selectedMode);
                const materialData = result.material || result;
                setMaterial(materialData);
            } else {
                // Use simple generation for short mode or topics without subtopics
                setLoadingStatus("Generating study material...");
                const result = await generateMaterial(selectedSyllabus._id, selectedTopic, selectedMode);
                const materialData = result.material || result;
                setMaterial(materialData);
            }
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
            setLoadingStatus("");
        }
    };

    // Helper to format content with markdown to HTML for PDF output
    const formatContentForPDF = (text) => {
        if (!text) return '';

        const lines = text.split('\n');
        let html = '';
        let inList = false;
        let i = 0;

        while (i < lines.length) {
            const trimmed = lines[i].trim();

            if (!trimmed) {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                i++;
                continue;
            }

            // Code blocks (```language ... ```)
            if (trimmed.startsWith('```') && trimmed !== '```') {
                // Opening code block with language
                const langMatch = trimmed.match(/^```(\w+)?/);
                const language = langMatch?.[1] || 'code';
                let codeContent = '';
                i++; // Move past the opening ```

                // Collect code until closing ```
                while (i < lines.length && !lines[i].trim().startsWith('```')) {
                    codeContent += lines[i] + '\n';
                    i++;
                }
                i++; // Skip the closing ```

                html += `<div class="code-block-pdf"><span class="code-label">${language.toUpperCase()}</span><pre><code>${codeContent.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
                continue;
            }

            // Skip standalone closing code block markers (shouldn't happen, but just in case)
            if (trimmed === '```') {
                i++;
                continue;
            }

            // Headers
            if (trimmed.startsWith('### ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h4 class="pdf-h4">${trimmed.substring(4)}</h4>`;
                i++;
                continue;
            }
            if (trimmed.startsWith('## ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h3 class="pdf-h3">${trimmed.substring(3)}</h3>`;
                i++;
                continue;
            }

            // Bullet points
            if (trimmed.startsWith('- ')) {
                if (!inList) {
                    html += '<ul class="pdf-list">';
                    inList = true;
                }
                let content = trimmed.substring(2);
                content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
                html += `<li>${content}</li>`;
                i++;
                continue;
            }

            // Close list if we hit a non-bullet line
            if (inList) {
                html += '</ul>';
                inList = false;
            }

            // Regular paragraph - handle bold and inline code
            let content = trimmed;
            content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
            html += `<p>${content}</p>`;
            i++;
        }

        if (inList) html += '</ul>';
        return html;
    };

    const handleDownloadPDF = () => {
        if (!material) return;

        // Create comprehensive printable content with enhanced styling
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${material.topic} - Study Material</title>
                <style>
                    * { box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        padding: 40px; 
                        line-height: 1.8; 
                        max-width: 800px;
                        margin: 0 auto;
                        color: #333;
                        text-align: justify;
                    }
                    h1 { 
                        color: #1a1a2e; 
                        border-bottom: 3px solid #6366f1; 
                        padding-bottom: 15px; 
                        font-size: 28px;
                        margin-bottom: 10px;
                    }
                    .meta { 
                        color: #666; 
                        margin-bottom: 30px; 
                        font-size: 14px;
                        display: flex;
                        gap: 20px;
                    }
                    .meta-item {
                        background: #f0f0f0;
                        padding: 5px 12px;
                        border-radius: 15px;
                    }
                    .section { 
                        margin-bottom: 40px;
                        page-break-inside: avoid;
                    }
                    .section-header {
                        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                        color: white;
                        padding: 12px 20px;
                        border-radius: 8px 8px 0 0;
                        margin-bottom: 0;
                    }
                    .section-header h2 {
                        margin: 0;
                        font-size: 20px;
                    }
                    .section-body {
                        border: 1px solid #e0e0e0;
                        border-top: none;
                        border-radius: 0 0 8px 8px;
                        padding: 20px;
                        background: #fafafa;
                    }
                    .overview {
                        font-style: italic;
                        color: #555;
                        border-left: 3px solid #6366f1;
                        padding-left: 15px;
                        margin-bottom: 15px;
                    }
                    .content {
                        margin-bottom: 20px;
                    }
                    .key-points { 
                        background: #fff; 
                        padding: 15px 20px; 
                        border-radius: 8px;
                        border: 1px solid #e0e0e0;
                        margin-bottom: 15px;
                    }
                    .key-points h4 { 
                        margin: 0 0 10px 0; 
                        color: #6366f1;
                        font-size: 14px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .key-points ul { margin: 0; padding-left: 20px; }
                    .key-points li { margin: 8px 0; }
                    .examples {
                        background: #e8f4fd;
                        padding: 15px 20px;
                        border-radius: 8px;
                        border-left: 4px solid #3b82f6;
                    }
                    .examples h4 {
                        margin: 0 0 10px 0;
                        color: #1e40af;
                        font-size: 14px;
                    }
                    .examples ul { margin: 0; padding-left: 20px; }
                    .examples li { margin: 8px 0; }
                    .footer { 
                        margin-top: 50px; 
                        text-align: center; 
                        color: #999; 
                        font-size: 12px;
                        padding-top: 20px;
                        border-top: 1px solid #e0e0e0;
                    }
                    .toc {
                        background: #f5f5f5;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 30px;
                    }
                    .toc h3 { margin: 0 0 15px 0; color: #333; }
                    .toc ol { margin: 0; padding-left: 25px; }
                    .toc li { margin: 8px 0; color: #6366f1; }
                    /* Code Block Styling for PDF */
                    pre {
                        background: #1e1e2e !important;
                        color: #e6edf3 !important;
                        padding: 16px 20px;
                        border-radius: 8px;
                        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                        font-size: 13px;
                        line-height: 1.5;
                        margin: 16px 0;
                        border: 1px solid #3b3b4f;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    code {
                        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                        font-size: 13px;
                    }
                    .inline-code {
                        background: #f0f3f9;
                        color: #6366f1;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 0.9em;
                        border: 1px solid #e0e0e0;
                    }
                    .code-label {
                        background: #6366f1;
                        color: white;
                        padding: 4px 12px;
                        border-radius: 8px 8px 0 0;
                        font-size: 12px;
                        font-weight: 600;
                        text-transform: uppercase;
                        display: inline-block;
                        margin-bottom: -1px;
                    }
                    /* PDF Markdown Headers */
                    .pdf-h3 {
                        color: #6366f1;
                        font-size: 18px;
                        font-weight: 600;
                        margin: 25px 0 15px 0;
                        padding-bottom: 8px;
                        border-bottom: 2px solid #e0e0e0;
                    }
                    .pdf-h4 {
                        color: #4b5563;
                        font-size: 15px;
                        font-weight: 600;
                        margin: 20px 0 10px 0;
                    }
                    /* PDF Lists */
                    .pdf-list {
                        margin: 12px 0 20px 0;
                        padding-left: 24px;
                    }
                    .pdf-list li {
                        margin: 8px 0;
                        line-height: 1.6;
                    }
                    /* PDF Code Block */
                    .code-block-pdf {
                        margin: 16px 0;
                    }
                    /* Print-specific styles for A4 page layout */
                    @page {
                        size: A4;
                        margin: 20mm;
                    }
                    @media print {
                        body { 
                            padding: 0;
                            font-size: 11pt;
                            line-height: 1.6;
                        }
                        /* Prevent sections from splitting across pages */
                        .section { 
                            page-break-inside: avoid;
                            break-inside: avoid;
                            margin-bottom: 20px;
                        }
                        /* Keep section header with its content */
                        .section-header {
                            page-break-after: avoid;
                            break-after: avoid;
                        }
                        /* Prevent key points and examples boxes from splitting */
                        .key-points, .examples {
                            page-break-inside: avoid;
                            break-inside: avoid;
                            margin-top: 10px;
                        }
                        /* Prevent code blocks from splitting */
                        pre {
                            page-break-inside: avoid;
                            break-inside: avoid;
                            background: #f6f8fa !important;
                            color: #24292f !important;
                            border-color: #d0d7de !important;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                            max-height: 500px;
                            overflow: hidden;
                        }
                        /* Keep code label with its code block */
                        .code-label {
                            page-break-after: avoid;
                            break-after: avoid;
                        }
                        /* Prevent orphaned lines */
                        p {
                            orphans: 3;
                            widows: 3;
                        }
                        /* Keep list items together */
                        li {
                            page-break-inside: avoid;
                            break-inside: avoid;
                        }
                        /* Keep headers with following content */
                        h1, h2, h3, h4 {
                            page-break-after: avoid;
                            break-after: avoid;
                        }
                        /* Allow page break before major sections if needed */
                        .section:not(:first-child) {
                            page-break-before: auto;
                        }
                        /* Table of contents should stay together */
                        .toc {
                            page-break-inside: avoid;
                            break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>📚 ${material.topic}</h1>
                <div class="meta">
                    <span class="meta-item"><strong>Mode:</strong> ${material.mode}</span>
                    <span class="meta-item"><strong>Reading time:</strong> ${calculateReadingTime(material.content)} min</span>
                    ${material.subtopicsCount ? `<span class="meta-item"><strong>Sections:</strong> ${material.subtopicsCount}</span>` : ''}
                </div>
                
                ${material.sections?.length > 1 ? `
                <div class="toc">
                    <h3>📋 Table of Contents</h3>
                    <ol>
                        ${material.sections.map((s, i) => `<li>${s.title}</li>`).join('')}
                    </ol>
                </div>
                ` : ''}
                
                ${material.sections?.map((section, index) => `
                    <div class="section">
                        <div class="section-header">
                            <h2>${index + 1}. ${section.title}</h2>
                        </div>
                        <div class="section-body">
                            ${section.overview ? `<div class="overview">${section.overview}</div>` : ''}
                            <div class="content">${formatContentForPDF(section.content)}</div>
                            ${section.keyPoints?.length > 0 ? `
                                <div class="key-points">
                                    <h4>🔑 Key Points</h4>
                                    <ul>
                                        ${section.keyPoints.map(point => `<li>${point}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${section.examples?.length > 0 ? `
                                <div class="examples">
                                    <h4>💡 Examples</h4>
                                    <ul>
                                        ${section.examples.map(ex => `<li>${ex}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('') || `<div class="content"><p>${material.content}</p></div>`}
                <div class="footer">Generated by LearnAI - Digital Learning Platform | ${new Date().toLocaleDateString()}</div>
            </body>
            </html>
        `;

        // Open print dialog
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    const handleSaveClick = () => {
        if (!material) return;

        // Generate recommended name
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const recommendedName = `${material.topic} - ${material.mode.charAt(0).toUpperCase() + material.mode.slice(1)} - ${dateStr}`;

        setMaterialName(recommendedName);
        setShowSaveModal(true);
    };

    const handleConfirmSave = async () => {
        try {
            setSaving(true);

            await api.post(endpoints.student.saveMaterial, {
                syllabusId: selectedSyllabus._id,
                topic: material.topic,
                mode: material.mode,
                name: materialName,
                content: material.content,
                sections: material.sections,
                metadata: material.metadata
            });

            setShowSaveModal(false);
            if (confirm("Study material saved successfully! Would you like to view your saved materials?")) {
                navigate("/student/saved-materials");
            }
        } catch (err) {
            console.error("Error saving material:", err);
            alert("Failed to save material. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const topicObj = getSelectedTopicObj();

    // Prepare dropdown options
    const syllabusOptions = syllabi.map(s => ({
        value: s._id,
        label: s.fileName
    }));

    const topicOptions = selectedSyllabus?.topics?.map(topic => ({
        value: topic.name,
        label: `${topic.name} ${topic.subtopics?.length > 0 ? `(${topic.subtopics.length} subtopics)` : ''}`
    })) || [];

    return (
        <div className="study-material">
            <div className="page-header">
                <h1>📖 Study Material Generator</h1>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="features-grid">
                <div className="feature-badge">🤖 AI Powered</div>
                <div className="feature-badge">📚 Custom Syllabus</div>
                <div className="feature-badge">📄 Instant PDF</div>
            </div>

            <div className="material-generator">
                {!material && (
                    <div className="generator-form">
                        <div className="setup-section">
                            <h3>Content Source</h3>

                            <label style={{ display: 'block', marginBottom: '12px', color: '#a5b4fc', fontSize: '0.9rem', fontWeight: '600' }}>Select Syllabus</label>
                            <div className="syllabus-grid">
                                {syllabi.map((s) => (
                                    <div
                                        key={s._id}
                                        className={`syllabus-card ${selectedSyllabus?._id === s._id ? "selected" : ""}`}
                                        onClick={() => {
                                            setSelectedSyllabus(s);
                                            setSelectedTopic("");
                                        }}
                                    >
                                        <span style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📚</span>
                                        <span className="syllabus-name">{s.fileName}</span>
                                        <span className="topic-count">{s.topics?.length || 0} topics</span>
                                    </div>
                                ))}
                            </div>

                            {selectedSyllabus && (
                                <div style={{ marginTop: '24px' }}>
                                    <label style={{ display: 'block', marginBottom: '12px', color: '#a5b4fc', fontSize: '0.9rem', fontWeight: '600' }}>Select Topic</label>
                                    <div className="topics-grid">
                                        {selectedSyllabus.topics?.map((topic, index) => (
                                            <div
                                                key={index}
                                                className={`topic-chip ${selectedTopic === topic.name ? "selected" : ""}`}
                                                onClick={() => setSelectedTopic(topic.name)}
                                            >
                                                <span>{topic.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Show subtopics preview if available */}
                        {topicObj?.subtopics?.length > 0 && (
                            <div className="setup-section">
                                <h3>Topic Scope</h3>
                                <div className="subtopics-preview">
                                    <label>Subtopics to cover</label>
                                    <ul className="subtopics-list">
                                        {topicObj.subtopics.map((st, i) => (
                                            <li key={i}>{st}</li>
                                        ))}
                                    </ul>
                                    <p className="subtopics-note">
                                        ℹ️ In Intermediate/Pro mode, each subtopic will be covered in detail.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="setup-section">
                            <h3>Depth & Detail</h3>
                            <label style={{ display: 'block', marginBottom: '12px', color: '#a5b4fc', fontSize: '0.9rem', fontWeight: '600' }}>Select Generation Mode</label>
                            <div className="mode-selection-grid">
                                {MODE_CONFIG.map((mode) => (
                                    <div
                                        key={mode.id}
                                        className={`mode-card ${selectedMode === mode.id ? "selected" : ""}`}
                                        onClick={() => setSelectedMode(mode.id)}
                                        tabIndex={0}
                                        role="button"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                setSelectedMode(mode.id);
                                            }
                                        }}
                                    >
                                        <div className="mode-card-header">
                                            <div className="mode-icon">{mode.icon}</div>
                                            <span className="mode-label">{mode.label}</span>
                                        </div>
                                        <p className="mode-desc">{mode.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            className="btn-primary btn-start quiz-start"
                            onClick={handleGenerate}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    {loadingStatus}
                                </>
                            ) : (
                                "✨ Generate Study Material"
                            )}
                        </button>
                    </div>
                )}

                {material && (
                    <div className="material-content">
                        <div className="material-header">
                            <h2>{material.topic}</h2>
                            <div className="material-meta">
                                <span>📚 {material.mode} mode</span>
                                <span>⏱️ {calculateReadingTime(material.content)} min read</span>
                                {material.subtopicsCount && (
                                    <span>📑 {material.successCount || material.subtopicsCount}/{material.subtopicsCount} sections</span>
                                )}
                            </div>
                        </div>

                        <div className="material-body">
                            {material.sections && material.sections.length > 0 ? (
                                material.sections.map((section, index) => (
                                    <div key={index} className="material-section">
                                        <h3>
                                            <span className="section-number">{index + 1}</span>
                                            {" "}{section.title}
                                        </h3>

                                        {section.overview && (
                                            <div className="section-overview">
                                                {section.overview}
                                            </div>
                                        )}

                                        <div className="section-content">
                                            {formatContentWithCode(section.content).map((part, pIndex) =>
                                                renderContentPart(part, pIndex)
                                            )}
                                        </div>

                                        {section.keyPoints?.length > 0 && (
                                            <div className="key-points">
                                                <h4>🔑 Key Points:</h4>
                                                <ul>
                                                    {section.keyPoints.map((point, i) => (
                                                        <li key={i}>{point}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {section.examples?.length > 0 && (
                                            <div className="examples-box">
                                                <h4>💡 Examples:</h4>
                                                <ul>
                                                    {section.examples.map((ex, i) => (
                                                        <li key={i}>{ex}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="material-text">
                                    {formatContentWithCode(material.content).map((part, pIndex) =>
                                        renderContentPart(part, pIndex)
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="material-actions">
                            <button className="btn-secondary" onClick={handleDownloadPDF}>📥 Download PDF</button>
                            <button className="save-btn" onClick={handleSaveClick}>💾 Save to Library</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>Save Study Material</h2>
                        <p>Give your study material a name to find it easily later.</p>

                        <div className="input-group">
                            <label>Material Name</label>
                            <input
                                type="text"
                                value={materialName}
                                onChange={(e) => setMaterialName(e.target.value)}
                                placeholder="e.g. Python Basics - Exam Prep"
                                autoFocus
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowSaveModal(false)}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleConfirmSave}
                                disabled={saving || !materialName.trim()}
                            >
                                {saving ? "Saving..." : "Save Material"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

