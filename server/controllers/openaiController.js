import { generateCompletion, generateJSON } from "../config/openai.js";
import { retrieveRelevantChunks } from "../services/ragService.js";

// Generate study material using OpenAI (single API call - for short mode)
export async function generateMaterial(req, res) {
    try {
        const { topic, mode = "intermediate", context, syllabusId } = req.body;
        const userId = req.user.userId;

        if (!topic) {
            return res.status(400).json({ error: "Topic is required" });
        }

        const modeDescriptions = {
            short: "concise summary with key points (200-300 words total)",
            intermediate: "detailed explanation with examples (500-700 words total)",
            pro: "comprehensive deep-dive with advanced concepts (1000+ words total)",
        };

        // Retrieve context using RAG
        console.log(`[Material] Retrieving RAG context for topic: ${topic}`);
        const chunks = await retrieveRelevantChunks(topic, { userId, syllabusId }, 5);
        const scrapedContext = chunks.map((c, i) => `--- Textbook Excerpt ${i + 1} (from "${c.fileName}", ~p.${c.pageEstimate}, relevance: ${(c.score * 100).toFixed(1)}%) ---\n${c.text}`).join("\n\n");

        const prompt = `Generate educational study material about "${topic}" in ${modeDescriptions[mode]} format. Make it a nice and well-formatted document for student preparation.

${context ? `Context from syllabus: ${context.substring(0, 500)}` : ""}

Use the following excerpt(s) from the student's actual course textbook to ground your answer. Note: The material produced from this textbook context is very important for students, and it's very essential to generate coherent, high-quality content.
---START TEXTBOOK CONTEXT---
${scrapedContext}
---END TEXTBOOK CONTEXT---

Return a JSON object with this exact structure:
{
    "sections": [
        {
            "title": "Introduction/Overview",
            "content": "Content for this section in markdown...",
            "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
        },
        {
            "title": "Key Concepts",
            "content": "Content explaining key concepts...",
            "keyPoints": ["Key point 1", "Key point 2"]
        },
        {
            "title": "Detailed Explanation", 
            "content": "In-depth explanation with examples...",
            "keyPoints": ["Key point 1", "Key point 2"]
        },
        {
            "title": "Summary/Key Takeaways",
            "content": "Summary of the material...",
            "keyPoints": ["Takeaway 1", "Takeaway 2"]
        }
    ]
}

Make sure each section has meaningful educational content. The content field should use Markdown formatting. Key points should be short, memorable bullet points.`;

        const result = await generateJSON(prompt, {
            maxTokens: mode === "pro" ? 1500 : mode === "intermediate" ? 800 : 400,
        });

        // Ensure we have a valid sections array
        const sections = result.sections || [];

        // Build a combined content string for reading time calculation
        const fullContent = sections.map(s => s.content).join('\n\n');

        res.json({
            material: {
                topic,
                mode,
                content: fullContent,
                sections: sections,
                createdAt: new Date().toISOString(),
            }
        });
    } catch (error) {
        console.error("Generate material error:", error);
        res.status(500).json({ error: "Failed to generate material" });
    }
}

