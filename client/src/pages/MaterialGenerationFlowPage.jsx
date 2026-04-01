import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

let mermaidReady = false;

function ensureMermaid() {
    if (mermaidReady) {
        return;
    }

    mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "base",
        fontFamily: "IBM Plex Sans, Avenir Next, Segoe UI, sans-serif",
        flowchart: {
            curve: "basis",
            useMaxWidth: true,
            nodeSpacing: 22,
            rankSpacing: 34,
            padding: 8,
        },
        sequence: {
            useMaxWidth: true,
            wrap: true,
        },
        themeVariables: {
            primaryColor: "#f8f0d9",
            primaryBorderColor: "#a37019",
            primaryTextColor: "#34260d",
            secondaryColor: "#dbeef3",
            tertiaryColor: "#eef6f8",
            lineColor: "#365f6b",
            fontSize: "14px",
            clusterBkg: "#f7fafb",
            clusterBorder: "#aec7cf",
        },
    });

    mermaidReady = true;
}

function MermaidDiagram({ title, code }) {
    const ref = useRef(null);
    const id = useId().replace(/:/g, "-");
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function render() {
            try {
                ensureMermaid();
                const { svg, bindFunctions } = await mermaid.render(`material-flow-${id}`, code);
                if (cancelled || !ref.current) {
                    return;
                }

                ref.current.innerHTML = svg;
                const renderedSvg = ref.current.querySelector("svg");
                if (renderedSvg) {
                    renderedSvg.setAttribute("width", "100%");
                    renderedSvg.setAttribute("height", "100%");
                    renderedSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
                    renderedSvg.style.width = "100%";
                    renderedSvg.style.height = "100%";
                }
                bindFunctions?.(ref.current);
                setError("");
            } catch (diagramError) {
                if (!cancelled) {
                    setError(diagramError?.message || "Failed to render Mermaid diagram.");
                }
            }
        }

        render();

        return () => {
            cancelled = true;
            if (ref.current) {
                ref.current.innerHTML = "";
            }
        };
    }, [code, id]);

    return (
        <section className="mgf-diagram-card">
            <div className="mgf-diagram-card__header">
                <h3>{title}</h3>
                <p>Rendered from Mermaid in a standalone Vite entry page.</p>
            </div>

            {error ? (
                <div className="mgf-diagram-card__error">
                    <p>{error}</p>
                    <pre>{code}</pre>
                </div>
            ) : (
                <div ref={ref} className="mgf-diagram-card__canvas" />
            )}
        </section>
    );
}

function CodeBlock({ title, data }) {
    return (
        <section className="mgf-code-block">
            <div className="mgf-code-block__header">
                <h3>{title}</h3>
            </div>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </section>
    );
}

function StageCard({ phase, title, description, inputs, transforms, outputs, codeRefs }) {
    return (
        <article className="mgf-stage-card">
            <div className="mgf-stage-card__phase">{phase}</div>
            <h3>{title}</h3>
            <p>{description}</p>

            <div className="mgf-stage-card__grid">
                <div>
                    <h4>Input</h4>
                    <p>{inputs}</p>
                </div>
                <div>
                    <h4>Transformation</h4>
                    <p>{transforms}</p>
                </div>
                <div>
                    <h4>Output</h4>
                    <p>{outputs}</p>
                </div>
            </div>

            <p className="mgf-stage-card__refs">
                Code path: <code>{codeRefs.join(" | ")}</code>
            </p>
        </article>
    );
}

const example = {
    syllabusName: "DBMS Semester 4",
    topic: "Normalization",
    subtopic: "Third Normal Form (3NF)",
    mode: "intermediate",
    ragQuery: "Normalization - Third Normal Form (3NF)",
};

const requestPayload = {
    syllabusId: "67fb8195e11fd0c7f6d70c12",
    topic: "Normalization",
    subtopics: ["Third Normal Form (3NF)"],
    mode: "intermediate",
};

