import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api, { endpoints } from "../../services/api";
import { ROUTES } from "../../utils/constants";
import { formatDate } from "../../utils/helpers";

import {
    CalendarIcon,
    FileTextIcon,
    TrashIcon,
    BookIcon,
    SearchIcon,
    PlusIcon,
    FilterIcon,
    XIcon
} from "../common/Icons";
import "./StudentComponents.css";

export default function SavedMaterials() {
    const navigate = useNavigate();
    const location = useLocation();
    const cameFromDashboard = location.state?.from === 'dashboard';
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteModal, setDeleteModal] = useState({ show: false, materialId: null });

    // Combine feature state
    const [showCombineModal, setShowCombineModal] = useState(false);
    const [combineSelections, setCombineSelections] = useState([]); // Array of material IDs
    const [combineName, setCombineName] = useState("");
    const [isCombining, setIsCombining] = useState(false);

    // Filter state
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterSyllabi, setFilterSyllabi] = useState([]);   // selected syllabus IDs
    const [filterModes, setFilterModes] = useState([]);       // selected modes
    const [filterDateRange, setFilterDateRange] = useState("all"); // "7", "30", "90", "all"

    useEffect(() => {
        fetchMaterials();
    }, []);

    const fetchMaterials = async () => {
        try {
            setLoading(true);
            const response = await api.get(`${endpoints.student.getAllMaterials}?limit=all`);
            setMaterials(response.data.materials || []);
            setError(null);
        } catch (err) {
            console.error("Error fetching materials:", err);
            setError("Failed to load saved materials. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Derive unique syllabi from materials
    const uniqueSyllabi = useMemo(() => {
        const map = new Map();
        materials.forEach(m => {
            const sId = m.syllabusId?._id || m.syllabusId;
            const sName = m.syllabusId?.fileName || "Unknown Syllabus";
            if (sId && !map.has(sId)) {
                map.set(sId, sName);
            }
        });
        return Array.from(map, ([id, name]) => ({ id, name }));
    }, [materials]);

    // Count active filters
    const activeFilterCount = filterSyllabi.length + filterModes.length + (filterDateRange !== "all" ? 1 : 0);

    // Filtering logic
    const filteredMaterials = useMemo(() => {
        return materials.filter(material => {
            // Search
            const matchesSearch = !searchTerm || (material.name || material.topic).toLowerCase().includes(searchTerm.toLowerCase());

            // Mode filter
            const matchesMode = filterModes.length === 0 || filterModes.includes(material.mode);

            // Syllabus filter
            const materialSyllabusId = material.syllabusId?._id || material.syllabusId;
            const matchesSyllabus = filterSyllabi.length === 0 || filterSyllabi.includes(materialSyllabusId);

            // Date filter
            let matchesDate = true;
            if (filterDateRange !== "all") {
                const daysAgo = parseInt(filterDateRange);
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - daysAgo);
                matchesDate = new Date(material.createdAt) >= cutoff;
            }

            return matchesSearch && matchesMode && matchesSyllabus && matchesDate;
        });
    }, [materials, searchTerm, filterModes, filterSyllabi, filterDateRange]);

    // Group materials by syllabus
    const groupedMaterials = useMemo(() => {
        const groups = new Map();
        filteredMaterials.forEach(m => {
            const sName = m.syllabusId?.fileName || "Unknown Syllabus";
            if (!groups.has(sName)) groups.set(sName, []);
            groups.get(sName).push(m);
        });
        return Array.from(groups, ([name, items]) => ({ name, items }));
    }, [filteredMaterials]);

    const clearAllFilters = () => {
        setFilterSyllabi([]);
        setFilterModes([]);
        setFilterDateRange("all");
    };

    const toggleFilterSyllabus = (id) => {
        setFilterSyllabi(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };

    const toggleFilterMode = (mode) => {
        setFilterModes(prev => prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]);
    };

    const handleDeleteClick = (e, id) => {
        e.stopPropagation();
        setDeleteModal({ show: true, materialId: id });
    };

    const confirmDelete = async () => {
        if (!deleteModal.materialId) return;
        try {
            await api.delete(`${endpoints.student.deleteMaterial}/${deleteModal.materialId}`);
            setMaterials(materials.filter(m => m._id !== deleteModal.materialId));
            setDeleteModal({ show: false, materialId: null });
        } catch (err) {
            console.error("Error deleting material:", err);
            alert("Failed to delete material");
        }
    };

    const toggleCombineSelection = (id) => {
        setCombineSelections(prev =>
            prev.includes(id) ? prev.filter(selId => selId !== id) : [...prev, id]
        );
    };

    const handleCombineMaterials = async () => {
        if (combineSelections.length < 2) {
            alert("Please select at least 2 materials to combine.");
            return;
        }
        if (!combineName.trim()) {
            alert("Please provide a name for the combined material.");
            return;
        }

        try {
            setIsCombining(true);
            const response = await api.post(endpoints.student.combineMaterials, {
                materialIds: combineSelections,
                name: combineName
            });

            // Add the newly created combined material to the state
            if (response.data && response.data.material) {
                // Ensure it has a formatted display
                setMaterials([response.data.material, ...materials]);
                // Close modal and reset state
                setShowCombineModal(false);
                setCombineSelections([]);
                setCombineName("");

                // Refresh list if needed to ensure all nested data is present
                fetchMaterials();
            }
        } catch (err) {
            console.error("Error combining materials:", err);
            alert("Failed to combine materials.");
        } finally {
            setIsCombining(false);
        }
    };

    const formatContentForPDF = (text) => {
        if (!text) return '';
        const lines = text.split('\n');
        let html = '';
        let currentList = [];

        const flushList = () => {
            if (currentList.length > 0) {
                const baseIndent = currentList.reduce((min, item) => Math.min(min, item.indent), Infinity);

                const buildNestedListHTML = (items, currentIndent) => {
                    let htmlList = '<ul>';
                    let i = 0;
                    while (i < items.length) {
                        const item = items[i];
                        if (item.indent === currentIndent) {
                            const children = [];
                            let j = i + 1;
                            while (j < items.length && items[j].indent > currentIndent) {
                                children.push(items[j]);
                                j++;
                            }

                            let content = item.text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
                            htmlList += `<li>${content}`;
                            if (children.length > 0) {
                                htmlList += buildNestedListHTML(children, children[0].indent);
                            }
                            htmlList += '</li>';

                            i = j;
                        } else {
                            i++;
                        }
                    }
                    htmlList += '</ul>';
                    return htmlList;
                };

                html += buildNestedListHTML(currentList, baseIndent);
                currentList = [];
            }
        };

        let i = 0;
        while (i < lines.length) {
            const rightTrimmed = lines[i].trimEnd();
            const trimmed = rightTrimmed.trimStart();

            if (!trimmed) { flushList(); i++; continue; }
            if (trimmed.startsWith('```') && trimmed !== '```') {
                flushList();
                const langMatch = trimmed.match(/^```(\w+)?/);
                const language = langMatch?.[1] || 'code';
                let codeContent = ''; i++;
                while (i < lines.length && !lines[i].trim().startsWith('```')) { codeContent += lines[i] + '\n'; i++; }
                i++;
                html += `<div class="code-block-pdf"><span class="code-label">${language.toUpperCase()}</span><pre><code>${codeContent.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
                continue;
            }
            if (trimmed === '```') { i++; continue; }
            if (trimmed.startsWith('### ')) { flushList(); html += `<h4>${trimmed.substring(4)}</h4>`; i++; continue; }
            if (trimmed.startsWith('## ')) { flushList(); html += `<h3>${trimmed.substring(3)}</h3>`; i++; continue; }

            const bulletMatch = rightTrimmed.match(/^(\s*)[-*]\s+(.+)/);
            if (bulletMatch) {
                const indent = bulletMatch[1].length;
                const text = bulletMatch[2];
                currentList.push({ indent, text });
                i++; continue;
            }

            const numMatch = rightTrimmed.match(/^(\s*)\d+\.\s+(.+)/);
            if (numMatch) {
                const indent = numMatch[1].length;
                const text = numMatch[2];
                currentList.push({ indent, text });
                i++; continue;
            }

            flushList();
            let content = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
            html += `<p>${content}</p>`; i++;
        }
        flushList();
        return html;
    };

    const handleDownloadPDF = async (e, material) => {
        e.stopPropagation();
        try {
            const response = await api.get(`${endpoints.student.materials}/${material._id}`);
            const fullMaterial = response.data.material || material;

            const printContent = `
                <!DOCTYPE html><html><head>
                <title>${fullMaterial.name || fullMaterial.topic} - Study Material</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=Poppins:wght@400;500;600;700&display=swap');
                    * { box-sizing: border-box; }
                    body { font-family: 'Inter', sans-serif; padding: 40px; line-height: 1.8; max-width: 800px; margin: 0 auto; color: #333; text-align: justify; }
                    h1, h2, h3, h4, h5, h6 { font-family: 'Poppins', sans-serif; }
                    h1 { color: #1a1a2e; border-bottom: 3px solid #6366f1; padding-bottom: 15px; font-size: 26px; margin-bottom: 10px; }
                    .meta { color: #666; margin-bottom: 30px; font-size: 13px; display: flex; gap: 16px; flex-wrap: wrap; }
                    .meta-item { background: #f0f0f0; padding: 4px 12px; border-radius: 15px; }
                    .section { margin-bottom: 36px; page-break-inside: avoid; }
                    .section-header { background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; padding: 10px 18px; border-radius: 8px 8px 0 0; }
                    .section-header h2 { margin: 0; font-size: 18px; }
                    .section-body { border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; padding: 18px; background: #fafafa; }
                    .overview { font-style: italic; color: #555; border-left: 3px solid #6366f1; padding-left: 14px; margin-bottom: 14px; }
                    h3 { color: #6366f1; font-size: 16px; margin: 20px 0 10px; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
                    h4 { color: #4b5563; font-size: 14px; margin: 16px 0 8px; }
                    ul { margin: 10px 0 16px; padding-left: 22px; } li { margin: 6px 0; }
                    pre { background: #1e1e2e; color: #e6edf3; padding: 14px 18px; border-radius: 8px; font-size: 12px; white-space: pre-wrap; margin: 14px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    code { font-family: 'Consolas','Courier New',monospace; font-size: 12px; background: #f0f3f9; color: #6366f1; padding: 2px 5px; border-radius: 3px; }
                    pre code { background: none; color: inherit; padding: 0; }
                    .code-label { background: #6366f1; color: white; padding: 3px 10px; border-radius: 6px 6px 0 0; font-size: 11px; font-weight: 600; text-transform: uppercase; display: inline-block; }
                    .key-points { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px 18px; margin: 14px 0; }
                    .key-points h4 { color: #6366f1; margin: 0 0 8px; font-size: 13px; text-transform: uppercase; }
                    .toc { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
                    .toc h3 { margin-top: 0; color: #1a1a2e; border-bottom: none; }
                    .toc ul { list-style: none; padding-left: 0; margin-bottom: 0; }
                    .toc li { margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 4px; }
                    .toc a { color: #6366f1; text-decoration: none; font-weight: 500; }
                    .back-to-top { text-align: right; margin-top: 20px; font-size: 13px; }
                    .back-to-top a { color: #6366f1; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; }
                    .back-to-top svg { width: 14px; height: 14px; }
                    .footer { margin-top: 46px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #e0e0e0; padding-top: 16px; }
                    @page { size: A4; margin: 20mm; }
                    @media print { body { padding: 0; font-size: 11pt; } .section { page-break-inside: avoid; } .toc { page-break-after: always; } h1,h2,h3,h4 { page-break-after: avoid; } pre { background: #f6f8fa !important; color: #24292f !important; } a { text-decoration: none; color: inherit; } }
                </style></head><body id="top">
                <h1>${fullMaterial.name || fullMaterial.topic}</h1>
                <div class="meta">
                    <span class="meta-item"><strong>Topic:</strong> ${fullMaterial.topic}</span>
                    <span class="meta-item"><strong>Mode:</strong> ${fullMaterial.mode}</span>
                    ${fullMaterial.metadata?.wordCount ? `<span class="meta-item"><strong>Words:</strong> ${fullMaterial.metadata.wordCount}</span>` : ''}
                </div>
                ${fullMaterial.sections?.length > 0 ? `
                <div class="toc">
                    <h3>Table of Contents</h3>
                    <ul>
                        ${fullMaterial.sections.map((section, idx) => `<li><a href="#section-${idx}">${idx + 1}. ${section.title}</a></li>`).join('')}
                    </ul>
                </div>` : ''}
                ${fullMaterial.sections?.length > 0
                    ? fullMaterial.sections.map((section, idx) => `
                        <div class="section" id="section-${idx}">
                            <div class="section-header"><h2>${idx + 1}. ${section.title}</h2></div>
                            <div class="section-body">
                                ${section.overview ? `<div class="overview">${section.overview}</div>` : ''}
                                ${formatContentForPDF(section.content)}
                                ${section.keyPoints?.length > 0 ? `<div class="key-points"><h4>Key Points</h4><ul>${section.keyPoints.map(p => `<li>${p}</li>`).join('')}</ul></div>` : ''}
                                <div class="back-to-top"><a href="#top"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"></path></svg>Back to Top</a></div>
                            </div>
                        </div>`).join('')
                    : `<div>${formatContentForPDF(fullMaterial.content)}</div>`
                }
                <div class="footer">Generated by LearnAI &mdash; Digital Learning Platform &bull; ${new Date().toLocaleDateString()}</div>
                </body></html>`;

            const win = window.open('', '_blank');
            win.document.write(printContent);
            win.document.close();
            win.print();
        } catch (err) {
            console.error('Failed to fetch material for PDF:', err);
            alert('Could not generate PDF. Please try again.');
        }
    };

    if (loading) return <div className="loading">Loading your library...</div>;

    return (
        <div className="saved-materials-page">
            <div className="page-header">
                <div className="page-header-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cameFromDashboard && (
                            <a className="back-chevron" onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </a>
                        )}
                        <h1 style={{ margin: 0, width: 'auto', textAlign: 'left' }}>Saved Materials</h1>
                    </div>
                    <Link to={ROUTES.STUDENT.STUDY_MATERIAL} className="btn-primary" style={{ width: '160px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <PlusIcon /> New Material
                    </Link>
                </div>
            </div>

            <div className="filters-bar">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                    <button
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                        onClick={() => setShowCombineModal(true)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m8 6 4-4 4 4" /><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22" /><path d="m20 22-5-5" />
                        </svg>
                        Combine
                    </button>
                    <div className="search-box" style={{ flexGrow: 1, marginBottom: 0 }}>
                        <span className="search-icon"><SearchIcon /></span>
                        <input
                            type="text"
                            placeholder="Search topics..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <button
                    className={`filter-btn${activeFilterCount > 0 ? " filter-btn--active" : ""}`}
                    onClick={() => setShowFilterModal(true)}
                >
                    <FilterIcon />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                        <span className="filter-badge">{activeFilterCount}</span>
                    )}
                </button>
            </div>

            {/* Active filter pills - quick glance */}
            {activeFilterCount > 0 && (
                <div className="active-filters-bar">
                    {filterSyllabi.map(id => {
                        const s = uniqueSyllabi.find(s => s.id === id);
                        return s ? (
                            <span key={id} className="active-filter-pill" onClick={() => toggleFilterSyllabus(id)}>
                                {s.name} <XIcon />
                            </span>
                        ) : null;
                    })}
                    {filterModes.map(mode => (
                        <span key={mode} className="active-filter-pill" onClick={() => toggleFilterMode(mode)}>
                            {mode} <XIcon />
                        </span>
                    ))}
                    {filterDateRange !== "all" && (
                        <span className="active-filter-pill" onClick={() => setFilterDateRange("all")}>
                            Last {filterDateRange} days <XIcon />
                        </span>
                    )}
                    <button className="clear-filters-link" onClick={clearAllFilters}>Clear all</button>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {filteredMaterials.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon"><BookIcon /></div>
                    <h3>No materials found</h3>
                    <p>{searchTerm || activeFilterCount > 0 ? "Try adjusting your search or filters" : "Generate your first study material to see it here"}</p>
                    {!searchTerm && activeFilterCount === 0 && (
                        <Link to={ROUTES.STUDENT.STUDY_MATERIAL} className="cta-btn">
                            Generate Material
                        </Link>
                    )}
                </div>
            ) : (
                <div className="materials-grouped">
                    {groupedMaterials.map(group => (
                        <div key={group.name} className="syllabus-group">
                            <div className="syllabus-group__header">
                                <BookIcon />
                                <h2>{group.name}</h2>
                                <span className="syllabus-group__count">{group.items.length} material{group.items.length !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="materials-grid">
                                {group.items.map((material) => (
                                    <div
                                        className="material-card refined"
                                        key={material._id}
                                        onClick={() => window.open(`/student/view-material/${material._id}`, '_blank')}
                                    >
                                        <div className="card-top">
                                            <span className={`mode-tag ${material.mode}`}>{material.mode}</span>
                                            <button
                                                className="delete-btn-icon"
                                                onClick={(e) => handleDeleteClick(e, material._id)}
                                                title="Delete Material"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>

                                        <div className="card-main">
                                            <div className="material-icon-wrapper">
                                                <BookIcon />
                                            </div>
                                            <div className="material-info">
                                                <h3>{material.name || material.topic}</h3>
                                                <p className="topic-name">{material.topic}</p>
                                            </div>
                                        </div>

                                        <div className="card-footer">
                                            <div className="meta-item">
                                                <CalendarIcon />
                                                <span>{formatDate(material.createdAt)}</span>
                                            </div>
                                            <button
                                                className="download-btn-icon"
                                                onClick={(e) => handleDownloadPDF(e, material)}
                                                title="Download as PDF"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter Modal */}
            {showFilterModal && (
                <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
                    <div className="modal-content filter-modal" onClick={e => e.stopPropagation()}>
                        <div className="filter-modal__header">
                            <h2>Filter Materials</h2>
                            <button className="filter-modal__close" onClick={() => setShowFilterModal(false)}>
                                <XIcon />
                            </button>
                        </div>

                        {/* Syllabus filter */}
                        <div className="filter-section">
                            <h4 className="filter-section__title">
                                <BookIcon /> Syllabus
                            </h4>
                            <div className="filter-chips">
                                {uniqueSyllabi.map(s => (
                                    <button
                                        key={s.id}
                                        className={`filter-chip${filterSyllabi.includes(s.id) ? " filter-chip--selected" : ""}`}
                                        onClick={() => toggleFilterSyllabus(s.id)}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                                {uniqueSyllabi.length === 0 && (
                                    <span className="filter-section__empty">No syllabi found</span>
                                )}
                            </div>
                        </div>

                        {/* Mode filter */}
                        <div className="filter-section">
                            <h4 className="filter-section__title">
                                <FileTextIcon /> Mode
                            </h4>
                            <div className="filter-chips">
                                {["short", "intermediate", "pro", "combined"].map(mode => (
                                    <button
                                        key={mode}
                                        className={`filter-chip filter-chip--mode-${mode}${filterModes.includes(mode) ? " filter-chip--selected" : ""}`}
                                        onClick={() => toggleFilterMode(mode)}
                                    >
                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date filter */}
                        <div className="filter-section">
                            <h4 className="filter-section__title">
                                <CalendarIcon /> Date Range
                            </h4>
                            <div className="filter-chips">
                                {[
                                    { value: "7", label: "Last 7 Days" },
                                    { value: "30", label: "Last 30 Days" },
                                    { value: "90", label: "Last 90 Days" },
                                    { value: "all", label: "All Time" },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`filter-chip${filterDateRange === opt.value ? " filter-chip--selected" : ""}`}
                                        onClick={() => setFilterDateRange(opt.value)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="filter-modal__footer">
                            <button className="btn-secondary" onClick={clearAllFilters}>
                                Clear All
                            </button>
                            <button className="btn-primary" onClick={() => setShowFilterModal(false)}>
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {deleteModal.show && (
                <div className="modal-overlay" onClick={() => setDeleteModal({ show: false, materialId: null })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>Delete Material</h2>
                        <p>Are you sure you want to delete this study material? This action cannot be undone.</p>
                        <div className="modal-actions" style={{ marginTop: '16px' }}>
                            <button
                                className="btn-secondary"
                                onClick={() => setDeleteModal({ show: false, materialId: null })}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                style={{ background: '#ef4444', borderColor: '#ef4444' }}
                                onClick={confirmDelete}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Combine Modal */}
            {showCombineModal && (
                <div className="modal-overlay" onClick={() => !isCombining && setShowCombineModal(false)}>
                    <div className="modal-content combine-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                        <div className="filter-modal__header">
                            <h2>Combine Study Materials</h2>
                            <button className="filter-modal__close" onClick={() => !isCombining && setShowCombineModal(false)} disabled={isCombining}>
                                <XIcon />
                            </button>
                        </div>

                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label>Name for Combined Material</label>
                            <input
                                type="text"
                                placeholder="e.g. Midterm Comprehensive Syllabus"
                                value={combineName}
                                onChange={(e) => setCombineName(e.target.value)}
                                disabled={isCombining}
                            />
                        </div>

                        <div className="combine-selection-list" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '10px', marginBottom: '20px' }}>
                            {groupedMaterials.map(group => (
                                <div key={group.name} style={{ marginBottom: '16px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                                        {group.name}
                                    </h4>
                                    {group.items.map(material => (
                                        <div
                                            key={material._id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '8px',
                                                borderRadius: '8px',
                                                background: combineSelections.includes(material._id) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                                cursor: isCombining ? 'not-allowed' : 'pointer'
                                            }}
                                            onClick={() => !isCombining && toggleCombineSelection(material._id)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={combineSelections.includes(material._id)}
                                                onChange={() => !isCombining && toggleCombineSelection(material._id)}
                                                disabled={isCombining}
                                                style={{ width: '18px', height: '18px', cursor: 'inherit' }}
                                                onClick={e => e.stopPropagation()}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: '500', color: 'var(--text-heading)', fontSize: '14px' }}>
                                                    {material.name || material.topic}
                                                </span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    Mode: <span style={{ textTransform: 'capitalize' }}>{material.mode}</span> | Words: {material.metadata?.wordCount || 0}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        <div className="filter-modal__footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                                {combineSelections.length} material(s) selected
                            </span>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setShowCombineModal(false)}
                                    disabled={isCombining}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={handleCombineMaterials}
                                    disabled={isCombining || combineSelections.length < 2 || !combineName.trim()}
                                >
                                    {isCombining ? (
                                        <>
                                            <svg className="spinner" viewBox="0 0 50 50" style={{ width: '18px', height: '18px', animation: 'rotate 2s linear infinite' }}>
                                                <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5" stroke="currentColor" strokeLinecap="round" style={{ animation: 'dash 1.5s ease-in-out infinite' }}></circle>
                                            </svg>
                                            Merging...
                                        </>
                                    ) : 'Merge'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