// Generate comprehensive study material using parallel API calls per subtopic
export async function generateComprehensiveMaterial(req, res) {
    try {
        const { topic, subtopics = [], mode = "intermediate", syllabusId } = req.body;
        const userId = req.user.userId;

        if (!topic) {
            return res.status(400).json({ error: "Topic is required" });
        }

        const topicsToGenerate = subtopics.length > 0 ? subtopics : [topic];

        // Use AI to classify which subtopics are code-intensive (single batched call)
        const classifyTopics = async (mainTopic, subtopicList) => {
            const classificationPrompt = `You are a topic classifier. For each subtopic under the main topic "${mainTopic}", determine whether it is a programming/software topic that requires runnable code examples in its study material.

Subtopics to classify:
${JSON.stringify(subtopicList)}

Return JSON: {"classifications": [{"subtopic": "exact subtopic name", "isCodeIntensive": true or false}]}

Rules:
- Mark "isCodeIntensive" as true ONLY if the subtopic is genuinely about software development, programming, or computer science concepts best taught with runnable code.
- Topics from subjects like geography, political science, history, biology, economics, law, etc. are NEVER code intensive, even if they contain words like "functions", "tree", "graph", "loop", "class", "object", "go", "chain", or "web".
- Consider the main topic "${mainTopic}" as context when deciding.`;

            try {
                const result = await generateJSON(classificationPrompt, { maxTokens: 50 + (subtopicList.length * 30) });
                const map = {};
                (result.classifications || []).forEach(c => {
                    map[c.subtopic] = c.isCodeIntensive === true;
                });
                return map;
            } catch (err) {
                console.error("Topic classification failed, defaulting to non-code:", err.message);
                const map = {};
                subtopicList.forEach(s => { map[s] = false; });
                return map;
            }
        };

        // Mode configurations with different token budgets and content depth
        const modeConfig = {
            short: {
                words: "150-250",
                conceptTokens: 800,
                codeTokens: 800,
                codeExamples: 1,
                includeAdvanced: false
            },
            intermediate: {
                words: "400-600",
                conceptTokens: 1500,
                codeTokens: 1500,
                codeExamples: 2,
                includeAdvanced: false
            },
            pro: {
                words: "700-1000",
                conceptTokens: 3000,
                codeTokens: 3000,
                advancedTokens: 3000,
                codeExamples: 3,
                includeAdvanced: true
            },
        };

        const config = modeConfig[mode] || modeConfig.intermediate;

        // Classify all subtopics in one batched AI call before generating content
        const classificationMap = await classifyTopics(topic, topicsToGenerate);

        // Retrieve context using RAG
        console.log(`[Comprehensive] Retrieving RAG context for topic: ${topic}`);
        const chunks = await retrieveRelevantChunks(topic, { userId, syllabusId }, 8);
        const scrapedContext = chunks.map((c, i) => `--- Textbook Excerpt ${i + 1} (from "${c.fileName}", ~p.${c.pageEstimate}, relevance: ${(c.score * 100).toFixed(1)}%) ---\n${c.text}`).join("\n\n");

        // Build a reusable instruction block for all prompts
        const contextInstruction = `
Note: The material produced from this textbook context is very important for students, and it's very essential to generate coherent, high-quality, and well-formatted content.
---START TEXTBOOK CONTEXT---
${scrapedContext}
---END TEXTBOOK CONTEXT---
`;

        console.log(`Generating ${mode.toUpperCase()} material for "${topic}" with ${topicsToGenerate.length} subtopics`);
        console.log(`  Classification results:`, classificationMap);

        // Execute subtopics sequentially with a 2-second delay to firmly avoid rate limit exhaustion
        const subtopicResults = [];
        for (let index = 0; index < topicsToGenerate.length; index++) {
            const subtopic = topicsToGenerate[index];
            const isCode = classificationMap[subtopic] === true;

            console.log(`  [${index + 1}/${topicsToGenerate.length}] "${subtopic}" - Code: ${isCode}, Mode: ${mode}`);

            if (isCode) {
                // CONCEPT PROMPT - varies by mode
                const conceptPrompt = mode === 'pro'
                    ? `You are a helpful educator. Provide a comprehensive explanation of "${subtopic}" (topic: "${topic}"). Make it a nice and well-formatted document for student preparation.
Explain everything clearly and specifically.

${contextInstruction}

Write around ${config.words} words covering:
1. What it is and why it matters
2. How it works internally (detailed step-by-step logic)
3. When, where, and why to use it
4. Advantages and disadvantages
5. Detailed comparison with alternatives if applicable
6. Crucial Mathematical or Technical Formulae MUST be included if relevant to the topic. Wrap block formulae in $$ ... $$ and inline formulae in $ ... $ for proper LaTeX rendering.

Requirements:
- ABSOLUTELY NO EMOJIS. Maintain a highly professional and authentic academic tone.
- Format the content strictly using rich Markdown (## for headers, * for lists, bolding for emphasis). Do NOT use raw HTML.
- **CRITICAL**: To avoid JSON formatting errors, you MUST NOT use backslashes (\\) in your LaTeX or anywhere in the string values.
- Instead, use the placeholder "|||" for every single backslash (e.g. use "|||frac{1}{2}" instead of "\\frac{1}{2}" or "\\\\frac{1}{2}", and "|||begin" instead of "\\begin").

Return JSON: {"title":"${subtopic}","overview":"3-4 sentence intro","content":"Well-formatted explanation in Markdown","keyPoints":["point 1","point 2","point 3","point 4","point 5"]}`
                    : `Provide a clear explanation of "${subtopic}" (topic: "${topic}") in around ${config.words} words for student preparation. Make it a nice and well-formatted document.

${contextInstruction}

Requirements:
- MUST include clear definitions.
- MUST include a few practical examples.
- IF it is a component: include "Advantages" and "Disadvantages" sections.
- IF it is a process/working mechanism: include a "Working Process" section.
- IF it is an algorithm: include "Method of implementation", "Advantages", "Disadvantages", "Input", and "Output" conceptual sections.
- ABSOLUTELY NO EMOJIS. Maintain strictly professional and academic tone.
- ENSURE depth of explanation is consistent and not rushed.
- Format the content using rich Markdown (e.g. ### for headers, * for lists, bolding for key terms). DO NOT use raw HTML tags.

Return JSON: {"title":"${subtopic}","overview":"2-3 sentence intro","content":"Well-formatted markdown explanation","keyPoints":["point 1","point 2","point 3"]}`;

                // CODE PROMPT - more examples for Pro
                const codePrompt = mode === 'pro'
                    ? `Write ${config.codeExamples} code examples for "${subtopic}" with varying complexities. Make them clear and well-formatted for students.

Example 1: Basic introductory implementation
Example 2: Practical real-world usage
Example 3: Advanced/optimized version

Return JSON:
{"codeExamples":[
  {"title":"Example name","code":"# clearly commented code\\n...","input":"Example input if applicable","output":"Exact output produced by the code","explanation":"Clear step-by-step logic explanation"}
]}

Requirements:
- Each example must be complete, runnable, and perfectly accurate.
- Include an explicitly separated 'input' and 'output' string block in the JSON if relevant.
- ABSOLUTELY NO EMOJIS. Professional academic tone only.
- **CRITICAL**: To avoid JSON formatting errors, you MUST NOT use backslashes (\\) in your LaTeX or anywhere in the string values. Instead, use the placeholder "|||" for every single backslash (e.g. use "|||frac{1}{2}" instead of "\\frac{1}{2}").`
                    : `Write ${config.codeExamples} clear code examples for "${subtopic}".

Requirements:
- The code MUST be clearly commented, explaining the logic.
- Include a specific section for Input and Output. Output MUST be correct as per the code.
- NO EMOJIS. Professional tone.

Return JSON: {"codeExamples":[{"title":"name","code":"# clearly commented code","input":"Example input provided to the code","output":"Exact output produced by the code","explanation":"Clear explanation of the code logic"}]}`;

                try {
                    // Define strict schema bounds to ensure AI doesn't return empty layout
                    const conceptSchema = {
                        type: "OBJECT",
                        properties: {
                            title: { type: "STRING" },
                            overview: { type: "STRING" },
                            content: { type: "STRING" },
                            keyPoints: { type: "ARRAY", items: { type: "STRING" } }
                        },
                        required: ["title", "overview", "content", "keyPoints"]
                    };

                    const codeSchema = {
                        type: "OBJECT",
                        properties: {
                            codeExamples: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        title: { type: "STRING" },
                                        code: { type: "STRING" },
                                        input: { type: "STRING" },
                                        output: { type: "STRING" },
                                        explanation: { type: "STRING" }
                                    },
                                    required: ["title", "code"]
                                }
                            }
                        },
                        required: ["codeExamples"]
                    };

                    // Build array of promises based on mode for a single subtopic
                    const apiCalls = [
                        generateJSON(conceptPrompt, { maxTokens: config.conceptTokens, schema: conceptSchema }),
                        generateJSON(codePrompt, { maxTokens: config.codeTokens, schema: codeSchema })
                    ];

                    // PRO MODE: Add third API call for advanced content
                    if (config.includeAdvanced && mode === 'pro') {
                        const advancedPrompt = `Provide advanced professional insights for "${subtopic}" (topic: "${topic}").

Cover these exact sections in supreme detail:
1. Common Mistakes & How to Avoid Them
2. Best Practices & Design Patterns
3. Performance Considerations & Optimizations
4. Edge Cases to Handle
5. Interview Tips (if applicable)

Requirements:
- ABSOLUTELY NO EMOJIS in any of the returned strings.

Return JSON:
{"advanced":{
  "commonMistakes":["mistake 1 with detailed explanation","mistake 2"],
  "bestPractices":["practice 1","practice 2","practice 3"],
  "performance":"In-depth performance analysis and optimization tips",
  "edgeCases":["edge case 1","edge case 2"],
  "tips":"Additional academic tips for absolute mastery"
}}`;

                        const advancedSchema = {
                            type: "OBJECT",
                            properties: {
                                advanced: {
                                    type: "OBJECT",
                                    properties: {
                                        commonMistakes: { type: "ARRAY", items: { type: "STRING" } },
                                        bestPractices: { type: "ARRAY", items: { type: "STRING" } },
                                        performance: { type: "STRING" },
                                        edgeCases: { type: "ARRAY", items: { type: "STRING" } },
                                        tips: { type: "STRING" }
                                    },
                                    required: ["commonMistakes", "bestPractices"]
                                }
                            },
                            required: ["advanced"]
                        };
                        apiCalls.push(generateJSON(advancedPrompt, { maxTokens: config.advancedTokens, schema: advancedSchema }));
                    }

                    // Execute all API calls for THIS SUBTOPIC in parallel
                    const results = await Promise.all(apiCalls);
                    const conceptResult = results[0];
                    const codeResult = results[1];
                    const advancedResult = results[2]; // undefined for non-pro

                    // Build content
                    let fullContent = conceptResult.content || "";

                    // Add code examples
                    if (codeResult.codeExamples && codeResult.codeExamples.length > 0) {
                        fullContent += "\n\n## Code Examples\n\n";
                        codeResult.codeExamples.forEach((ex, i) => {
                            const title = ex.title || `Example ${i + 1}`;
                            fullContent += `### ${title}\n\n`;
                            fullContent += "```python\n" + (ex.code || "# Code here") + "\n```\n\n";
                            if (ex.input) {
                                fullContent += `**Input:**\n\`\`\`\n${ex.input}\n\`\`\`\n\n`;
                            }
                            if (ex.output) {
                                fullContent += `**Output:**\n\`\`\`\n${ex.output}\n\`\`\`\n\n`;
                            }
                            if (ex.explanation) {
                                fullContent += `**Explanation:** ${ex.explanation}\n\n`;
                            }
                        });
                    }

                    // Add advanced content for Pro mode
                    if (advancedResult && advancedResult.advanced) {
                        const adv = advancedResult.advanced;

                        fullContent += "\n\n## Advanced Insights\n\n";

                        if (adv.commonMistakes && adv.commonMistakes.length > 0) {
                            fullContent += "### Common Mistakes\n\n";
                            adv.commonMistakes.forEach(m => {
                                fullContent += `- ${m}\n`;
                            });
                            fullContent += "\n";
                        }

                        if (adv.bestPractices && adv.bestPractices.length > 0) {
                            fullContent += "### Best Practices\n\n";
                            adv.bestPractices.forEach(p => {
                                fullContent += `- ${p}\n`;
                            });
                            fullContent += "\n";
                        }

                        if (adv.performance) {
                            fullContent += "### Performance Tips\n\n";
                            fullContent += adv.performance + "\n\n";
                        }

                        if (adv.edgeCases && adv.edgeCases.length > 0) {
                            fullContent += "### Edge Cases\n\n";
                            adv.edgeCases.forEach(e => {
                                fullContent += `- ${e}\n`;
                            });
                            fullContent += "\n";
                        }

                        if (adv.tips) {
                            fullContent += "### Pro Tips\n\n";
                            fullContent += adv.tips + "\n";
                        }
                    }

                    subtopicResults.push({
                        order: index,
                        subtopic,
                        title: conceptResult.title || subtopic,
                        overview: conceptResult.overview || "",
                        content: fullContent,
                        keyPoints: conceptResult.keyPoints || [],
                        examples: codeResult.codeExamples?.map(ex => ex.title) || [],
                        isCodeIntensive: true,
                        success: true,
                    });
                } catch (err) {
                    console.error(`Failed for "${subtopic}":`, err.message);
                    subtopicResults.push({
                        order: index,
                        subtopic,
                        title: subtopic,
                        overview: "",
                        content: "Content generation failed. Please try again.",
                        keyPoints: [],
                        examples: [],
                        isCodeIntensive: true,
                        success: false,
                    });
                }
            } else {
                // Non-code topics
                const prompt = mode === 'pro'
                    ? `You are a helpful educator. Provide a comprehensive explanation of "${subtopic}" (topic: "${topic}") in around ${config.words} words. Make it a nice and well-formatted document for student preparation.
Explain everything clearly and specifically.

${contextInstruction}

Cover all aspects with clear practical examples.
Crucial Mathematical or Technical Formulae MUST be included if relevant to the topic. Wrap block formulae in $$ ... $$ and inline formulae in $ ... $ for proper LaTeX rendering.

Requirements:
- ABSOLUTELY NO EMOJIS. Maintain a highly professional and authentic academic tone.
- Format the content strictly using rich Markdown (## for headers, * for lists, bolding for emphasis). Do NOT use raw HTML.
- **CRITICAL**: To avoid JSON formatting errors, you MUST NOT use backslashes (\\) in your LaTeX or anywhere in the string values.
- Instead, use the placeholder "|||" for every single backslash (e.g. use "|||frac{1}{2}" instead of "\\frac{1}{2}" or "\\\\frac{1}{2}", and "|||begin" instead of "\\begin").

Return JSON: {"title":"${subtopic}","overview":"3-4 sentence intro","content":"Well-formatted explanation in Markdown","keyPoints":["point 1","point 2","point 3","point 4","point 5"],"examples":["example 1","example 2","example 3"]}`
                    : `Provide a clear explanation of "${subtopic}" (topic: "${topic}") in around ${config.words} words for student preparation. Make it a nice and well-formatted document.

${contextInstruction}

Requirements:
- MUST include clear definitions.
- MUST include a few practical examples.
- IF it is a component: include "Advantages" and "Disadvantages" sections.
- IF it is a process/working mechanism: include "Working Process" section.
- ABSOLUTELY NO EMOJIS. Maintain strictly professional and academic tone.
- ENSURE depth of explanation is consistent and not arbitrarily shortened.
- Format the content using rich Markdown (e.g. ### for headers, * for bullets, bolding for emphasis). DO NOT use raw HTML.

Return JSON: {"title":"${subtopic}","overview":"2-3 sentence intro","content":"Well-formatted markdown explanation","keyPoints":["p1","p2","p3"],"examples":["ex1","ex2"]}`;

                try {
                    const noCodeSchema = {
                        type: "OBJECT",
                        properties: {
                            title: { type: "STRING" },
                            overview: { type: "STRING" },
                            content: { type: "STRING" },
                            keyPoints: { type: "ARRAY", items: { type: "STRING" } },
                            examples: { type: "ARRAY", items: { type: "STRING" } }
                        },
                        required: ["title", "overview", "content", "keyPoints", "examples"]
                    };

                    const result = await generateJSON(prompt, { maxTokens: config.conceptTokens, schema: noCodeSchema });
                    subtopicResults.push({
                        order: index,
                        subtopic,
                        title: result.title || subtopic,
                        overview: result.overview || "",
                        content: result.content || "",
                        keyPoints: result.keyPoints || [],
                        examples: result.examples || [],
                        isCodeIntensive: false,
                        success: true,
                    });
                } catch (err) {
                    console.error(`Failed for "${subtopic}":`, err.message);
                    subtopicResults.push({
                        order: index,
                        subtopic,
                        title: subtopic,
                        overview: "",
                        content: "Content generation failed.",
                        keyPoints: [],
                        examples: [],
                        isCodeIntensive: false,
                        success: false,
                    });
                }
            }

            // Optional: small delay to avoid blitzing the API if there are many topics
            if (index < topicsToGenerate.length - 1) {
                await new Promise(res => setTimeout(res, 2000));
            }
        }
        subtopicResults.sort((a, b) => a.order - b.order);

        const sections = subtopicResults.map(r => ({
            title: r.title,
            overview: r.overview,
            content: r.content,
            keyPoints: r.keyPoints,
            examples: r.examples,
            isCodeIntensive: r.isCodeIntensive,
        }));

        const fullContent = sections.filter(s => s.overview || s.content).map(s => `${s.overview || ""}\n\n${s.content || ""}`).join('\n\n');
        const successCount = subtopicResults.filter(r => r.success).length;
        const codeTopicsCount = subtopicResults.filter(r => r.isCodeIntensive).length;

        console.log(`✅ Generated ${successCount}/${topicsToGenerate.length} sections (${codeTopicsCount} code-intensive) in ${mode.toUpperCase()} mode`);

        res.json({
            material: {
                topic,
                mode,
                subtopicsCount: topicsToGenerate.length,
                successCount,
                codeTopicsCount,
                content: fullContent,
                sections,
                createdAt: new Date().toISOString(),
            }
        });
    } catch (error) {
        console.error("Generate comprehensive material error:", error);
        res.status(500).json({ error: "Failed to generate comprehensive material" });
    }
}

