import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

let mermaidReady = false;

function getMermaidConfig(htmlLabels = true, fontSize = "14px") {
    return {
        startOnLoad: false,
        securityLevel: "loose",
        theme: "base",
        fontFamily: "IBM Plex Sans, Avenir Next, Segoe UI, sans-serif",
        flowchart: {
            curve: "basis",
            useMaxWidth: true,
            nodeSpacing: htmlLabels ? 22 : 34,
            rankSpacing: htmlLabels ? 34 : 48,
            padding: htmlLabels ? 8 : 14,
            htmlLabels,
        },
        sequence: {
            useMaxWidth: true,
            wrap: true,
        },
        themeVariables: {
            primaryColor: "#e6f3eb",
            primaryBorderColor: "#3e7b58",
            primaryTextColor: "#153527",
            secondaryColor: "#f5ead5",
            tertiaryColor: "#eef4f7",
            lineColor: "#365f6b",
            fontSize,
            clusterBkg: "#f7fafb",
            clusterBorder: "#aec7cf",
        },
    };
}

function ensureMermaid() {
    if (mermaidReady) {
        return;
    }

    mermaid.initialize(getMermaidConfig(true, "16px"));

    mermaidReady = true;
}

function MermaidDiagram({ title, code, downloadHref }) {
    const ref = useRef(null);
    const id = useId().replace(/:/g, "-");
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function render() {
            try {
                ensureMermaid();
                const { svg, bindFunctions } = await mermaid.render(`question-flow-${id}`, code);
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
                <div>
                    <h3>{title}</h3>
                    <p>This diagram follows the current question/session code path.</p>
                </div>
                <div className="mgf-diagram-card__actions" data-export-ignore="true">
                    <a
                        href={downloadHref}
                        download
                        className="mgf-diagram-btn"
                        rel="noopener"
                    >
                        Download JPG
                    </a>
                </div>
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
    syllabusName: "Operating Systems - Unit 4",
    topics: ["Deadlock", "Deadlock Prevention"],
    difficulty: "mixed",
    questionCount: 10,
    questionMode: "mixed",
    sessionType: "practice",
};

const sessionRequest = {
    type: "practice",
    syllabusId: "67fb8195e11fd0c7f6d70c44",
    topics: ["Deadlock", "Deadlock Prevention"],
    difficulty: "mixed",
    questionCount: 10,
    questionMode: "mixed",
};

const retrievedChunk = {
    text: "A deadlock can occur only if the four Coffman conditions hold simultaneously: mutual exclusion, hold and wait, no preemption, and circular wait. A common prevention strategy is to impose a total ordering on resource types so that processes request resources only in ascending order.",
    score: 0.9018,
    retrievalScore: 0.8362,
    rerankScore: 2.1874,
    fileName: "Operating Systems Unit 4 Notes",
    documentTitle: "Operating Systems Unit 4 Notes",
    sourceUrl: "https://docs.google.com/document/d/1OSDEADLOCKFLOW123/edit",
    pageEstimate: 11,
    textbookId: null,
    documentId: "1OSDEADLOCKFLOW123",
    chunkIndex: 8,
    clusterId: "deadlock-prevention-resource-ordering",
    clusterLabel: "Deadlock Prevention > Resource Ordering",
    sectionTitle: "Deadlock Prevention",
    sectionPath: ["Deadlock", "Deadlock Prevention"],
};

const aiQuestion = {
    question: "Which strategy directly prevents circular wait in deadlock prevention?",
    options: [
        { label: "A", text: "Allowing unlimited resource preemption" },
        { label: "B", text: "Imposing a global resource ordering" },
        { label: "C", text: "Increasing the CPU scheduling quantum" },
        { label: "D", text: "Running one process at a time" },
    ],
    correctAnswer: "B",
    explanation: "A strict ordering forces processes to request resources in one direction, which breaks the circular wait condition.",
    difficulty: "medium",
    topic: "Deadlock Prevention",
    bloomLevel: "apply",
};

const savedQuestion = {
    _id: "6802b7d5d408a7f7fe2ab901",
    syllabusId: "67fb8195e11fd0c7f6d70c44",
    topic: "Deadlock Prevention",
    type: "mcq",
    text: "Which strategy directly prevents circular wait in deadlock prevention?",
    options: [
        { label: "A", text: "Allowing unlimited resource preemption" },
        { label: "B", text: "Imposing a global resource ordering" },
        { label: "C", text: "Increasing the CPU scheduling quantum" },
        { label: "D", text: "Running one process at a time" },
    ],
    correctAnswer: "B",
    explanation: "A strict ordering breaks the circular wait condition.",
    difficulty: "medium",
    marks: 2,
    bloomLevel: "apply",
    isAIGenerated: true,
};

const sessionResponse = {
    message: "Session started",
    session: {
        id: "6802b92ad408a7f7fe2ab9d0",
        type: "practice",
        questionCount: 10,
        totalTimeAllowed: null,
        questions: [
            {
                index: 0,
                questionId: "6802b7d5d408a7f7fe2ab901",
                text: "Which strategy directly prevents circular wait in deadlock prevention?",
                type: "mcq",
                options: [
                    { label: "A", text: "Allowing unlimited resource preemption" },
                    { label: "B", text: "Imposing a global resource ordering" },
                    { label: "C", text: "Increasing the CPU scheduling quantum" },
                    { label: "D", text: "Running one process at a time" },
                ],
                difficulty: "medium",
                topic: "Deadlock Prevention",
                marks: 2,
            },
        ],
    },
};

const answerSubmission = {
    questionId: "6802b7d5d408a7f7fe2ab901",
    answer: "B",
    timeSpent: 34,
    markedForReview: false,
};

const descriptiveEvaluation = {
    score: 8,
    percentage: 80,
    feedback: "The answer covers the core prevention idea and correctly connects resource ordering to circular wait.",
    keyPointsCovered: 4,
    totalKeyPoints: 5,
};

const resultSnapshot = {
    type: "practice",
    score: {
        obtained: 16,
        total: 20,
        percentage: 80,
    },
    accuracy: 80,
    timeSpent: {
        total: 410,
        average: 41,
    },
    questionBreakdown: {
        total: 10,
        attempted: 10,
        correct: 8,
        incorrect: 2,
        skipped: 0,
    },
    topicPerformance: [
        {
            topic: "Deadlock Prevention",
            attempted: 5,
            correct: 4,
            accuracy: 80,
            timeSpent: 193,
        },
        {
            topic: "Deadlock",
            attempted: 5,
            correct: 4,
            accuracy: 80,
            timeSpent: 217,
        },
    ],
};

const endToEndFlow = String.raw`
flowchart TB
    subgraph topRow[ ]
        direction LR
        A[Session setup] --> B[startSession]
        B --> C[Load reusable questions]
        C --> D{Enough unique questions?}
    end

    D -- Yes --> E[Reuse existing pool]
    D -- No --> F[Ground with RAG and ask AI]
    F --> G[Save generated questions]

    subgraph rightCol[ ]
        direction TB
        H[Create session snapshot] --> I[Student answers questions]
        I --> J[Evaluate objective or descriptive]
        J --> K[Complete session]
        K --> L[Create result and analytics]
    end

    E --> H
    G --> H

    style topRow fill:none,stroke:none
    style rightCol fill:none,stroke:none
`;

const sourcingFlow = String.raw`
sequenceDiagram
    participant UI as Session UI
    participant SC as sessionController
    participant QS as questionService
    participant AI as OpenAI Flow

    UI->>SC: startSession(config)
    SC->>QS: generateQuestions(...)
    QS->>QS: reuse + deduplicate
    alt more questions needed
        QS->>AI: generate grounded questions
        AI-->>QS: structured MCQ/descriptive set
        QS->>QS: persist new items
    end
    QS-->>SC: final question list
    SC-->>UI: session payload
`;

const questionDiagramDownloads = {
    endToEnd: "/diagram-downloads/question-flow-end-to-end.jpg",
    sourcing: "/diagram-downloads/question-flow-sourcing.jpg",
};

const stages = [
    {
        phase: "Phase 1",
        title: "The student chooses a session configuration",
        description: "Question generation usually begins through Practice, Quiz, or Test setup. The UI captures syllabus, topics, difficulty, question count, time, and question mode. The exact config depends on the screen.",
        inputs: "Session type, syllabus, selected topics, difficulty, count, and question mode.",
        transforms: "UI choices become one startSession request payload.",
        outputs: "A POST body sent to /api/student/sessions.",
        codeRefs: [
            "client/src/components/student/PracticeSession.jsx",
            "client/src/components/student/QuizSession.jsx",
            "client/src/components/student/TestSession.jsx",
            "client/src/services/openai.js",
        ],
    },
    {
        phase: "Phase 2",
        title: "The backend first tries to reuse existing questions",
        description: "The service does not blindly regenerate everything. It checks MongoDB for matching questions, filters duplicates by normalized text, and excludes recently used question IDs from the user’s latest sessions.",
        inputs: "topics[], difficulty, count, type/questionMode, userId, syllabusId.",
        transforms: "Stored Question docs are filtered for reuse quality and freshness.",
        outputs: "A partial or complete pool of reusable questions.",
        codeRefs: [
            "server/controllers/sessionController.js",
            "server/services/questionService.js",
            "server/models/Question.js",
        ],
    },
    {
        phase: "Phase 3",
        title: "Missing questions are generated topic by topic",
        description: "If the DB does not have enough unique questions, the service generates more. It passes an exclusion block of already-seen questions, uses Bloom-level distribution logic, and asks OpenAI for schema-bound output.",
        inputs: "Needed count, topic, difficulty, type, existingQuestions, bloomLevel='mixed'.",
        transforms: "The service converts question shortage into an AI generation request.",
        outputs: "Fresh question objects ready to validate and store.",
        codeRefs: [
            "server/services/questionService.js",
            "server/services/openaiService.js",
            "server/utils/bloomTaxonomy.js",
        ],
    },
    {
        phase: "Phase 4",
        title: "RAG grounding supports the question prompt",
        description: "Question generation also retrieves grounded context from Pinecone. The retrieved chunk excerpts are injected into the prompt so the questions are closer to course material rather than generic model recall.",
        inputs: "Topic query such as 'Deadlock Prevention'.",
        transforms: "Topic text becomes embeddings, then candidate chunks, then a short excerpt block.",
        outputs: "Grounding context included in the question-generation prompt.",
        codeRefs: [
            "server/services/openaiService.js",
            "server/services/ragService.js",
        ],
    },
    {
        phase: "Phase 5",
        title: "Generated questions are saved, then copied into a session snapshot",
        description: "AI-generated questions are inserted into the Question collection first. After that, the session is created with a smaller questionData snapshot that the frontend actually renders during the session.",
        inputs: "Validated AI output or reused Question documents.",
        transforms: "Question docs become session question payloads.",
        outputs: "Session.questions[] returned to the browser.",
        codeRefs: [
            "server/services/questionService.js",
            "server/controllers/sessionController.js",
            "server/models/Question.js",
        ],
    },
    {
        phase: "Phase 6",
        title: "QuestionView renders, accepts answers, and triggers scoring",
        description: "The frontend renders one question at a time from currentSession.questions. MCQs compare directly against correctAnswer. Descriptive questions go back through OpenAI for evaluator-style scoring.",
        inputs: "session.questions[], user answers, per-question time spent.",
        transforms: "Answer data becomes answer records and correctness/evaluation metadata.",
        outputs: "Answer submission feedback and final result records.",
        codeRefs: [
            "client/src/components/student/QuestionView.jsx",
            "server/controllers/sessionController.js",
            "server/services/openaiService.js",
        ],
    },
    {
        phase: "Phase 7",
        title: "A completed session becomes a result and analytics record",
        description: "On completion, the server calculates marks, accuracy, topic performance, difficulty breakdown, and total time. ResultPage then visualizes the breakdown for the student.",
        inputs: "Session questions, submitted answers, time spent, correctness flags.",
        transforms: "Raw answer records become structured performance analytics.",
        outputs: "ResultPage summary cards, topic analysis, and breakdown charts.",
        codeRefs: [
            "server/controllers/sessionController.js",
            "client/src/components/student/ResultPage.jsx",
            "server/services/analyticsService.js",
        ],
    },
];

export default function QuestionGenerationFlowPage() {
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
                margin: 0;
                background:
                    radial-gradient(circle at top left, rgba(208, 227, 232, 0.9), transparent 35%),
                    radial-gradient(circle at top right, rgba(248, 233, 201, 0.9), transparent 33%),
                    linear-gradient(180deg, #f4f8f8 0%, #fcfaf4 100%);
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

    function buildStandaloneHtml(contentHtml, stylesText) {
        return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DLP Question Generation Flow Report</title>
    <style>${stylesText}</style>
  </head>
  <body>
    ${contentHtml}
  </body>
</html>`;
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        window.setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function handleDownloadHtml() {
        if (!pageRef.current) {
            return;
        }

        setDownloading(true);

        try {
            const cleaned = sanitizeExportDom(pageRef.current);
            const stylesText = collectDocumentStyles();
            const html = buildStandaloneHtml(cleaned.outerHTML, stylesText);
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            triggerDownload(blob, "dlp-question-generation-flow-report.html");
        } catch (error) {
            console.error("HTML export failed:", error);
            window.alert(error?.message || "Failed to prepare the HTML export.");
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
                    <button type="button" className="mgf-download-btn" onClick={handleDownloadHtml}>
                        {downloading ? "Preparing HTML..." : "Download as HTML"}
                    </button>
                </div>
                <h1>How One Question Set Is Sourced, Generated, Stored, Served, Answered, and Scored</h1>
                <p className="mgf-hero__lede">
                    This page follows the real question-generation path in the current codebase. The example is a{" "}
                    <strong>{example.sessionType}</strong> session for <strong>{example.syllabusName}</strong>, using topics{" "}
                    <strong>{example.topics.join(" + ")}</strong>, <strong>{example.difficulty}</strong> difficulty, and{" "}
                    <strong>{example.questionMode}</strong> mode.
                </p>

                <div className="mgf-summary-grid">
                    <div className="mgf-summary-card">
                        <span className="mgf-summary-card__label">Session Trigger</span>
                        <strong>POST /api/student/sessions</strong>
                    </div>
                    <div className="mgf-summary-card">
                        <span className="mgf-summary-card__label">Question Sourcing Rule</span>
                        <strong>Reuse from DB first, generate only the shortage</strong>
                    </div>
                    <div className="mgf-summary-card">
                        <span className="mgf-summary-card__label">Final Frontend View</span>
                        <strong>QuestionView and ResultPage</strong>
                    </div>
                </div>
            </section>

            <section className="mgf-callout">
                <h2>Important behavior in the current codebase</h2>
                <p>
                    The main question-generation path is session-driven, not the simpler helper route at{" "}
                    <code>/api/openai/generate-questions</code>. Also, the test setup sends <code>sectionsConfig</code> into session
                    creation, but the returned session payload does not currently echo it back, so <code>QuestionView</code> falls
                    back to a generic palette grouping unless that field exists in client state.
                </p>
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>1. End-to-End Question Flow</h2>
                    <p>
                        This is the practical route from session setup to final result rendering.
                    </p>
                </div>
                <MermaidDiagram
                    title="End-to-End Question Generation and Usage"
                    code={endToEndFlow}
                    downloadHref={questionDiagramDownloads.endToEnd}
                />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>2. Stage-by-Stage Explanation</h2>
                    <p>
                        A question set changes shape several times: session config, filtered DB query, AI prompt request, stored
                        question document, session snapshot, submitted answer, and final result.
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
                    <h2>3. Session Request That Starts the Whole Flow</h2>
                    <p>
                        This is the kind of payload sent by the setup page when the student starts a practice session.
                    </p>
                </div>
                <CodeBlock title="Frontend startSession Payload" data={sessionRequest} />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>4. Question Sourcing Pipeline</h2>
                    <p>
                        The service first tries MongoDB, then generates only what is missing. That makes this path different from the
                        material page, which is more directly generation-oriented.
                    </p>
                </div>
                <MermaidDiagram
                    title="DB Reuse, AI Backfill, and Session Snapshot"
                    code={sourcingFlow}
                    downloadHref={questionDiagramDownloads.sourcing}
                />
            </section>

            <section className="mgf-two-column">
                <CodeBlock title="Retrieved Chunk Used to Ground a Question Prompt" data={retrievedChunk} />
                <CodeBlock title="Raw AI Question Object Returned by OpenAI" data={aiQuestion} />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>5. What the Backend Persists</h2>
                    <p>
                        Generated questions are saved in the Question collection before they are copied into the session snapshot.
                    </p>
                </div>
                <CodeBlock title="Saved Question Document" data={savedQuestion} />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>6. What the Browser Actually Receives for Rendering</h2>
                    <p>
                        The session payload does not send the entire Question document. Instead it sends a smaller questionData shape
                        with only what the interactive view needs right away.
                    </p>
                </div>
                <CodeBlock title="Session Response Returned to the Frontend" data={sessionResponse} />
            </section>

            <section className="mgf-two-column">
                <CodeBlock title="Answer Submission Payload" data={answerSubmission} />
                <CodeBlock title="Descriptive Evaluation Shape (When Question Type Is Descriptive)" data={descriptiveEvaluation} />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>7. Final Result Object Used by ResultPage</h2>
                    <p>
                        After completion, the server aggregates score, accuracy, time, and topic performance. This is what powers the
                        result screen rather than the raw question list itself.
                    </p>
                </div>
                <CodeBlock title="Result Snapshot" data={resultSnapshot} />
            </section>

            <section className="mgf-section">
                <div className="mgf-section__header">
                    <h2>8. Final Frontend Presentation</h2>
                    <p>
                        The user does not see the raw OpenAI output or even the full Question document. The browser renders a session
                        snapshot one question at a time, then later renders an analytics-oriented result view.
                    </p>
                </div>

                <div className="mgf-final-preview">
                    <div className="mgf-final-preview__meta">
                        <span>Session Type: {sessionResponse.session.type}</span>
                        <span>Question Count: {sessionResponse.session.questionCount}</span>
                        <span>Current View: QuestionView.jsx</span>
                    </div>

                    <article className="mgf-final-preview__paper">
                        <h3>QuestionView Snapshot</h3>
                        <p className="mgf-final-preview__overview">
                            The frontend renders a single active question, option buttons for MCQ, a textarea for descriptive mode,
                            and session-level controls such as Next, Mark for Review, Finish, and timer display.
                        </p>

                        <div className="mgf-rendered-markdown">
                            <h4>Rendered Prompt</h4>
                            <p>{sessionResponse.session.questions[0].text}</p>

                            <h4>Rendered Options</h4>
                            <p>A. Allowing unlimited resource preemption</p>
                            <p>B. Imposing a global resource ordering</p>
                            <p>C. Increasing the CPU scheduling quantum</p>
                            <p>D. Running one process at a time</p>
                        </div>

                        <div className="mgf-key-points">
                            <h4>Why this matters</h4>
                            <ul>
                                <li>Question generation is session-driven, not just route-driven.</li>
                                <li>Existing questions are reused before AI generation happens.</li>
                                <li>Descriptive questions later trigger AI evaluation during answer submission.</li>
                            </ul>
                        </div>
                    </article>
                </div>
            </section>

            <section className="mgf-footer-note">
                <h2>Short reliability summary</h2>
                <p>
                    The full lifecycle here is{" "}
                    <strong>
                        session config{" -> "}DB reuse/exclusion{" -> "}AI backfill with Bloom guidance and RAG context{" -> "}
                        Question document storage{" -> "}Session snapshot{" -> "}interactive QuestionView{" -> "}answer evaluation{" -> "}
                        ResultPage analytics
                    </strong>.{" "}
                    That is the actual question-generation and usage path in this project.
                </p>
            </section>
        </main>
    );
}
