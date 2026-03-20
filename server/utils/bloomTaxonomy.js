/**
 * Bloom's Taxonomy Utility Module
 * 
 * Defines the 6 cognitive levels of Bloom's Taxonomy and provides helpers
 * for distributing question generation across levels and building
 * level-specific AI prompts.
 */

export const BLOOM_LEVELS = [
    {
        level: 1,
        name: "remember",
        label: "Remember",
        description: "Recall facts, terms, basic concepts, and answers",
        verbs: ["define", "list", "name", "identify", "recall", "state", "recognize", "describe"],
        questionStems: {
            mcq: [
                "Which of the following best defines...",
                "What is the term for...",
                "Which statement correctly identifies...",
                "What does the term ___ refer to?",
            ],
            descriptive: [
                "Define the concept of...",
                "List the key characteristics of...",
                "State the main principles of...",
                "What are the fundamental components of...",
            ],
        },
    },
    {
        level: 2,
        name: "understand",
        label: "Understand",
        description: "Demonstrate understanding of facts by organizing, comparing, interpreting",
        verbs: ["explain", "summarize", "paraphrase", "classify", "compare", "interpret", "illustrate", "contrast"],
        questionStems: {
            mcq: [
                "Which of the following best explains...",
                "What is the main difference between ___ and ___?",
                "Which example best illustrates...",
                "How would you summarize...",
            ],
            descriptive: [
                "Explain in your own words how...",
                "Compare and contrast ___ and ___.",
                "Summarize the key ideas behind...",
                "Illustrate the concept of ___ with an example.",
            ],
        },
    },
    {
        level: 3,
        name: "apply",
        label: "Apply",
        description: "Use acquired knowledge to solve problems in new situations",
        verbs: ["apply", "demonstrate", "solve", "use", "implement", "calculate", "execute", "carry out"],
        questionStems: {
            mcq: [
                "Given the following scenario, which approach would correctly apply...",
                "If you were asked to solve ___, which method would you use?",
                "In this situation, what would be the result of applying...",
                "Which of the following correctly demonstrates the use of...",
            ],
            descriptive: [
                "Apply the concept of ___ to solve the following problem...",
                "Demonstrate how you would use ___ in the following scenario...",
                "How would you implement ___ to achieve...",
                "Solve the following problem using the principles of...",
            ],
        },
    },
    {
        level: 4,
        name: "analyze",
        label: "Analyze",
        description: "Examine and break information into parts, identify motives or causes, find evidence",
        verbs: ["analyze", "differentiate", "examine", "categorize", "deconstruct", "distinguish", "investigate", "organize"],
        questionStems: {
            mcq: [
                "What is the most likely cause of...",
                "Which factor primarily contributes to...",
                "How can you distinguish between ___ and ___?",
                "What evidence supports the claim that...",
            ],
            descriptive: [
                "Analyze the relationship between ___ and ___.",
                "Examine the factors that contribute to...",
                "Differentiate between ___ and ___ with specific examples.",
                "Break down the process of ___ into its components and explain each.",
            ],
        },
    },
    {
        level: 5,
        name: "evaluate",
        label: "Evaluate",
        description: "Present and defend opinions by making judgments, critiquing, and recommending",
        verbs: ["evaluate", "justify", "critique", "assess", "judge", "defend", "argue", "recommend"],
        questionStems: {
            mcq: [
                "Which of the following is the strongest argument for...",
                "What is the most significant limitation of...",
                "Which approach would be most effective for ___ and why?",
                "Based on the evidence, which conclusion is best justified?",
            ],
            descriptive: [
                "Evaluate the effectiveness of ___ in achieving...",
                "Justify whether ___ is a better approach than ___.",
                "Critique the following statement: ___.",
                "Assess the strengths and weaknesses of...",
            ],
        },
    },
    {
        level: 6,
        name: "create",
        label: "Create",
        description: "Compile information in a different way, propose alternative solutions, design new approaches",
        verbs: ["design", "construct", "propose", "formulate", "devise", "compose", "generate", "plan"],
        questionStems: {
            mcq: [
                "Which design approach would best address...",
                "If you were to propose a new solution for ___, which would be most viable?",
                "Which combination of ___ would create the most effective...",
                "What novel approach could be used to...",
            ],
            descriptive: [
                "Design a solution for the following problem using...",
                "Propose an alternative approach to...",
                "Formulate a plan to improve ___ considering...",
                "Construct a framework that combines ___ and ___ to...",
            ],
        },
    },
];

