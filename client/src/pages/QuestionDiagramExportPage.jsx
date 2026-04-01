import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

const diagrams = {
    "end-to-end": {
        title: "End-to-End Question Generation and Usage",
        code: String.raw`
flowchart TD
    A["PracticeSession /<br/>QuizSession /<br/>TestSession"] --> B["POST /api/student/sessions"]
    B --> C["sessionController.startSession"]
    C --> D["questionService.generateQuestions"]
    D --> E["Fetch existing questions from MongoDB"]
    E --> F{"Enough unique questions?"}
    F -- Yes --> G["Reuse existing Question docs"]
    F -- No --> H["openaiService.generateQuestionsForTopic"]
    H --> I["retrieveRelevantChunks<br/>for topic grounding"]
    I --> J["OpenAI prompt +<br/>Bloom instructions +<br/>exclusion block"]
    J --> K["AI returns structured questions"]
    K --> L["Question docs saved to MongoDB"]
    G --> M["Session created with<br/>questionData snapshot"]
    L --> M
    M --> N["Session payload returned to browser"]
    N --> O["QuestionView renders<br/>one question at a time"]
    O --> P["submitAnswer"]
    P --> Q{"Descriptive?"}
    Q -- Yes --> R["evaluateDescriptiveAnswer"]
    Q -- No --> S["Compare answer to correctAnswer"]
    R --> T["completeSession"]
    S --> T
    T --> U["Result created +<br/>analytics updated"]
    U --> V["ResultPage renders breakdown"]
`,
        minHeight: 4300,
        renderWidth: 1320,
    },
    sourcing: {
        title: "DB Reuse, AI Backfill, and Session Snapshot",
        code: String.raw`
sequenceDiagram
    participant UI as PracticeSession.jsx
    participant SC as sessionController
    participant QS as questionService
    participant DB as Question Collection
    participant OAI as openaiService
    participant RAG as ragService

    UI->>SC: startSession(config)
    SC->>QS: generateQuestions(...)
    QS->>DB: find by topic/difficulty/type
    DB-->>QS: existing questions
    QS->>QS: deduplicate + exclude recent question IDs
    alt more questions needed
        QS->>OAI: generateQuestionsForTopic(topic, options)
        OAI->>RAG: retrieveRelevantChunks(topic, filter, 5)
        RAG-->>OAI: context excerpts
        OAI-->>QS: structured MCQ/descriptive questions
        QS->>DB: save Question docs
    end
    QS-->>SC: final question set
    SC-->>UI: session.questions[]
`,
        minHeight: 980,
        renderWidth: 1600,
    },
};

let mermaidReady = false;

function ensureMermaid() {
    if (mermaidReady) {
        return;
    }

    mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: "Arial, Helvetica, sans-serif",
        flowchart: {
            curve: "basis",
            useMaxWidth: false,
            nodeSpacing: 66,
            rankSpacing: 92,
            padding: 28,
            htmlLabels: false,
        },
        sequence: {
            useMaxWidth: false,
            wrap: true,
        },
        themeVariables: {
            primaryColor: "#e6f3eb",
            primaryBorderColor: "#3e7b58",
            primaryTextColor: "#153527",
            secondaryColor: "#f5ead5",
            tertiaryColor: "#eef4f7",
            lineColor: "#365f6b",
            fontSize: "30px",
            clusterBkg: "#f7fafb",
            clusterBorder: "#aec7cf",
        },
    });

    mermaidReady = true;
}

export default function QuestionDiagramExportPage() {
    const ref = useRef(null);
    const id = useId().replace(/:/g, "-");
    const [error, setError] = useState("");
    const params = new URLSearchParams(window.location.search);
    const diagramKey = params.get("diagram") || "end-to-end";
    const diagram = diagrams[diagramKey] || diagrams["end-to-end"];

    useEffect(() => {
        let cancelled = false;

        async function render() {
            try {
                ensureMermaid();
                const { svg } = await mermaid.render(`question-export-${id}`, diagram.code);
                if (cancelled || !ref.current) {
                    return;
                }

                ref.current.innerHTML = svg;
                const renderedSvg = ref.current.querySelector("svg");
                if (renderedSvg) {
                    renderedSvg.setAttribute("width", String(diagram.renderWidth));
                    renderedSvg.style.width = `${diagram.renderWidth}px`;
                    renderedSvg.style.height = "auto";
                    renderedSvg.style.display = "block";
                }
                setError("");
            } catch (renderError) {
                if (!cancelled) {
                    setError(renderError?.message || "Failed to render export diagram.");
                }
            }
        }

        render();

        return () => {
            cancelled = true;
        };
    }, [diagram.code, id]);

    return (
        <main className="qde-page">
            <h1 className="qde-title">{diagram.title}</h1>
            <div className="qde-frame">
                {error ? (
                    <pre>{error}</pre>
                ) : (
                    <div ref={ref} className="qde-canvas" style={{ minHeight: `${diagram.minHeight}px` }} />
                )}
            </div>
        </main>
    );
}
