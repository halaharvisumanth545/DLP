import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";
import "./StudentComponents.css";

let mermaidReady = false;

function ensureMermaid() {
    if (mermaidReady) {
        return;
    }

    mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "loose",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        flowchart: {
            curve: "basis",
            useMaxWidth: true,
            htmlLabels: false,
            nodeSpacing: 28,
            rankSpacing: 42,
            padding: 10,
        },
        themeVariables: {
            primaryColor: "#dff2e4",
            primaryTextColor: "#153c2f",
            primaryBorderColor: "#3d7a61",
            lineColor: "#2f5f6d",
            secondaryColor: "#f3ead6",
            tertiaryColor: "#edf3f7",
            mainBkg: "#ffffff",
            clusterBkg: "#f8fbfc",
            clusterBorder: "#b8cad1",
            nodeBorder: "#3d7a61",
            fontSize: "18px",
        },
    });

    mermaidReady = true;
}

function sanitizeFilename(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseSvgDimensions(svgElement) {
    const viewBox = svgElement.getAttribute("viewBox");
    if (viewBox) {
        const [, , width, height] = viewBox.split(/\s+/).map(Number);
        if (width && height) {
            return { width, height };
        }
    }

    const width = Number.parseFloat(svgElement.getAttribute("width") || "");
    const height = Number.parseFloat(svgElement.getAttribute("height") || "");
    return {
        width: width || 1600,
        height: height || 900,
    };
}

function triggerDownload(href, filename) {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
        anchor.remove();
    }, 0);
}

function normalizeSvgMarkup(svgMarkup) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
    const svg = doc.documentElement;
    const { width, height } = parseSvgDimensions(svg);

    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    const serialized = new XMLSerializer().serializeToString(svg);
    return { serialized, width, height };
}

function svgToDataUrl(svgMarkup) {
    const { serialized } = normalizeSvgMarkup(svgMarkup);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
}

function downloadSvg(svgMarkup, filename) {
    triggerDownload(svgToDataUrl(svgMarkup), filename);
}

async function downloadPngFromSvg(svgMarkup, filename) {
    const { width, height } = normalizeSvgMarkup(svgMarkup);
    const url = svgToDataUrl(svgMarkup);

    const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load SVG for PNG export."));
        img.src = url;
    });

    const scale = 2.5;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas export is not available in this browser.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    try {
        triggerDownload(canvas.toDataURL("image/png"), filename);
    } catch {
        const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
        if (!pngBlob) {
            throw new Error("Failed to create PNG export.");
        }
        const objectUrl = URL.createObjectURL(pngBlob);
        triggerDownload(objectUrl, filename);
        window.setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
        }, 1000);
    }
}

function MermaidDiagram({ code, title }) {
    const containerRef = useRef(null);
    const diagramId = useId().replace(/:/g, "-");
    const [renderError, setRenderError] = useState("");
    const [exportError, setExportError] = useState("");
    const [svgMarkup, setSvgMarkup] = useState("");
    const [exporting, setExporting] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function renderDiagram() {
            try {
                ensureMermaid();
                const { svg, bindFunctions } = await mermaid.render(`diagram-${diagramId}`, code);
                if (cancelled || !containerRef.current) {
                    return;
                }

                containerRef.current.innerHTML = svg;
                const renderedSvg = containerRef.current.querySelector("svg");
                if (renderedSvg) {
                    renderedSvg.setAttribute("width", "100%");
                    renderedSvg.setAttribute("height", "100%");
                    renderedSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
                    renderedSvg.style.width = "100%";
                    renderedSvg.style.height = "100%";
                }

                bindFunctions?.(containerRef.current);
                setSvgMarkup(containerRef.current.innerHTML);
                setRenderError("");
                setExportError("");
            } catch (renderError) {
                if (!cancelled) {
                    setRenderError(renderError?.message || "Failed to render Mermaid diagram.");
                }
            }
        }

        renderDiagram();

        return () => {
            cancelled = true;
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
        };
    }, [code, diagramId]);

    async function handleSvgDownload() {
        if (!svgMarkup) {
            return;
        }
        setExportError("");
        setExporting("svg");
        try {
            downloadSvg(svgMarkup, `${sanitizeFilename(title)}.svg`);
        } finally {
            setExporting("");
        }
    }

    async function handlePngDownload() {
        if (!svgMarkup) {
            return;
        }
        setExportError("");
        setExporting("png");
        try {
            await downloadPngFromSvg(svgMarkup, `${sanitizeFilename(title)}.png`);
        } catch (downloadError) {
            setExportError(downloadError?.message || "Failed to export PNG.");
        } finally {
            setExporting("");
        }
    }

    if (renderError) {
        return (
            <div className="architecture-diagram architecture-diagram--error">
                <strong>{title}</strong>
                <p>{renderError}</p>
                <pre>{code}</pre>
            </div>
        );
    }

    return (
        <div className="architecture-diagram">
            <div className="architecture-diagram__toolbar">
                <span className="architecture-diagram__ratio">Slide Fit: 16:9</span>
                <div className="architecture-diagram__actions">
                    <button
                        type="button"
                        className="architecture-btn architecture-btn--secondary"
                        onClick={handleSvgDownload}
                        disabled={!svgMarkup || exporting !== ""}
                    >
                        {exporting === "svg" ? "Exporting..." : "Download SVG"}
                    </button>
                    <button
                        type="button"
                        className="architecture-btn"
                        onClick={handlePngDownload}
                        disabled={!svgMarkup || exporting !== ""}
                    >
                        {exporting === "png" ? "Exporting..." : "Download PNG"}
                    </button>
                </div>
            </div>
            {exportError ? <p className="architecture-diagram__export-error">{exportError}</p> : null}
            <div className="architecture-diagram__frame">
                <div ref={containerRef} className="architecture-diagram__canvas" />
            </div>
        </div>
    );
}

