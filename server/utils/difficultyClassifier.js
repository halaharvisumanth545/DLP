// Difficulty classifier for questions

// Keywords that indicate difficulty levels
const difficultyIndicators = {
    easy: [
        "what is",
        "define",
        "list",
        "name",
        "identify",
        "state",
        "describe",
        "which",
        "when",
        "where",
        "who",
    ],
    medium: [
        "explain",
        "compare",
        "contrast",
        "differentiate",
        "how",
        "why",
        "discuss",
        "illustrate",
        "demonstrate",
        "classify",
    ],
    hard: [
        "analyze",
        "evaluate",
        "synthesize",
        "design",
        "create",
        "propose",
        "justify",
        "critique",
        "assess",
        "formulate",
        "derive",
        "prove",
    ],
};

// Classify difficulty based on question text
export function classifyDifficulty(questionData) {
    const { text = "", options = [] } = questionData;
    const lowerText = text.toLowerCase();

    // Check for hard indicators first
    for (const indicator of difficultyIndicators.hard) {
        if (lowerText.includes(indicator)) {
            return "hard";
        }
    }

    // Check for medium indicators
    for (const indicator of difficultyIndicators.medium) {
        if (lowerText.includes(indicator)) {
            return "medium";
        }
    }

    // Check for easy indicators
    for (const indicator of difficultyIndicators.easy) {
        if (lowerText.includes(indicator)) {
            return "easy";
        }
    }

    // Additional heuristics
    const wordCount = text.split(/\s+/).length;
    const hasMultipleParts = text.includes("and") || text.includes("or");
    const hasNumbers = /\d+/.test(text);
    const hasFormulas = /[=+\-*/^(){}[\]]/.test(text);

    // Longer questions with formulas are typically harder
    if (hasFormulas && wordCount > 20) {
        return "hard";
    }

    // Questions with multiple parts are medium or hard
    if (hasMultipleParts && wordCount > 15) {
        return "medium";
    }

    // Short, simple questions are usually easy
    if (wordCount < 10) {
        return "easy";
    }

    // Default to medium
    return "medium";
}

// Get suggested marks based on difficulty
export function getSuggestedMarks(difficulty) {
    switch (difficulty) {
        case "easy":
            return 1;
        case "medium":
            return 2;
        case "hard":
            return 3;
        default:
            return 1;
    }
}

// Validate difficulty distribution for a test
export function validateDifficultyDistribution(questions) {
    const distribution = {
        easy: 0,
        medium: 0,
        hard: 0,
    };

    questions.forEach((q) => {
        const diff = q.difficulty || "medium";
        if (distribution[diff] !== undefined) {
            distribution[diff]++;
        }
    });

    const total = questions.length;
    const percentages = {
        easy: Math.round((distribution.easy / total) * 100),
        medium: Math.round((distribution.medium / total) * 100),
        hard: Math.round((distribution.hard / total) * 100),
    };

    // Recommended distribution: 30% easy, 50% medium, 20% hard
    const isBalanced =
        percentages.easy >= 20 &&
        percentages.easy <= 40 &&
        percentages.medium >= 40 &&
        percentages.medium <= 60 &&
        percentages.hard >= 10 &&
        percentages.hard <= 30;

    return {
        distribution,
        percentages,
        isBalanced,
        recommendation: isBalanced
            ? "Distribution is balanced"
            : "Consider adjusting: Aim for ~30% easy, ~50% medium, ~20% hard",
    };
}