const storedVectorMetadata = {
    documentId: "1A2B3C4D5E6F7G8H9I",
    documentTitle: "DBMS Unit 2 Notes",
    sourceUrl: "https://docs.google.com/document/d/1A2B3C4D5E6F7G8H9I/edit",
    userId: "67fa11d9a1202ac0902d1b44",
    syllabusId: "67fb8195e11fd0c7f6d70c12",
    chunkIndex: 14,
    sectionChunkIndex: 2,
    sectionIndex: 4,
    sectionTitle: "Third Normal Form (3NF)",
    sectionPath: "Normalization > Third Normal Form (3NF)",
    sectionLevel: 2,
    clusterId: "normalization-third-normal-form",
    clusterLabel: "Normalization > Third Normal Form (3NF)",
    clusterStrategy: "semantic-nearest-centroid",
    clusterRank: 1,
    text: "Third Normal Form removes transitive dependency from a relation. A table is in 3NF if it is already in 2NF and every non-key attribute depends only on the candidate key, the whole candidate key, and nothing but the candidate key. Example: STUDENT(student_id, department_id, department_name). Since department_name depends on department_id and not directly on student_id, it should be moved into a separate DEPARTMENT table.",
    embeddingModel: "text-embedding-3-small",
    embeddingDim: 1536,
    sourceType: "google-doc",
};

const retrievedChunk = {
    text: "Third Normal Form removes transitive dependency from a relation. A table is in 3NF if it is already in 2NF and every non-key attribute depends only on the candidate key, the whole candidate key, and nothing but the candidate key. Example: STUDENT(student_id, department_id, department_name). Since department_name depends on department_id and not directly on student_id, it should be moved into a separate DEPARTMENT table.",
    score: 0.9132,
    retrievalScore: 0.8427,
    rerankScore: 2.3551,
    fileName: "DBMS Unit 2 Notes",
    documentTitle: "DBMS Unit 2 Notes",
    sourceUrl: "https://docs.google.com/document/d/1A2B3C4D5E6F7G8H9I/edit",
    pageEstimate: 7,
    textbookId: null,
    documentId: "1A2B3C4D5E6F7G8H9I",
    chunkIndex: 14,
    clusterId: "normalization-third-normal-form",
    clusterLabel: "Normalization > Third Normal Form (3NF)",
    sectionTitle: "Third Normal Form (3NF)",
    sectionPath: ["Normalization", "Third Normal Form (3NF)"],
};

const materialResponse = {
    material: {
        topic: "Normalization - Third Normal Form (3NF)",
        mode: "intermediate",
        subtopicsCount: 1,
        successCount: 1,
        codeTopicsCount: 0,
        content: "Third Normal Form (3NF) is the stage of normalization in which transitive dependency is removed. It keeps each fact stored in exactly one logical place and reduces update anomalies.## Definition\nA relation is in 3NF when it is already in 2NF and no non-key attribute depends on another non-key attribute.\n## Why It Matters\nThis prevents hidden duplication and makes insert, update, and delete operations safer.\n## Example\nInstead of keeping department_name inside STUDENT, create DEPARTMENT(department_id, department_name) and keep only department_id inside STUDENT.",
        sections: [
            {
                title: "Third Normal Form (3NF)",
                overview: "Third Normal Form refines a schema by removing attributes that depend on other non-key attributes rather than directly on the candidate key.",
                content: "## Definition\nThird Normal Form removes transitive dependency from a relation.\n\n## Working Logic\nIf a non-key attribute determines another non-key attribute, split the relation so the dependency is represented in its own table.\n\n## Concrete Example\n`STUDENT(student_id, department_id, department_name)` violates 3NF because `department_name` depends on `department_id`, not directly on `student_id`.\n\n## Refactored Design\nMove department data into `DEPARTMENT(department_id, department_name)` and store only `department_id` in `STUDENT`.",
                keyPoints: [
                    "3NF removes transitive dependency.",
                    "Each non-key attribute should depend on the key, the whole key, and nothing but the key.",
                    "Schema decomposition improves consistency and reduces anomalies.",
                ],
                examples: [
                    "Split STUDENT and DEPARTMENT when department_name depends on department_id.",
                ],
                isCodeIntensive: false,
            },
        ],
        createdAt: "2026-03-28T10:45:00.000Z",
    },
};

const persistedMaterial = {
    userId: "67fa11d9a1202ac0902d1b44",
    syllabusId: "67fb8195e11fd0c7f6d70c12",
    topic: "Normalization - Third Normal Form (3NF)",
    name: "Normalization - Third Normal Form (3NF) - Intermediate - Mar 28, 2026",
    mode: "intermediate",
    content: materialResponse.material.content,
    sections: materialResponse.material.sections,
    metadata: {
        wordCount: 128,
        estimatedReadTime: 1,
    },
};