const diagrams = [
    {
        id: "system",
        title: "System Architecture",
        description:
            "A compact 16:9 view of the platform, showing the client, API, core data stores, retrieval stack, and generation outputs.",
        code: `
flowchart LR
    subgraph Client["Client"]
        UI["React App"]
    end

    subgraph API["Backend API"]
        Node["Express + Services"]
    end

    subgraph Data["Core Stores"]
        Mongo["MongoDB"]
        Pinecone["Pinecone"]
    end

    subgraph Retrieval["Retrieval Stack"]
        Retrieve["Embed + Search"]
        Rank["Re-rank + Adaptive Top-K"]
    end

    subgraph Output["Learning Output"]
        Material["Study Material"]
        Questions["Questions + Sessions"]
        Analytics["Analytics"]
    end

    UI --> Node
    Node --> Mongo
    Node --> Pinecone
    Pinecone --> Retrieve --> Rank
    Rank --> Material
    Rank --> Questions
    Questions --> Analytics
    Material --> Analytics
        `,
    },
    {
        id: "material-generation",
        title: "Material Generation Flow",
        description:
            "The study material pipeline retrieves only the most useful evidence, then sends a compact grounded context into OpenAI generation.",
        code: `
flowchart TB
    subgraph TopRow[" "]
        direction LR
        A["Student Request"] --> B["Validate Topic + Mode"] --> C["Pinecone Retrieval"] --> D["Re-rank"] --> E["Adaptive Top-K"]
    end

    subgraph BottomRow[" "]
        direction RL
        F["Cluster Diversity"] --> G["Grounded Context"] --> H["OpenAI Generation"] --> I["Material UI / Save"]
    end

    E --> F

    style TopRow fill:transparent,stroke:transparent
    style BottomRow fill:transparent,stroke:transparent
        `,
    },
    {
        id: "question-generation",
        title: "Question Generation Flow",
        description:
            "The question pipeline first reuses stored questions where possible, and only falls back to grounded generation when the database cannot satisfy the request.",
        code: `
flowchart LR
    A["Session Request"] --> B["Check Stored Questions"]
    B --> C{"Enough Coverage?"}
    C -- Yes --> D["Serve Questions"]
    C -- No --> E["Retrieve Topic Context"]
    E --> F["Re-rank + Adaptive Top-K"]
    F --> G["Generate Questions"]
    G --> H["Store in MongoDB"]
    H --> D
    D --> I["Session Result + Analytics"]
        `,
    },
];

const capabilityCards = [
    {
        title: "Clustering",
        body: "Groups related chunks into concept-level buckets so retrieval stays aligned with the intended topic instead of overfitting to one passage.",
    },
    {
        title: "Re-ranking",
        body: "Reorders Pinecone candidates with a stronger relevance model, improving the quality of the evidence passed into the generation prompt.",
    },
    {
        title: "Adaptive Top-K",
        body: "Stops retrieval when relevance drops, which keeps context compact, prevents weak tail chunks, and improves prompt density.",
    },
    {
        title: "Slide-ready Diagrams",
        body: "Each Mermaid chart is compacted to fit a 16:9 presentation frame and can now be exported as a crisp SVG or high-resolution PNG.",
    },
];

export default function SystemArchitecture() {
    return (
        <div className="architecture-page">
            <div className="page-header">
                <h1>System Architecture</h1>
                <p>
                    A presentation-ready map of the Digital Learning Platform, showing the overall
                    system design and the two core generation workflows in a compact 16:9 format.
                </p>
            </div>

            <section className="architecture-hero dashboard-section">
                <div className="architecture-hero__copy">
                    <span className="architecture-pill">Presentation View</span>
                    <h2>Compact architecture for documentation and slides</h2>
                    <p>
                        These diagrams are intentionally shortened and consolidated so they fit a
                        16:9 presentation canvas cleanly. You can export each flowchart as an SVG
                        for infinite clarity or as a high-resolution PNG for slide decks.
                    </p>
                </div>

                <div className="architecture-summary-grid">
                    {capabilityCards.map((card) => (
                        <article key={card.title} className="architecture-summary-card">
                            <h3>{card.title}</h3>
                            <p>{card.body}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="architecture-diagram-grid">
                {diagrams.map((diagram) => (
                    <article key={diagram.id} className="architecture-diagram-card dashboard-section">
                        <div className="architecture-diagram-card__header">
                            <div>
                                <h2>{diagram.title}</h2>
                                <p>{diagram.description}</p>
                            </div>
                            <span className="architecture-pill architecture-pill--soft">
                                Mermaid
                            </span>
                        </div>

                        <MermaidDiagram code={diagram.code} title={diagram.title} />
                    </article>
                ))}
            </section>
        </div>
    );
}
