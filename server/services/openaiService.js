import { generateJSON } from "../config/openai.js";
import { retrieveRelevantChunks } from "./ragService.js";
import { getBloomPromptInstructions } from "../utils/bloomTaxonomy.js";

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

function ensureMeaningfulString(value, label, minLength) {
  if (typeof value !== "string" || value.trim().length < minLength) {
    throw new Error(`${label} must contain at least ${minLength} meaningful characters.`);
  }
}

function ensureStringArray(value, label, minItems) {
  if (!Array.isArray(value) || value.length < minItems) {
    throw new Error(`${label} must contain at least ${minItems} item(s).`);
  }

  value.forEach((item, index) => {
    ensureMeaningfulString(item, `${label}[${index}]`, 3);
  });
}

function ensureObjectArray(value, label, minItems) {
  if (!Array.isArray(value) || value.length < minItems) {
    throw new Error(`${label} must contain at least ${minItems} item(s).`);
  }

  value.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${label}[${index}] must be an object.`);
    }
  });
}

// Generate study material content
export async function generateStudyContent(topic, mode, syllabusContext = "", filter = {}) {
  const modeConfig = {
    short: {
      words: "500-800",
      maxTokens: 3000,
      model: DEFAULT_OPENAI_MODEL,
      instruction: "definitions of main concepts, 1-2 practical examples per concept, and sample code/formulae for relevant subtopics.",
    },
    intermediate: {
      words: "800-1200",
      maxTokens: 3000,
      model: DEFAULT_OPENAI_MODEL,
      instruction: "detailed explanations with examples",
    },
    pro: {
      words: "1000-1500",
      maxTokens: 8192,
      model: DEFAULT_OPENAI_MODEL,
      instruction: "comprehensive and detailed coverage",
    },
  };

  const config = modeConfig[mode] || modeConfig.intermediate;

  // New: Get textbook context from RAG (Pinecone) to anchor the AI and prevent hallucinations
  console.log(`[Study Content] Retrieving RAG context for topic: ${topic}`);
  const chunks = await retrieveRelevantChunks(topic, filter, 8, { failSilently: true });
  const scrapedContext = chunks.map((c, i) => `--- Textbook Excerpt ${i + 1} (from "${c.fileName}", ~p.${c.pageEstimate}, relevance: ${(c.score * 100).toFixed(1)}%) ---\n${c.text}`).join("\n\n");

  const proModeEnhancement = mode === "pro" ? `
Provide a comprehensive explanation covering:
1. Core concepts and definitions
2. Key principles and theory
3. Real-world examples
4. Important implementation details (if technical)
5. Exam-relevant key points

Focus on clarity and depth.
` : "";

  const shortModeEnhancement = mode === "short" ? `
CRITICAL: You are in SHORT mode, which is intended for last-minute revision.
Your output must enforce strict quality constraints based on the type of content, not just length.

Requirements for SHORT mode:
1. Provide clear, concise definitions for all main concepts present in the subtopics of the syllabus.
2. Provide at least one or two practical examples for EVERY important concept you define.
3. If the topic involves mathematical formulae, YOU MUST include them using LaTeX.
4. If the topic is code-intensive or programming-related, YOU MUST provide one sample code snippet for each important subtopic.
5. DO NOT generate a separate "Key Points" section or array. The generated content itself should serve as the key points.
6. ABSOLUTELY NO EMOJIS. The material is used for highly professional and important purposes.
7. Include relevant images from the scraped context formatted as Markdown \`![description](url)\` to make concepts much easier to understand.

DO NOT generate unnecessary generic introductions or fluff. Focus strictly on definitions, examples, and formulas/code.
The total length of your output must be concise but comprehensive enough to meet the above constraints. Ensure your JSON object is fully completed and properly closed to prevent truncation errors.
` : "";

  const prompt = `Create study material about "${topic}".
  
${syllabusContext ? `Syllabus context:\n${syllabusContext.substring(0, 500)}\n` : ""}

Use the following excerpt(s) from the student's actual course textbook to ground your answer and ensure accuracy:
---START SCRAPED CONTEXT---
${scrapedContext}
---END SCRAPED CONTEXT---

${proModeEnhancement}
${shortModeEnhancement}

Requirements:
- Length: approx ${config.words} words
- Style: ${config.instruction}
- Use HTML tags for formatting: <p> for paragraphs, <ul>/<li> for lists, <strong> for emphasis.
- Every requested section must be fully written with meaningful matter. Do not leave any heading, subsection, or field empty.
- Never use placeholders such as "content here", "example", "...", or generic filler text.
- Each section must contain enough detail to render properly in the application without appearing thin or unfinished.
- **IMPORTANT**: If the textbook context contains images formatted as \`[IMAGE URL: ... | DESCRIPTION: ...]\`, you MUST include these relevant images directly in your HTML content using Markdown image syntax: \`![DESCRIPTION](IMAGE URL)\`. Place them neatly under the most appropriate heading/topic to improve readability and conceptual understanding.
- **IMPORTANT**: For mathematical formulas, equations, or scientific notation, YOU MUST USE LaTeX.
  - Use $...$ for inline math (e.g., $E=mc^2$).
  - Use $$...$$ for block math equations.
  - **CRITICAL**: To avoid JSON formatting errors, you MUST NOT use backslashes (\\) in your LaTeX or anywhere in the string values.
  - Instead, use the placeholder "|||" for every single backslash.
  - Example: Use "|||frac{1}{2}" instead of "\\frac{1}{2}" or "\\\\frac{1}{2}".
- Example: Use "|||alpha" instead of "\\alpha".
- Our system will automatically convert "|||" back to the correct backslash.
- **GUIDELINE**: For theoretical or non-technical subjects, avoid code snippets. However, if the topic is technical (e.g., programming), you MUST include relevant code examples.
- If code examples are included, they must be consistent with the explanation and must not contradict the stated input/output or surrounding text.
- **TONE & FORMATTING**: The generated content MUST be highly professional and authentic. Do NOT use any emojis, emoticons, or overly casual language anywhere in the response. Maintain an academic and serious tone throughout.
- Ensure proper spacing and alignment. Structure the HTML using hierarchical headers (<h3>, <h4>) where appropriate to make it visually appealing and contextually integrate the images inside the sections.
- Before finalizing, self-check that all required JSON fields are present and filled with meaningful, non-empty content.

Return as a JSON object strictly matching the schema provided. Do not deviate. Ensure that JSON is valid and completed.`;

  const schema = {
    type: "OBJECT",
    properties: {
      content: { type: "STRING", description: "Full HTML content here..." },
      sections: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Section Title" },
            content: { type: "STRING", description: "Section HTML content with tags like <p>, <ul>, <li>, <strong>, and importantly markdown `![alt](url)` for images" },
            ...(mode !== "short" ? {
              keyPoints: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Array of key points summarizing the section.",
              }
            } : {})
          },
          required: mode === "short" ? ["title", "content"] : ["title", "content", "keyPoints"]
        }
      }
    },
    required: ["content", "sections"]
  };

  // Explicitly remove keyPoints property from schema if short mode to strictly enforce it
  if (mode === "short") {
    delete schema.properties.sections.items.properties.keyPoints;
  }

  try {
    const result = await generateJSON(prompt, {
      maxTokens: config.maxTokens,
      model: config.model,
      fallbackContext: scrapedContext,
      schema: schema,
      attempts: 2,
      postValidate: (parsed) => {
        ensureMeaningfulString(parsed.content, "content", 150);
        ensureObjectArray(parsed.sections, "sections", 1);
        parsed.sections.forEach((section, index) => {
          ensureMeaningfulString(section.title, `sections[${index}].title`, 3);
          ensureMeaningfulString(section.content, `sections[${index}].content`, 80);
          if (mode !== "short") {
            ensureStringArray(section.keyPoints, `sections[${index}].keyPoints`, 2);
          }
        });
      }
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
    existingQuestions = [],
    bloomLevel = null,
  } = options;

  const isDescriptive = type === "descriptive";

  // Retrieve textbook chunks from RAG instead of web scraping
  console.log(`[Question Generation] Retrieving RAG context for topic: ${topic}${bloomLevel ? ` | Bloom: ${bloomLevel}` : ''}`);
  const chunks = await retrieveRelevantChunks(topic, options.filter || {}, 5, { failSilently: true });
  const scrapedContext = chunks.map((c, i) => `--- Textbook Excerpt ${i + 1} (from "${c.fileName}", ~p.${c.pageEstimate}, relevance: ${(c.score * 100).toFixed(1)}%) ---\n${c.text}`).join("\n\n");

  // Build Bloom's Taxonomy prompt section if a level is specified
  const bloomInstructions = bloomLevel
    ? getBloomPromptInstructions(bloomLevel, isDescriptive ? "descriptive" : "mcq")
    : "";

  // Build the existing-questions exclusion block (increased to last 50 for better dedup)
  const exclusionBlock = existingQuestions.length > 0
    ? `\nCRITICAL: To ensure uniqueness, DO NOT reuse the following concepts, questions, or exact phrasing. You must generate entirely new and distinct questions:\n${existingQuestions.slice(-50).map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
    : '';

  let prompt;
  let schema;

  if (isDescriptive) {
    prompt = `Generate ${count} ${difficulty} difficulty descriptive (short/long answer) questions about "${topic}".
    
Feel free to use the following excerpts from the student's textbook to inspire or ground your questions:
---START CONTEXT---
${scrapedContext}
---END CONTEXT---
${bloomInstructions}${exclusionBlock}
Requirements:
- Questions should test deep understanding and analytical thinking
- Include a mix of conceptual, application-based, and explanation questions
- Provide a comprehensive model answer for each question
- Provide a clear explanation of key points the answer should cover
- Each question must be substantially different from the others — vary the angle, scope, and cognitive demand
- NEVER generate two questions that ask essentially the same thing with different wording

Return as a JSON object strictly matching the provided schema.`;

    schema = {
      type: "OBJECT",
      properties: {
        questions: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              question: { type: "STRING", description: "Question text" },
              correctAnswer: { type: "STRING", description: "Comprehensive model answer text that covers all key points" },
              explanation: { type: "STRING", description: "Key points: 1) ... 2) ... 3) ..." },
              difficulty: { type: "STRING", description: "Difficulty of the question" },
              topic: { type: "STRING", description: "Topic of the question" },
              bloomLevel: { type: "STRING", description: "Bloom's Taxonomy level: remember, understand, apply, analyze, evaluate, or create" },
            },
            required: ["question", "correctAnswer", "explanation", "difficulty", "topic", "bloomLevel"]
          }
        }
      },
      required: ["questions"]
    };
  } else {
    prompt = `Generate ${count} ${difficulty} difficulty ${type.toUpperCase()} questions about "${topic}".
    
Feel free to use the following excerpts from the student's textbook to inspire or ground your questions:
---START CONTEXT---
${scrapedContext}
---END CONTEXT---
${bloomInstructions}${exclusionBlock}
Requirements:
- Questions should test understanding, not just memorization
- Include a mix of conceptual and application-based questions
- Each question should have 4 options for MCQs
- Provide clear explanations for correct answers
- Each question must be substantially different from the others — vary the angle, scope, and cognitive demand
- NEVER generate two questions that ask essentially the same thing with different wording

Return as a JSON object strictly matching the provided schema.`;

    schema = {
      type: "OBJECT",
      properties: {
        questions: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              question: { type: "STRING", description: "Question text" },
              options: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    label: { type: "STRING", description: "A, B, C, D" },
                    text: { type: "STRING", description: "Option text" }
                  },
                  required: ["label", "text"]
                }
              },
              correctAnswer: { type: "STRING", description: "A, B, C, or D" },
              explanation: { type: "STRING", description: "Why this is correct" },
              difficulty: { type: "STRING", description: "Difficulty of the question" },
              topic: { type: "STRING", description: "Topic of the question" },
              bloomLevel: { type: "STRING", description: "Bloom's Taxonomy level: remember, understand, apply, analyze, evaluate, or create" },
            },
            required: ["question", "options", "correctAnswer", "explanation", "difficulty", "topic", "bloomLevel"]
          }
        }
      },
      required: ["questions"]
    };
  }

  try {
    const response = await generateJSON(prompt, {
      maxTokens: isDescriptive ? 4000 : 3500,
      schema: schema,
      fallbackContext: isDescriptive ?
        `{"questions": [{"question": "What is ${topic}?", "correctAnswer": "${scrapedContext.substring(0, 500)}", "explanation": "Fallback context used.", "difficulty": "${difficulty}", "topic": "${topic}", "bloomLevel": "${bloomLevel || "understand"}"}]}`
        :
        `{"questions": [{"question": "What is the primary focus of ${topic}?", "options": [{"label": "A", "text": "Relevant concept"}, {"label": "B", "text": "Other concept"}, {"label": "C", "text": "Wrong idea"}, {"label": "D", "text": "Invalid"}], "correctAnswer": "A", "explanation": "Fallback contextual response", "difficulty": "${difficulty}", "topic": "${topic}", "bloomLevel": "${bloomLevel || "understand"}"}]}`
    });
    const questions = response.questions || response;
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

Return JSON object adhering to the schema.`;

  const syllabusSchema = {
    type: "OBJECT",
    properties: {
      topics: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            subtopics: { type: "ARRAY", items: { type: "STRING" } },
            estimatedHours: { type: "NUMBER" },
            importance: { type: "STRING", description: "high/medium/low" }
          },
          required: ["name", "subtopics", "estimatedHours", "importance"]
        }
      },
      totalEstimatedHours: { type: "NUMBER" },
      courseLevel: { type: "STRING", description: "beginner/intermediate/advanced" }
    },
    required: ["topics", "totalEstimatedHours", "courseLevel"]
  };

  try {
    const result = await generateJSON(prompt, { maxTokens: 1500, schema: syllabusSchema });
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

Return JSON complying to the schema.`;

  const performanceSchema = {
    type: "OBJECT",
    properties: {
      weakAreas: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            topic: { type: "STRING" },
            accuracy: { type: "NUMBER" },
            issues: { type: "ARRAY", items: { type: "STRING" } },
            recommendations: { type: "ARRAY", items: { type: "STRING" } },
            priority: { type: "STRING", description: "high/medium/low" }
          },
          required: ["topic", "accuracy", "issues", "recommendations", "priority"]
        }
      },
      strengths: { type: "ARRAY", items: { type: "STRING" } },
      overallAssessment: { type: "STRING" },
      studyPlan: { type: "STRING" }
    },
    required: ["weakAreas", "strengths", "overallAssessment", "studyPlan"]
  };

  try {
    return await generateJSON(prompt, { maxTokens: 1000, schema: performanceSchema });
  } catch (error) {
    console.error("Performance analysis error:", error);
    return { weakAreas: [], strengths: [], overallAssessment: "", studyPlan: "" };
  }
}

// Evaluate a descriptive answer against the model answer
export async function evaluateDescriptiveAnswer({ question, modelAnswer, userAnswer }) {
  const prompt = `You are an expert examiner. Evaluate the student's answer against the model answer.

Question: "${question}"

Model Answer: "${modelAnswer}"

Student's Answer: "${userAnswer}"

Evaluate how well the student's answer covers the key points in the model answer. 
Be objective and strict. The score should reflect the exact coverage of facts.
If the student's answer is completely unrelated, give a 0.

Return ONLY a raw JSON object strictly matching the provided schema. Do NOT wrap it in markdown.`;

  const evalSchema = {
    type: "OBJECT",
    properties: {
      score: { type: "NUMBER", description: "0-10" },
      percentage: { type: "NUMBER", description: "0-100" },
      feedback: { type: "STRING", description: "Brief 1-2 sentence feedback" },
      keyPointsCovered: { type: "NUMBER" },
      totalKeyPoints: { type: "NUMBER" }
    },
    required: ["score", "percentage", "feedback", "keyPointsCovered", "totalKeyPoints"]
  };

  try {
    const result = await generateJSON(prompt, {
      maxTokens: 2000,
      // forceModel: "groq", // No longer needed — single OpenRouter provider
      schema: evalSchema
    });
    return {
      score: Math.min(10, Math.max(0, result.score || 0)),
      percentage: Math.min(100, Math.max(0, result.percentage || 0)),
      feedback: result.feedback || "",
      keyPointsCovered: result.keyPointsCovered || 0,
      totalKeyPoints: result.totalKeyPoints || 0,
    };
  } catch (error) {
    console.error("Descriptive evaluation error:", error);
    return null;
  }
}
