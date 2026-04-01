import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ReferenceDot,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from "recharts";

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
            nodeSpacing: 32,
            rankSpacing: 52,
            padding: 12,
            htmlLabels: true,
        },
        themeVariables: {
            primaryColor: "#edf6f2",
            primaryBorderColor: "#2d6251",
            primaryTextColor: "#143227",
            secondaryColor: "#fff2de",
            tertiaryColor: "#f4f7f9",
            lineColor: "#2a5161",
            fontSize: "16px",
            clusterBkg: "#fbfdfd",
            clusterBorder: "#c7d7dd",
        },
    });

    mermaidReady = true;
}

function MermaidFigure({ figureId, title, insertAfter, code }) {
    const ref = useRef(null);
    const uniqueId = useId().replace(/:/g, "-");
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function render() {
            try {
                ensureMermaid();
                const { svg, bindFunctions } = await mermaid.render(`process-figure-${uniqueId}`, code);

                if (cancelled || !ref.current) {
                    return;
                }

                ref.current.innerHTML = svg;
                const renderedSvg = ref.current.querySelector("svg");
                if (renderedSvg) {
                    renderedSvg.setAttribute("width", "100%");
                    renderedSvg.setAttribute("height", "100%");
                    renderedSvg.style.width = "100%";
                    renderedSvg.style.height = "100%";
                    renderedSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
                }
                bindFunctions?.(ref.current);
                setError("");
            } catch (diagramError) {
                if (!cancelled) {
                    setError(diagramError?.message || "Failed to render diagram.");
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
    }, [code, uniqueId]);

    return (
        <section className="pdd-figure-card" id={figureId.toLowerCase().replace(/\s+/g, "-")}>
            <div className="pdd-figure-card__header">
                <div>
                    <span className="pdd-figure-card__eyebrow">{figureId}</span>
                    <h2>{title}</h2>
                </div>
                <p className="pdd-figure-card__placement">Insert after: {insertAfter}</p>
            </div>
            {error ? (
                <div className="pdd-figure-card__error">
                    <p>{error}</p>
                    <pre>{code}</pre>
                </div>
            ) : (
                <div ref={ref} className="pdd-figure-card__canvas" />
            )}
        </section>
    );
}

const materialFlow = String.raw`
flowchart TD
    A[Student uploads syllabus<br/>or Google Doc material source] --> B[System extracts topics and subtopics]
    B --> C[Student selects exactly one topic,<br/>one subtopic, and one mode]
    C --> D[Frontend calls generate-comprehensive-material]
    D --> E[Backend builds query:<br/>topic plus subtopic]
    E --> F[retrieveRelevantChunks]
    F --> G[OpenAI embeddings create query vector]
    G --> H[Pinecone returns matching chunks]
    H --> I[Optional reranker,<br/>adaptive top-k, cluster diversity]
    I --> J[Controller classifies subtopic as<br/>code-intensive or non-code]
    J --> K[Prompt assembled with textbook context,<br/>mode rules, and JSON schema]
    K --> L[OpenAI generates structured sections]
    L --> M[Material response returned to browser]
    M --> N[Student reads content and may save to library]
`;

const questionFlow = String.raw`
flowchart TD
    A[Practice / Quiz / Test configuration] --> B[startSession]
    B --> C[questionService.generateQuestions]
    C --> D[Load syllabus topics if needed]
    D --> E[Exclude recent session questions<br/>plus current session duplicates]
    E --> F[Query Question collection by<br/>topic, difficulty, and type]
    F --> G{Enough unique questions?}
    G -- Yes --> H[Reuse MongoDB questions]
    G -- No --> I[generateQuestionsForTopic]
    I --> J[retrieveRelevantChunks for grounding]
    J --> K[Prompt includes Bloom guidance<br/>and exclusion block]
    K --> L[OpenAI returns MCQ or descriptive questions]
    L --> M[Questions saved back to MongoDB]
    H --> N[Final set deduplicated and shuffled]
    M --> N
    N --> O[Session stores questionData snapshot]
    O --> P[Browser receives ready-to-answer session]
`;

const evaluationFlow = String.raw`
flowchart TD
    A[Student submits answer] --> B[sessionController.submitAnswer]
    B --> C{Question type}
    C -- Objective --> D[Compare selected option<br/>with correctAnswer]
    C -- Descriptive --> E[evaluateDescriptiveAnswer]
    E --> F[LLM returns score,<br/>percentage, feedback,<br/>and key-point coverage]
    F --> G[System converts percentage >= 50<br/>into isCorrect = true]
    D --> H[Answer stored in session.answers]
    G --> H
    H --> I[completeSession]
    I --> J[Compute marks, accuracy,<br/>difficulty analysis,<br/>topic performance, time spent]
    J --> K[Create Result document]
    K --> L[Update Analytics:<br/>streaks, weak topics,<br/>difficulty performance, history]
    L --> M[ResultPage and SessionReview display outcomes]
`;

const timeChartData = [
    { checkpoint: 0, cumulativeTime: 0, questionNumber: 1, label: "Start" },
    { checkpoint: 1, cumulativeTime: 46, questionNumber: 1, label: "Submit Q1" },
    { checkpoint: 2, cumulativeTime: 93, questionNumber: 3, label: "Jump to Q3" },
    { checkpoint: 3, cumulativeTime: 151, questionNumber: 2, label: "Return to Q2" },
    { checkpoint: 4, cumulativeTime: 229, questionNumber: 5, label: "Move to Q5" },
    { checkpoint: 5, cumulativeTime: 301, questionNumber: 4, label: "Review Q4" },
    { checkpoint: 6, cumulativeTime: 380, questionNumber: 6, label: "Submit Q6" },
];

const timeLabelOffsets = [
    { dx: 14, dy: 18 },
    { dx: 14, dy: -16 },
    { dx: 14, dy: -18 },
    { dx: 14, dy: 18 },
    { dx: 14, dy: -18 },
    { dx: 14, dy: 18 },
    { dx: -132, dy: -18 },
];

function PersistentSwapLabel(props) {
    const { viewBox, index = 0, value } = props;

    if (!viewBox || typeof viewBox.x !== "number" || typeof viewBox.y !== "number") {
        return null;
    }

    const x = viewBox.x;
    const y = viewBox.y;
    const offset = timeLabelOffsets[index] || { dx: 14, dy: -18 };
    const labelText = String(value || "");
    const bubbleWidth = Math.max(92, Math.min(154, 24 + labelText.length * 6.2));
    const bubbleHeight = 30;
    const bubbleX = x + offset.dx;
    const bubbleY = y + offset.dy;

    return (
        <g>
            <rect
                x={bubbleX}
                y={bubbleY}
                width={bubbleWidth}
                height={bubbleHeight}
                rx={10}
                ry={10}
                fill="#ffffff"
                stroke="rgba(55, 84, 93, 0.18)"
                strokeWidth={1}
            />
            <text
                x={bubbleX + 12}
                y={bubbleY + 19}
                fill="#24424c"
                fontSize={12}
                fontWeight={600}
            >
                {labelText}
            </text>
        </g>
    );
}

function buildSwapLabel(point, index) {
    const labelText = index === 0 ? "Start • Q1" : `${point.cumulativeTime}s • ${point.label}`;

    return (labelProps) => (
        <PersistentSwapLabel
            {...labelProps}
            index={index}
            value={labelText}
        />
    );
}

const figureMap = [
    {
        figureId: "Figure 1",
        title: "Material Generation Workflow",
        insertAfter: "Section 1.1 Material Generation Overview",
        note: "Use this immediately after the opening overview paragraph for Topic 1.",
    },
    {
        figureId: "Figure 2",
        title: "Question Generation and Session Assembly",
        insertAfter: "Section 2.1 Question Generation Overview",
        note: "Place this before the detailed explanation of database reuse and AI backfill.",
    },
    {
        figureId: "Figure 3",
        title: "Objective vs Descriptive Result Evaluation",
        insertAfter: "Section 3.1 Evaluation Overview",
        note: "Use this before the scoring formulas and mode comparison table.",
    },
    {
        figureId: "Figure 4",
        title: "Time Analysis Visualization",
        insertAfter: "Section 3.5 Time Analysis and Learner Behavior",
        note: "Place this after the paragraph that explains question swaps and cumulative time.",
    },
];

function TimeAnalysisFigure() {
    return (
        <section className="pdd-figure-card" id="figure-4">
            <div className="pdd-figure-card__header">
                <div>
                    <span className="pdd-figure-card__eyebrow">Figure 4</span>
                    <h2>Time Analysis Visualization</h2>
                </div>
                <p className="pdd-figure-card__placement">Insert after: Section 3.5 Time Analysis and Learner Behavior</p>
            </div>

            <div className="pdd-chart-shell">
                <div className="pdd-chart-shell__intro">
                    <p>
                        This sample chart mirrors the logic used in the session review screen. The x-axis shows cumulative
                        time, and the y-axis shows which question the learner was viewing at each checkpoint.
                    </p>
                    <div className="pdd-metric-grid">
                        <article className="pdd-metric-card">
                            <span className="pdd-metric-card__label">Recorded from</span>
                            <strong>`questionSwaps[]`</strong>
                            <p>Each question change stores `questionId`, `timeSpent`, and `timestamp`.</p>
                        </article>
                        <article className="pdd-metric-card">
                            <span className="pdd-metric-card__label">Interpretation</span>
                            <strong>Cumulative path</strong>
                            <p>Steep horizontal movement means long time on one question before the learner moved.</p>
                        </article>
                        <article className="pdd-metric-card">
                            <span className="pdd-metric-card__label">Use in review</span>
                            <strong>Behavioral insight</strong>
                            <p>Revisits, hesitation, and time clustering point to difficult or uncertain questions.</p>
                        </article>
                    </div>
                </div>

                <div className="pdd-chart-shell__canvas">
                    <ResponsiveContainer width="100%" height={420}>
                        <LineChart data={timeChartData} margin={{ top: 20, right: 28, left: 12, bottom: 16 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="rgba(26, 56, 67, 0.14)" />
                            <XAxis
                                dataKey="cumulativeTime"
                                type="number"
                                domain={[0, 420]}
                                tick={{ fill: "#35545d", fontSize: 13 }}
                                label={{ value: "Cumulative Time (seconds)", position: "insideBottom", offset: -6, fill: "#35545d" }}
                            />
                            <YAxis
                                dataKey="questionNumber"
                                type="number"
                                domain={[1, 6]}
                                allowDecimals={false}
                                tick={{ fill: "#35545d", fontSize: 13 }}
                                label={{ value: "Question Number", angle: -90, position: "insideLeft", fill: "#35545d" }}
                            />
                            <ReferenceLine y={3} stroke="#d6a045" strokeDasharray="6 6" />
                            <Line
                                dataKey="questionNumber"
                                type="monotone"
                                stroke="#1e6678"
                                strokeWidth={3}
                                dot={{ r: 5, fill: "#1e6678", strokeWidth: 0 }}
                                activeDot={false}
                            />
                            {timeChartData.map((point, index) => (
                                <ReferenceDot
                                    key={`${point.cumulativeTime}-${point.questionNumber}-${index}`}
                                    x={point.cumulativeTime}
                                    y={point.questionNumber}
                                    r={0}
                                    isFront={true}
                                    ifOverflow="extendDomain"
                                    label={buildSwapLabel(point, index)}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
}

export default function ProcessDocumentDiagramsPage() {
    return (
        <main className="pdd-page">
            <section className="pdd-hero">
                <div className="pdd-hero__eyebrow">Documentation Support Page</div>
                <h1>DLP Process Diagrams for Material Generation, Question Generation, and Result Evaluation</h1>
                <p className="pdd-hero__lede">
                    This standalone page is prepared for document creation. Each figure is aligned to the current
                    application flow implemented in the backend and frontend code, and each card tells you exactly where
                    the image should be inserted in the written document.
                </p>
                <div className="pdd-hero__grid">
                    {figureMap.map((item) => (
                        <article key={item.figureId} className="pdd-hero__card">
                            <span>{item.figureId}</span>
                            <strong>{item.title}</strong>
                            <p>{item.note}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="pdd-note">
                <h2>How to Use This Page</h2>
                <p>
                    Open this page in the browser, capture each figure as an image, and place it in the matching position
                    mentioned on the card. The recommended standalone URL is <code>/process-document-diagrams.html</code>
                    when the Vite client is running.
                </p>
            </section>

            <MermaidFigure
                figureId="Figure 1"
                title="Material Generation Workflow"
                insertAfter="Section 1.1 Material Generation Overview"
                code={materialFlow}
            />

            <MermaidFigure
                figureId="Figure 2"
                title="Question Generation and Session Assembly"
                insertAfter="Section 2.1 Question Generation Overview"
                code={questionFlow}
            />

            <MermaidFigure
                figureId="Figure 3"
                title="Objective vs Descriptive Result Evaluation"
                insertAfter="Section 3.1 Evaluation Overview"
                code={evaluationFlow}
            />

            <TimeAnalysisFigure />
        </main>
    );
}
