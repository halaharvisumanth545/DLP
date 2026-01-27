import { generateCompletion, generateJSON } from "../config/openai.js";

// Generate study material content
export async function generateStudyContent(topic, mode, syllabusContext = "") {
  const modeConfig = {
    short: {
      words: "300-500",
      maxTokens: 800,
      model: "gpt-4o-mini",
      instruction: "concise bullet points and key takeaways",
    },
    intermediate: {
      words: "800-1200",
      maxTokens: 2000,
      model: "gpt-4o-mini",
      instruction: "detailed explanations with examples",
    },
    pro: {
      words: "1000-1500",
      maxTokens: 2500,
      model: "gpt-3.5-turbo",
      instruction: "comprehensive and detailed coverage",
    },
  };

  const config = modeConfig[mode] || modeConfig.intermediate;

  // Simplified prompt for better stability
  const proModeEnhancement = mode === "pro" ? `
Provide a comprehensive explanation covering:
1. Core concepts and definitions
2. Key principles and theory
3. Real-world examples
4. Important implementation details (if technical)
5. Exam-relevant key points

Focus on clarity and depth.
` : "";

  const prompt = `Create study material about "${topic}".

${syllabusContext ? `Syllabus context:\n${syllabusContext.substring(0, 1000)}\n` : ""}
${proModeEnhancement}

Requirements:
- Length: approx ${config.words} words
- Style: ${config.instruction}
- Use HTML tags for formatting: <p> for paragraphs, <ul>/<li> for lists, <strong> for emphasis.
- **IMPORTANT**: For mathematical formulas, equations, or scientific notation, YOU MUST USE LaTeX.
  - Use $...$ for inline math (e.g., $E=mc^2$).
  - Use $$...$$ for block math equations.
  - **CRITICAL**: To avoid JSON formatting errors, you MUST NOT use backslashes (\) in your LaTeX or anywhere in the string values.
  - Instead, use the placeholder "|||" for every single backslash.
  - Example: Use "|||frac{1}{2}" instead of "\frac{1}{2}" or "\\frac{1}{2}".
  - Example: Use "|||alpha" instead of "\alpha".
  - Our system will automatically convert "|||" back to the correct backslash.
- **GUIDELINE**: For theoretical or non-technical subjects, avoid code snippets. However, if the topic is technical (e.g., programming), you MUST include relevant code examples.
- Ensure proper spacing and alignment.

Return as JSON:
{
  "content": "Full HTML content here...",
  "sections": [
    {
      "title": "Section Title",
      "content": "<p>Section content with <strong>bold</strong> terms and lists:</p><ul><li>Item 1</li><li>Item 2</li></ul>",
      "keyPoints": ["Point 1"]
    }
  ]
}`;

  try {
    const result = await generateJSON(prompt, {
      maxTokens: config.maxTokens,
      model: config.model
    });
    return {
      content: result.content || "",
      sections: result.sections || [],
    };
  } catch (error) {
    console.error("Study content generation error:", error);
    // Fallback content
    return {
      content: `Study material for ${topic} could not be generated. Please try again.`,
      sections: [],
    };
  }
}

// Generate questions for a topic
export async function generateQuestionsForTopic(topic, options = {}) {
  const {
    count = 5,
    difficulty = "medium",
    type = "mcq",
  } = options;

  const prompt = `Generate ${count} ${difficulty} difficulty ${type.toUpperCase()} questions about "${topic}".

Requirements:
- Questions should test understanding, not just memorization
- Include a mix of conceptual and application-based questions
- Each question should have 4 options for MCQs
- Provide clear explanations for correct answers

Return as JSON array:
[
  {
    "text": "Question text",
    "options": [
      { "label": "A", "text": "Option text" },
      { "label": "B", "text": "Option text" },
      { "label": "C", "text": "Option text" },
      { "label": "D", "text": "Option text" }
    ],
    "correctAnswer": "A",
    "explanation": "Why this is correct",
    "difficulty": "${difficulty}",
    "topic": "${topic}"
  }
]`;

  try {
    const questions = await generateJSON(prompt, { maxTokens: 2000 });
    return Array.isArray(questions) ? questions : [];
  } catch (error) {
    console.error("Question generation error:", error);
    return [];
  }
}

// Parse syllabus and extract topics
export async function parseSyllabusContent(content) {
  const prompt = `Analyze this syllabus/course content and extract structured topics.

Content:
${content.substring(0, 4000)}

Return JSON:
{
  "topics": [
    {
      "name": "Topic Name",
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "estimatedHours": 4,
      "importance": "high/medium/low"
    }
  ],
  "totalEstimatedHours": 40,
  "courseLevel": "beginner/intermediate/advanced"
}`;

  try {
    const result = await generateJSON(prompt, { maxTokens: 1500 });
    return result;
  } catch (error) {
    console.error("Syllabus parsing error:", error);
    return { topics: [], totalEstimatedHours: 0, courseLevel: "intermediate" };
  }
}

// Analyze performance and identify weak areas
export async function analyzePerformance(topicPerformance) {
  const prompt = `Analyze this student's performance data and provide insights:

${JSON.stringify(topicPerformance, null, 2)}

Return JSON:
{
  "weakAreas": [
    {
      "topic": "Topic name",
      "accuracy": 45,
      "issues": ["Specific issue 1", "Specific issue 2"],
      "recommendations": ["Study suggestion 1", "Practice suggestion 2"],
      "priority": "high/medium/low"
    }
  ],
  "strengths": ["Strong topic 1", "Strong topic 2"],
  "overallAssessment": "Brief overall assessment",
  "studyPlan": "Recommended study approach"
}`;

  try {
    return await generateJSON(prompt, { maxTokens: 1000 });
  } catch (error) {
    console.error("Performance analysis error:", error);
    return { weakAreas: [], strengths: [], overallAssessment: "", studyPlan: "" };
  }
}