/**
 * Distributes the requested question count across Bloom's levels
 * based on the difficulty setting.
 *
 * @param {number} count  - Total number of questions needed
 * @param {string} difficulty - "easy" | "medium" | "hard" | "mixed"
 * @returns {Array<{bloomLevel: string, count: number}>}
 */
export function distributeAcrossBloomLevels(count, difficulty = "mixed") {
    // Weight maps: index 0–5 = Remember..Create
    const weightMaps = {
        easy:   [30, 30, 20, 10, 5, 5],   // Heavily weighted toward Remember/Understand
        medium: [10, 20, 25, 25, 15, 5],   // Weighted toward Understand/Apply/Analyze
        hard:   [5, 5, 15, 25, 25, 25],    // Weighted toward Analyze/Evaluate/Create
        mixed:  [15, 18, 18, 18, 16, 15],  // Roughly even spread
    };

    const weights = weightMaps[difficulty] || weightMaps.mixed;
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // First pass: allocate proportionally
    const distribution = [];
    let allocated = 0;

    for (let i = 0; i < BLOOM_LEVELS.length; i++) {
        const rawCount = Math.round((weights[i] / totalWeight) * count);
        distribution.push({
            bloomLevel: BLOOM_LEVELS[i].name,
            count: rawCount,
        });
        allocated += rawCount;
    }

    // Adjust for rounding — add/subtract from the most-weighted level
    const diff = count - allocated;
    if (diff !== 0) {
        // Find the level with the highest weight to absorb the rounding difference
        const maxWeightIndex = weights.indexOf(Math.max(...weights));
        distribution[maxWeightIndex].count += diff;
    }

    // Remove levels that got 0 questions (can happen with very small counts)
    // But ensure at least 1 question per included level
    const nonZero = distribution.filter(d => d.count > 0);

    // If count is very small (e.g., 1–3), just pick the top weighted levels
    if (nonZero.length === 0) {
        const maxWeightIndex = weights.indexOf(Math.max(...weights));
        return [{ bloomLevel: BLOOM_LEVELS[maxWeightIndex].name, count }];
    }

    return nonZero;
}

/**
 * Returns prompt instructions specific to a Bloom's level and question type.
 *
 * @param {string} bloomLevelName - e.g. "remember", "analyze"
 * @param {string} questionType   - "mcq" or "descriptive"
 * @returns {string} Prompt fragment to inject into the AI prompt
 */
export function getBloomPromptInstructions(bloomLevelName, questionType = "mcq") {
    // Handle "mixed" — instruct AI to distribute across all levels
    if (bloomLevelName === "mixed") {
        const type = questionType === "descriptive" ? "descriptive" : "mcq";
        const levelSummaries = BLOOM_LEVELS.map(l => {
            const verbs = l.verbs.slice(0, 3).join(", ");
            const stem = l.questionStems[type][0];
            return `  - ${l.label} (Level ${l.level}): Use verbs like ${verbs}. Example: "${stem}"`;
        }).join("\n");

        return `
BLOOM'S TAXONOMY DISTRIBUTION:
You MUST distribute the generated questions across multiple cognitive levels from Bloom's Taxonomy.
Ensure a MIX of the following levels — do NOT make all questions the same type:

${levelSummaries}

CRITICAL: Each question should target a DIFFERENT cognitive level. Vary the depth and style of questions.
- Some should test basic recall (Remember/Understand)
- Some should test application and problem-solving (Apply/Analyze)
- Some should test critical thinking (Evaluate/Create)
Assign the appropriate bloomLevel to each question in your response.
`;
    }

    const level = BLOOM_LEVELS.find(l => l.name === bloomLevelName);
    if (!level) {
        return ""; // Fallback: no extra instructions
    }

    const type = questionType === "descriptive" ? "descriptive" : "mcq";
    const stems = level.questionStems[type];
    const verbList = level.verbs.join(", ");

    return `
BLOOM'S TAXONOMY LEVEL: ${level.label} (Level ${level.level})
Cognitive objective: ${level.description}

CRITICAL INSTRUCTION: Every question you generate MUST target the "${level.label}" cognitive level.
- Use action verbs like: ${verbList}
- Example question stems for this level:
${stems.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}

DO NOT generate questions that belong to a different cognitive level. For example:
- Do NOT generate simple recall/definition questions if the level is "Analyze" or "Evaluate".
- Do NOT generate design/creation questions if the level is "Remember" or "Understand".
`;
}