const endToEndFlow = String.raw`
flowchart TB
    subgraph topRow[ ]
        direction LR
        A[Upload syllabus] --> B[Extract topic map]
        B --> C[Select subtopic and mode]
        C --> D[Send generation request]
    end

    subgraph rightCol[ ]
        direction TB
        E[Retrieve and trim context] --> F[Build prompt by mode]
        F --> G[Generate structured material]
        G --> H[Render study note]
        H --> I[Optional save for reuse]
    end

    D --> E

    style topRow fill:none,stroke:none
    style rightCol fill:none,stroke:none
`;

const retrievalFlow = String.raw`
sequenceDiagram
    participant UI as StudyMaterial
    participant API as Controller
    participant RAG as RAG Service
    participant AI as OpenAI

    UI->>API: request material
    API->>RAG: retrieveRelevantChunks(query)
    RAG->>AI: embed query
    AI-->>RAG: vector
    RAG-->>API: top grounded chunks
    API->>AI: prompt + context + schema
    AI-->>API: structured sections
    API-->>UI: material response
`;

const stages = [
    {
        phase: "Phase 1",
        title: "Syllabus text becomes a structured syllabus",
        description: "The process usually starts before material generation. The student uploads a PDF, DOCX, or text syllabus. The frontend extracts raw text in the browser, then the backend stores that text as a Syllabus record and asks OpenAI to extract topics and subtopics.",
        inputs: "Raw syllabus text such as a DBMS unit outline.",
        transforms: "File content becomes plain text, then plain text becomes a MongoDB syllabus document with topics[] and subtopics[].",
        outputs: 'A Syllabus document containing entries like "Normalization" -> ["First Normal Form", "Second Normal Form", "Third Normal Form (3NF)"]',
        codeRefs: [
            "client/src/components/student/UploadSyllabus.jsx",
            "server/controllers/contentController.js",
            "server/utils/topicExtractor.js",
            "server/models/Syllabus.js",
        ],
    },
    {
        phase: "Phase 2",
        title: "The user chooses one subtopic and one mode",
        description: "The current UI only allows one subtopic at a time. That constraint is important because the backend route explicitly rejects topic-wide or multi-subtopic generation.",
        inputs: 'Selected syllabus, selected topic "Normalization", selected subtopic "Third Normal Form (3NF)", and mode "intermediate".',
        transforms: "The browser builds a narrow request payload and sends it to the OpenAI route.",
        outputs: "A POST body with syllabusId, topic, subtopics[1], and mode.",
        codeRefs: [
            "client/src/components/student/StudyMaterial.jsx",
            "client/src/services/openai.js",
            "server/controllers/openaiController.js",
        ],
    },
    {
        phase: "Phase 3",
        title: "The backend enriches the topic with retrieval context",
        description: "The server forms a RAG query from topic + subtopic, embeds it with OpenAI, asks Pinecone for matching chunks, optionally reranks them, then selects the best grounded context snippets.",
        inputs: 'Query string "Normalization - Third Normal Form (3NF)" plus userId and syllabusId filters.',
        transforms: "Query text becomes an embedding vector, then a candidate chunk list, then a reranked shortlist with normalized scores and cluster diversity applied.",
        outputs: "A compact set of chunks ready to be injected into the generation prompt.",
        codeRefs: [
            "server/services/ragService.js",
            "server/services/materialLoadService.js",
            "server/langgraph/material_load_graph.py",
        ],
    },
    {
        phase: "Phase 4",
        title: "OpenAI converts context into a sectioned study material response",
        description: "The controller builds a strict prompt and JSON shape. For non-code topics, it asks for title, overview, content, keyPoints, and examples. The response is validated and assembled into a single material object.",
        inputs: "Selected topic, retrieved textbook/document excerpts, mode-specific prompt rules, and JSON schema expectations.",
        transforms: "Loose retrieved text becomes structured pedagogical content.",
        outputs: "material.topic, material.content, material.sections, counts, and createdAt.",
        codeRefs: [
            "server/controllers/openaiController.js",
            "server/config/openai.js",
        ],
    },
    {
        phase: "Phase 5",
        title: "The frontend renders sections, not just one giant string",
        description: "The response is placed in local component state. The main student view renders each section with ReactMarkdown, math support, and code/table formatting helpers. The user can then optionally persist the result.",
        inputs: "The material object returned by the OpenAI route.",
        transforms: "JSON becomes interactive React UI, then optionally becomes a StudyMaterial document after Save to Library.",
        outputs: "Final study material page in the browser, and optionally a saved StudyMaterial record in MongoDB.",
        codeRefs: [
            "client/src/components/student/StudyMaterial.jsx",
            "client/src/components/student/ViewMaterial.jsx",
            "server/controllers/contentController.js",
            "server/models/StudyMaterial.js",
        ],
    },
];

