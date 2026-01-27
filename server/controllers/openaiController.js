import { generateCompletion, generateJSON } from "../config/openai.js";

// Generate study material using OpenAI (single API call - for short mode)
export async function generateMaterial(req, res) {
    try {
        const { topic, mode = "intermediate", context } = req.body;

        if (!topic) {
            return res.status(400).json({ error: "Topic is required" });
        }

        const modeDescriptions = {
            short: "concise summary with key points (200-300 words total)",
            intermediate: "detailed explanation with examples (500-700 words total)",
            pro: "comprehensive deep-dive with advanced concepts (1000+ words total)",
        };

        const prompt = `Generate educational study material about "${topic}" in ${modeDescriptions[mode]} format.

${context ? `Context from syllabus: ${context.substring(0, 500)}` : ""}

Return a JSON object with this exact structure:
{
    "sections": [
        {
            "title": "Introduction/Overview",
            "content": "Content for this section as plain text...",
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

Make sure each section has meaningful educational content. The content field should be plain text paragraphs (not markdown or HTML). Key points should be short, memorable bullet points.`;

        const result = await generateJSON(prompt, {
            maxTokens: mode === "pro" ? 2000 : mode === "intermediate" ? 1000 : 500,
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
        const { topic, subtopics = [], mode = "intermediate" } = req.body;

        if (!topic) {
            return res.status(400).json({ error: "Topic is required" });
        }

        // Keywords that indicate code-intensive topics - narrowed to avoid false positives in theoretical subjects
        const codeKeywords = [
            'programming', 'coding', 'source code', 'script', 'snippet', 'implementation',
            'algorithm', 'data structure', 'software', 'developer', 'development',
            'python', 'java', 'javascript', 'c++', 'c#', 'ruby', 'go', 'rust', 'swift', 'php',
            'sql', 'nosql', 'database', 'query', 'schema',
            'html', 'css', 'react', 'angular', 'vue', 'node', 'express', 'django', 'flask',
            'api', 'rest', 'graphql', 'json', 'xml', 'yaml',
            'function', 'class', 'object', 'variable', 'loop', 'recursion', 'array', 'list', 'tree', 'graph',
            'git', 'terminal', 'shell', 'command', 'linux', 'bash'
        ];

        const isCodeIntensive = (topicName) => {
            const lower = topicName.toLowerCase();
            return codeKeywords.some(kw => lower.includes(kw));
        };

        const topicsToGenerate = subtopics.length > 0 ? subtopics : [topic];

        // Mode configurations with different token budgets and content depth
        const modeConfig = {
            short: {
                words: "150",
                conceptTokens: 600,
                codeTokens: 800,
                codeExamples: 1,
                includeAdvanced: false
            },
            intermediate: {
                words: "300",
                conceptTokens: 1000,
                codeTokens: 1500,
                codeExamples: 2,
                includeAdvanced: false
            },
            pro: {
                words: "500-600",
                conceptTokens: 1800,
                codeTokens: 2500,
                advancedTokens: 1500,
                codeExamples: 3,
                includeAdvanced: true
            },
        };

        const config = modeConfig[mode] || modeConfig.intermediate;

        console.log(`Generating ${mode.toUpperCase()} material for "${topic}" with ${topicsToGenerate.length} subtopics`);

        const subtopicPromises = topicsToGenerate.map(async (subtopic, index) => {
            const isCode = isCodeIntensive(subtopic) || isCodeIntensive(topic);

            console.log(`  [${index + 1}/${topicsToGenerate.length}] "${subtopic}" - Code: ${isCode}, Mode: ${mode}`);

            if (isCode) {
                // CONCEPT PROMPT - varies by mode
                const conceptPrompt = mode === 'pro'
                    ? `You are an expert educator. Provide a comprehensive, in-depth explanation of "${subtopic}" (topic: "${topic}").

Write ${config.words} words covering:
1. What it is and why it matters
2. How it works internally (step-by-step)
3. When and where to use it
4. Advantages and disadvantages
5. Comparison with alternatives if applicable

Return JSON: {"title":"${subtopic}","overview":"3-4 sentence comprehensive intro","content":"Detailed multi-paragraph explanation","keyPoints":["detailed point 1","detailed point 2","detailed point 3","detailed point 4","detailed point 5"]}`
                    : `Explain "${subtopic}" (topic: "${topic}") in about ${config.words} words.

Return JSON: {"title":"${subtopic}","overview":"2 sentence intro","content":"Clear explanation of the concept","keyPoints":["point 1","point 2","point 3"]}`;

                // CODE PROMPT - more examples for Pro
                const codePrompt = mode === 'pro'
                    ? `Write ${config.codeExamples} complete Python code examples for "${subtopic}" with different use cases.

Example 1: Basic implementation
Example 2: Practical real-world usage  
Example 3: Advanced/optimized version

Return JSON:
{"codeExamples":[
  {"title":"Example name","code":"# Full commented code\\n...","explanation":"Detailed step-by-step explanation of each part of the code"}
]}

Requirements:
- Each example must be complete and runnable
- Include detailed comments explaining each section
- Explanations should walk through the code line-by-line`
                    : `Write ${config.codeExamples} Python code examples for "${subtopic}".

Return JSON: {"codeExamples":[{"title":"name","code":"# code","explanation":"what it does"}]}

Keep code complete but concise.`;

                try {
                    // Build array of promises based on mode
                    const apiCalls = [
                        generateJSON(conceptPrompt, { maxTokens: config.conceptTokens }),
                        generateJSON(codePrompt, { maxTokens: config.codeTokens })
                    ];

                    // PRO MODE: Add third API call for advanced content
                    if (config.includeAdvanced && mode === 'pro') {
                        const advancedPrompt = `Provide advanced insights for "${subtopic}" (topic: "${topic}").

Cover these sections:
1. Common Mistakes & How to Avoid Them
2. Best Practices & Design Patterns
3. Performance Considerations & Optimizations
4. Edge Cases to Handle
5. Interview Tips (if applicable)

Return JSON:
{"advanced":{
  "commonMistakes":["mistake 1 with explanation","mistake 2"],
  "bestPractices":["practice 1","practice 2","practice 3"],
  "performance":"Performance analysis and optimization tips",
  "edgeCases":["edge case 1","edge case 2"],
  "tips":"Additional tips for mastery"
}}`;
                        apiCalls.push(generateJSON(advancedPrompt, { maxTokens: config.advancedTokens }));
                    }

                    // Execute all API calls in parallel
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
                            fullContent += "### ⚠️ Common Mistakes\n\n";
                            adv.commonMistakes.forEach(m => {
                                fullContent += `- ${m}\n`;
                            });
                            fullContent += "\n";
                        }

                        if (adv.bestPractices && adv.bestPractices.length > 0) {
                            fullContent += "### ✅ Best Practices\n\n";
                            adv.bestPractices.forEach(p => {
                                fullContent += `- ${p}\n`;
                            });
                            fullContent += "\n";
                        }

                        if (adv.performance) {
                            fullContent += "### ⚡ Performance Tips\n\n";
                            fullContent += adv.performance + "\n\n";
                        }

                        if (adv.edgeCases && adv.edgeCases.length > 0) {
                            fullContent += "### 🔍 Edge Cases\n\n";
                            adv.edgeCases.forEach(e => {
                                fullContent += `- ${e}\n`;
                            });
                            fullContent += "\n";
                        }

                        if (adv.tips) {
                            fullContent += "### 💡 Pro Tips\n\n";
                            fullContent += adv.tips + "\n";
                        }
                    }

                    return {
                        order: index,
                        subtopic,
                        title: conceptResult.title || subtopic,
                        overview: conceptResult.overview || "",
                        content: fullContent,
                        keyPoints: conceptResult.keyPoints || [],
                        examples: codeResult.codeExamples?.map(ex => ex.title) || [],
                        isCodeIntensive: true,
                        success: true,
                    };
                } catch (err) {
                    console.error(`Failed for "${subtopic}":`, err.message);
                    return {
                        order: index,
                        subtopic,
                        title: subtopic,
                        overview: "",
                        content: "Content generation failed. Please try again.",
                        keyPoints: [],
                        examples: [],
                        isCodeIntensive: true,
                        success: false,
                    };
                }
            } else {
                // Non-code topics
                const prompt = mode === 'pro'
                    ? `Provide a comprehensive, in-depth explanation of "${subtopic}" (topic: "${topic}") in ${config.words} words.

Cover all aspects thoroughly with examples and practical applications.

Return JSON: {"title":"${subtopic}","overview":"Comprehensive 3-4 sentence intro","content":"Detailed multi-paragraph explanation covering all aspects","keyPoints":["detailed point 1","detailed point 2","detailed point 3","detailed point 4","detailed point 5"],"examples":["detailed example 1","detailed example 2","detailed example 3"]}`
                    : `Explain "${subtopic}" (topic: "${topic}") in ${config.words} words.

Requirement: Focus on conceptual clarity. If the topic is technical, you may include code snippets if relevant, otherwise focus on descriptive examples.

Return JSON: {"title":"${subtopic}","overview":"2-sentence intro","content":"Explanation","keyPoints":["p1","p2","p3"],"examples":["ex1","ex2"]}`;

                try {
                    const result = await generateJSON(prompt, { maxTokens: config.conceptTokens });
                    return {
                        order: index,
                        subtopic,
                        title: result.title || subtopic,
                        overview: result.overview || "",
                        content: result.content || "",
                        keyPoints: result.keyPoints || [],
                        examples: result.examples || [],
                        isCodeIntensive: false,
                        success: true,
                    };
                } catch (err) {
                    console.error(`Failed for "${subtopic}":`, err.message);
                    return {
                        order: index,
                        subtopic,
                        title: subtopic,
                        overview: "",
                        content: "Content generation failed.",
                        keyPoints: [],
                        examples: [],
                        isCodeIntensive: false,
                        success: false,
                    };
                }
            }
        });

        const subtopicResults = await Promise.all(subtopicPromises);
        subtopicResults.sort((a, b) => a.order - b.order);

        const sections = subtopicResults.map(r => ({
            title: r.title,
            overview: r.overview,
            content: r.content,
            keyPoints: r.keyPoints,
            examples: r.examples,
            isCodeIntensive: r.isCodeIntensive,
        }));

        const fullContent = sections.map(s => `${s.overview}\n\n${s.content}`).join('\n\n');
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