// Generate questions using OpenAI
export async function generateQuestionsAI(req, res) {
    try {
        const { topic, difficulty = "medium", count = 5, type = "mcq" } = req.body;

        if (!topic) {
            return res.status(400).json({ error: "Topic is required" });
        }

        const prompt = `Generate ${count} ${difficulty} difficulty ${type.toUpperCase()} questions about "${topic}".

Return as JSON array with this exact structure:
[
  {
    "text": "Question text here",
    "options": [
      { "label": "A", "text": "Option A text" },
      { "label": "B", "text": "Option B text" },
      { "label": "C", "text": "Option C text" },
      { "label": "D", "text": "Option D text" }
    ],
    "correctAnswer": "A",
    "explanation": "Brief explanation of why this is correct",
    "difficulty": "${difficulty}"
  }
]

Make questions educational and test genuine understanding, not just memorization.`;

        const questions = await generateJSON(prompt, {
            maxTokens: 2000,
        });

        res.json({
            topic,
            difficulty,
            questions: Array.isArray(questions) ? questions : [],
        });
    } catch (error) {
        console.error("Generate questions error:", error);
        res.status(500).json({ error: "Failed to generate questions" });
    }
}

// Parse syllabus content using OpenAI
export async function parseSyllabus(req, res) {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: "Content is required" });
        }

        const prompt = `Analyze this syllabus content and extract topics and subtopics.

Syllabus content:
${content.substring(0, 3000)}

Return as JSON with this structure:
{
  "topics": [
    {
      "name": "Main Topic Name",
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "estimatedHours": 5
    }
  ]
}

Extract all major topics and their subtopics. Estimate study hours based on topic complexity.`;

        const result = await generateJSON(prompt, {
            maxTokens: 1500,
        });

        res.json({
            topics: result.topics || [],
        });
    } catch (error) {
        console.error("Parse syllabus error:", error);
        res.status(500).json({ error: "Failed to parse syllabus" });
    }
}

// Analyze weak topics
export async function analyzeWeakness(req, res) {
    try {
        const { topicPerformance } = req.body;

        if (!topicPerformance || !Array.isArray(topicPerformance)) {
            return res.status(400).json({ error: "Topic performance data is required" });
        }

        const prompt = `Analyze this student's topic performance and provide recommendations:

Performance Data:
${JSON.stringify(topicPerformance, null, 2)}

Return JSON with this structure:
{
  "weakTopics": [
    {
      "topic": "Topic name",
      "currentAccuracy": 45,
      "recommendation": "Focus on specific area...",
      "priority": "high"
    }
  ],
  "strongTopics": ["Topic 1", "Topic 2"],
  "overallRecommendation": "General study advice..."
}`;

        const analysis = await generateJSON(prompt, {
            maxTokens: 1000,
        });

        res.json(analysis);
    } catch (error) {
        console.error("Analyze weakness error:", error);
        res.status(500).json({ error: "Failed to analyze weakness" });
    }
}