export default function MaterialGenerationFlowPage() {
    const pageRef = useRef(null);
    const [downloading, setDownloading] = useState(false);

    function collectDocumentStyles() {
        const cssChunks = [];

        for (const sheet of Array.from(document.styleSheets)) {
            try {
                const rules = Array.from(sheet.cssRules || []);
                if (rules.length === 0) {
                    continue;
                }
                cssChunks.push(rules.map((rule) => rule.cssText).join("\n"));
            } catch (_error) {
                continue;
            }
        }

        cssChunks.push(`
            html, body {
                background: radial-gradient(circle at top left, rgba(208, 227, 232, 0.9), transparent 35%), radial-gradient(circle at top right, rgba(248, 233, 201, 0.9), transparent 33%), linear-gradient(180deg, #f4f8f8 0%, #fcfaf4 100%);
            }

            @page {
                size: A4;
                margin: 14mm;
            }

            @media print {
                body {
                    background: #ffffff !important;
                }

                .mgf-page {
                    width: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                .mgf-hero,
                .mgf-callout,
                .mgf-section,
                .mgf-footer-note,
                .mgf-code-block,
                .mgf-diagram-card,
                .mgf-stage-card,
                .mgf-transform-card,
                .mgf-final-preview__paper {
                    box-shadow: none !important;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
            }
        `);

        return cssChunks.join("\n\n");
    }

    function sanitizeExportDom(node) {
        const clone = node.cloneNode(true);

        clone.querySelectorAll("[data-export-ignore='true']").forEach((element) => {
            element.remove();
        });

        clone.querySelectorAll("svg").forEach((svg) => {
            svg.setAttribute("width", "100%");
            svg.setAttribute("height", "100%");
            svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
            svg.style.width = "100%";
            svg.style.height = "100%";
        });

        return clone;
    }

    function buildPrintableHtml(contentHtml, stylesText) {
        return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DLP Material Generation Flow PDF Export</title>
    <style>${stylesText}</style>
    <style>
      html, body {
        background: #ffffff !important;
      }

      body {
        margin: 0;
      }
    </style>
  </head>
  <body>
    ${contentHtml}
    <script>
      (function () {
        function wait(ms) {
          return new Promise(function (resolve) {
            setTimeout(resolve, ms);
          });
        }

        async function printWhenReady() {
          try {
            if (document.fonts && document.fonts.ready) {
              await document.fonts.ready;
            }
            await wait(350);
            window.focus();
            window.print();
          } catch (_error) {
            window.print();
          }
        }

        window.addEventListener("load", printWhenReady, { once: true });
        window.addEventListener("afterprint", function () {
          window.close();
        });
      })();
    </script>
  </body>
</html>`;
    }

    function printViaIframe(html) {
        const iframe = document.createElement("iframe");
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.opacity = "0";
        iframe.style.pointerEvents = "none";

        const cleanup = () => {
            window.setTimeout(() => {
                iframe.remove();
            }, 1000);
        };

        iframe.onload = async () => {
            try {
                const frameWindow = iframe.contentWindow;
                const frameDocument = iframe.contentDocument;

                if (!frameWindow || !frameDocument) {
                    throw new Error("Printable frame was not available.");
                }

                if (frameDocument.fonts && frameDocument.fonts.ready) {
                    await frameDocument.fonts.ready;
                }

                await new Promise((resolve) => window.setTimeout(resolve, 400));

                frameWindow.focus();
                frameWindow.print();

                if ("onafterprint" in frameWindow) {
                    frameWindow.addEventListener("afterprint", cleanup, { once: true });
                } else {
                    cleanup();
                }
            } catch (error) {
                cleanup();
                throw error;
            }
        };

        document.body.appendChild(iframe);
        iframe.srcdoc = html;
    }

    function handleExportPdf() {
        if (!pageRef.current) {
            return;
        }

        setDownloading(true);

        try {
            const cleaned = sanitizeExportDom(pageRef.current);
            const stylesText = collectDocumentStyles();
            const printableHtml = buildPrintableHtml(cleaned.outerHTML, stylesText);
            printViaIframe(printableHtml);
        } catch (error) {
            console.error("PDF export failed:", error);
            window.alert(error?.message || "Failed to prepare the PDF export.");
        } finally {
            window.setTimeout(() => {
                setDownloading(false);
            }, 300);
        }
    }

    return (
        <main ref={pageRef} className="mgf-page">
            <section className="mgf-hero">
                <div className="mgf-hero__eyebrow">DLP Standalone Trace Page</div>
                <div className="mgf-hero__actions" data-export-ignore="true">
                    <button type="button" className="mgf-download-btn" onClick={handleExportPdf}>
                        {downloading ? "Preparing PDF..." : "Export as PDF"}
                    </button>
                </div>
                <h1>How One Study Material Is Generated, Grounded, Shaped, Stored, and Rendered</h1>
                <p className="mgf-hero__lede">
                    This page follows one hypothetical material request through the actual project pipeline, from syllabus parsing to
                    final frontend rendering. The example topic is <strong>{example.topic}</strong>, the chosen subtopic is{" "}
                    <strong>{example.subtopic}</strong>, and the generation mode is <strong>{example.mode}</strong>.
                </p>

                <div className="mgf-summary-grid">
                    <div className="mgf-summary-card">
                        <span className="mgf-summary-card__label">Example Syllabus</span>
                        <strong>{example.syllabusName}</strong>
                    </div>
                    <div className="mgf-summary-card">
                        <span className="mgf-summary-card__label">Material Query</span>
                        <strong>{example.ragQuery}</strong>
                    </div>
                    <div className="mgf-summary-card">
                        <span className="mgf-summary-card__label">Final Render Target</span>
                        <strong>ReactMarkdown sections in the student material view</strong>
                    </div>
                </div>
            </section>

            <section className="mgf-callout">
                <h2>Important behavior in the current codebase</h2>
                <p>
                    The study-material route does <strong>not</strong> auto-save the generated material. It first returns a material
                    object to the browser. Persistence happens only if the user clicks <strong>Save to Library</strong>. Also, RAG
                    grounding is best-effort: retrieval uses <code>failSilently: true</code>, so generation can still continue even if
                    Pinecone or the reranker is unavailable.
                </p>
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>1. End-to-End Flow</h2>
                    <p>
                        This is the complete path from raw syllabus content to final frontend presentation, including the optional save
                        step.
                    </p>
                </div>
                <MermaidDiagram title="End-to-End Material Generation" code={endToEndFlow} />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>2. Stage-by-Stage Explanation</h2>
                    <p>
                        The same topic changes shape multiple times: raw text, structured syllabus, retrieval query, Pinecone chunk,
                        prompt context, sectioned material, and finally rendered UI.
                    </p>
                </div>

                <div className="mgf-stage-list">
                    {stages.map((stage) => (
                        <StageCard key={stage.phase} {...stage} />
                    ))}
                </div>
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>3. The Exact Request Sent for Generation</h2>
                    <p>
                        This is the payload built by the browser when the student asks for one subtopic. The backend rejects multiple
                        subtopics for this route, so the array intentionally contains only one value.
                    </p>
                </div>
                <CodeBlock title="Frontend Request Payload" data={requestPayload} />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>4. Retrieval Pipeline and Chunk Evolution</h2>
                    <p>
                        A chunk is not born inside study-material generation. It is already present in Pinecone because some reference
                        source was ingested earlier, such as a Google Doc through the material-load pipeline. The chunk then gets
                        normalized before it enters the prompt.
                    </p>
                </div>
                <MermaidDiagram title="Retrieval, Reranking, and Prompt Context" code={retrievalFlow} />
            </section>

            <section className="mgf-two-column">
                <CodeBlock title="Stored Pinecone Vector Metadata (Full Ingested Record)" data={storedVectorMetadata} />
                <CodeBlock title="Normalized Retrieved Chunk Used by Generation" data={retrievedChunk} />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>5. What Changed Between Stored Metadata and Retrieved Chunk</h2>
                    <p>
                        The stored record is ingestion-oriented. The retrieved record is generation-oriented. That transformation is what
                        makes the later OpenAI prompt easier to assemble.
                    </p>
                </div>

                <div className="mgf-transform-grid">
                    <article className="mgf-transform-card">
                        <h3>Still present</h3>
                        <p>
                            <code>documentId</code>, <code>documentTitle</code>, <code>sourceUrl</code>, <code>chunkIndex</code>,
                            <code>clusterId</code>, <code>clusterLabel</code>, <code>sectionTitle</code>, and{" "}
                            <code>sectionPath</code> stay conceptually intact.
                        </p>
                    </article>
                    <article className="mgf-transform-card">
                        <h3>Added during retrieval</h3>
                        <p>
                            <code>retrievalScore</code> comes from Pinecone similarity, <code>rerankScore</code> comes from the reranker,
                            and <code>score</code> becomes the normalized score used for ranking in the final shortlist.
                        </p>
                    </article>
                    <article className="mgf-transform-card">
                        <h3>Dropped for generation</h3>
                        <p>
                            Fields such as <code>sectionChunkIndex</code>, <code>clusterStrategy</code>, <code>embeddingModel</code>,
                            and <code>embeddingDim</code> are useful for storage and diagnostics, but are not needed in the final
                            generation payload.
                        </p>
                    </article>
                </div>
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>6. The Material Object Returned to the Browser</h2>
                    <p>
                        After retrieval, prompting, validation, and section assembly, the controller returns a single material object.
                        This is the object the frontend puts in React state and immediately renders.
                    </p>
                </div>
                <CodeBlock title="Backend Response Shape" data={materialResponse} />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>7. Optional Persistence After Rendering</h2>
                    <p>
                        The generated result becomes durable only if the user saves it. The save request writes into the
                        <code>StudyMaterial</code> collection with content, sections, and derived metadata such as word count and
                        estimated read time.
                    </p>
                </div>
                <CodeBlock title="StudyMaterial Document Saved to MongoDB" data={persistedMaterial} />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>8. Final Frontend Presentation</h2>
                    <p>
                        In the final stage, the UI renders <code>material.sections</code> with ReactMarkdown, math support, code block
                        wrappers, and list formatting helpers. The final page therefore reflects the <strong>sectioned JSON structure</strong>,
                        not a raw AI string pasted into the DOM.
                    </p>
                </div>

                <div className="mgf-final-preview">
                    <div className="mgf-final-preview__meta">
                        <span>Topic: {materialResponse.material.topic}</span>
                        <span>Mode: {materialResponse.material.mode}</span>
                        <span>Sections: {materialResponse.material.sections.length}</span>
                    </div>

                    <article className="mgf-final-preview__paper">
                        <h3>{materialResponse.material.sections[0].title}</h3>
                        <p className="mgf-final-preview__overview">
                            {materialResponse.material.sections[0].overview}
                        </p>

                        <div className="mgf-rendered-markdown">
                            <h4>Definition</h4>
                            <p>
                                Third Normal Form removes transitive dependency from a relation.
                            </p>

                            <h4>Working Logic</h4>
                            <p>
                                If one non-key attribute determines another non-key attribute, the relation is decomposed so each fact
                                is stored in the correct table.
                            </p>

                            <h4>Concrete Example</h4>
                            <p>
                                <code>STUDENT(student_id, department_id, department_name)</code> violates 3NF because{" "}
                                <code>department_name</code> depends on <code>department_id</code>, not directly on{" "}
                                <code>student_id</code>.
                            </p>
                        </div>

                        <div className="mgf-key-points">
                            <h4>Key Takeaways</h4>
                            <ul>
                                {materialResponse.material.sections[0].keyPoints.map((point) => (
                                    <li key={point}>{point}</li>
                                ))}
                            </ul>
                        </div>
                    </article>
                </div>
            </section>

            <section className="mgf-footer-note">
                <h2>Short reliability summary</h2>
                <p>
                    The most important idea is that one material request changes representation several times:{" "}
                    <strong>
                        syllabus text{" -> "}structured syllabus{" -> "}subtopic request{" -> "}retrieval query{" -> "}stored chunk metadata{" -> "}
                        normalized retrieval result{" -> "}prompt context{" -> "}sectioned material JSON{" -> "}React-rendered page{" -> "}
                        optional StudyMaterial document
                    </strong>.
                    That is the full lifecycle of a generated material in this project.
                </p>
            </section>
        </main>
    );
}
