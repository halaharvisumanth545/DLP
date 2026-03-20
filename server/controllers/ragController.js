import { ingestTextbook, retrieveRelevantChunks, deleteTextbookChunks } from "../services/ragService.js";
import { generateCompletion, generateJSON } from "../config/openai.js";
import { Textbook } from "../models/Textbook.js";

// ─── 1. Upload & Ingest a Textbook PDF ─────────────────────────────
/**
 * POST /api/rag/upload-textbook
 * Uses multer middleware — file is already saved to disk at req.file.path
 */
export async function uploadTextbook(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No PDF file uploaded." });
        }

        const userId = req.user.userId;
        const fileName = req.file.originalname;
        const filePath = req.file.path;
        const syllabusId = req.body.syllabusId || null;

        console.log(`[RAG Controller] Starting ingestion of "${fileName}" (${(req.file.size / 1024 / 1024).toFixed(1)} MB)`);

        // Pass the FILE PATH (not buffer!) to the service
        const result = await ingestTextbook(filePath, fileName, userId, syllabusId);

        res.json({
            success: true,
            message: `Textbook "${fileName}" ingested successfully.`,
            textbook: result,
        });
    } catch (error) {
        console.error("[RAG Controller] Upload failed:", error.message);
        res.status(500).json({
            error: "Failed to process textbook.",
            details: error.message,
        });
    }
}

// ─── 2. Search Textbook Chunks ─────────────────────────────────────
/**
 * POST /api/rag/search
 * Body: { query: "explain binary trees", syllabusId?: "...", textbookId?: "...", topK?: 5 }
 */
export async function searchTextbook(req, res) {
    try {
        const { query, syllabusId, textbookId, topK = 5 } = req.body;
        const userId = req.user.userId;

        if (!query) {
            return res.status(400).json({ error: "query is required." });
        }

        const filter = { userId };
        if (syllabusId) filter.syllabusId = syllabusId;
        if (textbookId) filter.textbookId = textbookId;

        const chunks = await retrieveRelevantChunks(query, filter, topK);

        res.json({
            success: true,
            query,
            results: chunks.map(c => ({
                text: c.text,
                score: Math.round(c.score * 10000) / 10000,
                fileName: c.fileName,
                pageEstimate: c.pageEstimate,
            })),
        });
    } catch (error) {
        console.error("[RAG Controller] Search failed:", error.message);
        res.status(500).json({
            error: "Search failed.",
            details: error.message,
        });
    }
}

// ─── 3. Generate Material with RAG ─────────────────────────────────
/**
 * POST /api/rag/generate-with-rag
 * Body: { topic: "Binary Search Trees", syllabusId?: "...", textbookId?: "...", mode?: "short" }
 */
export async function generateWithRAG(req, res) {
    try {
        const { topic, syllabusId, textbookId, mode = "short" } = req.body;
        const userId = req.user.userId;

        if (!topic) {
            return res.status(400).json({ error: "topic is required." });
        }

        console.log(`[RAG Controller] Retrieving context for topic: "${topic}"`);
        const filter = { userId };
        if (syllabusId) filter.syllabusId = syllabusId;
        if (textbookId) filter.textbookId = textbookId;

        const chunks = await retrieveRelevantChunks(topic, filter, 8);

        let textbookContext = "";
        if (chunks.length > 0) {
            textbookContext = chunks
                .map((c, i) => `--- Textbook Excerpt ${i + 1} (from "${c.fileName}", ~p.${c.pageEstimate}, relevance: ${(c.score * 100).toFixed(1)}%) ---\n${c.text}`)
                .join("\n\n");
            console.log(`[RAG Controller] Using ${chunks.length} textbook excerpts as context (${textbookContext.length} chars)`);
        } else {
            console.log(`[RAG Controller] No textbook context found, generating without RAG.`);
        }

        const prompt = buildRAGPrompt(topic, textbookContext, mode);

        const schema = {
            type: "object",
            properties: {
                title: { type: "string" },
                overview: { type: "string" },
                sections: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            content: { type: "string" },
                            keyPoints: { type: "array", items: { type: "string" } },
                        },
                    },
                },
            },
        };

        const result = await generateJSON(prompt, {
            maxTokens: mode === "short" ? 2000 : 4000,
            schema,
        });

        res.json({
            success: true,
            topic,
            mode,
            ragContextUsed: chunks.length > 0,
            chunksUsed: chunks.length,
            material: result,
        });
    } catch (error) {
        console.error("[RAG Controller] Generation failed:", error.message);
        res.status(500).json({
            error: "RAG generation failed.",
            details: error.message,
        });
    }
}

// ─── 4. List Textbooks ─────────────────────────────────────────────
export async function listTextbooks(req, res) {
    try {
        const userId = req.user.userId;
        const textbooks = await Textbook.find({ userId })
            .select("fileName totalChunks totalPages status createdAt errorMessage")
            .sort({ createdAt: -1 });
        res.json({ success: true, textbooks });
    } catch (error) {
        console.error("[RAG Controller] List failed:", error.message);
        res.status(500).json({ error: "Failed to list textbooks." });
    }
}

// ─── 5. Delete a Textbook ──────────────────────────────────────────
export async function deleteTextbook(req, res) {
    try {
        const userId = req.user.userId;
        const textbookId = req.params.id;

        const textbook = await Textbook.findOneAndDelete({ _id: textbookId, userId });
        if (!textbook) {
            return res.status(404).json({ error: "Textbook not found." });
        }

        await deleteTextbookChunks(textbookId);
        res.json({ success: true, message: `Deleted "${textbook.fileName}".` });
    } catch (error) {
        console.error("[RAG Controller] Delete failed:", error.message);
        res.status(500).json({ error: "Failed to delete textbook." });
    }
}

// ─── Helper: Build the RAG Prompt ──────────────────────────────────
function buildRAGPrompt(topic, textbookContext, mode) {
    const baseInstructions = `Generate a comprehensive study material on the topic: "${topic}".`;

    const contextSection = textbookContext
        ? `\n\n=== TEXTBOOK REFERENCE MATERIAL ===
The following excerpts are from the student's actual course textbook. You MUST use this content as your PRIMARY source of information. Base your explanations, definitions, and examples on this material. If the textbook uses specific terminology or definitions, use those exact definitions.

${textbookContext}

=== END TEXTBOOK REFERENCE ===

CRITICAL: Your response must be grounded in the textbook excerpts above. Do NOT contradict the textbook. If the textbook provides a specific definition, formula, or example, use it. You may supplement with additional explanation for clarity, but the textbook content should be the foundation.`
        : `\n\nNote: No textbook reference material is available. Generate based on your general knowledge.`;

    const modeInstructions = mode === "short"
        ? "Keep the material concise and focused. Include key definitions, important points, and brief examples."
        : "Make the material detailed and thorough. Include comprehensive explanations, multiple examples, comparisons, and in-depth analysis.";

    const formatInstructions = `
Output format: Return a JSON object with this structure:
{
  "title": "Topic Title",
  "overview": "Brief 2-3 sentence overview of the topic",
  "sections": [
    {
      "title": "Section Title",
      "content": "Detailed HTML content with <p>, <h4>, <ul>, <li>, <strong>, <em>, <code>, <pre> tags. Use LaTeX wrapped in \\\\( ... \\\\) for inline math and \\\\[ ... \\\\] for display math.",
      "keyPoints": ["Key point 1", "Key point 2"]
    }
  ]
}

Content formatting rules:
- Use proper HTML tags for structure
- Use LaTeX notation for all mathematical expressions
- Include practical examples where applicable
- Use <code> and <pre> blocks for code snippets
- Make content easy to read and study from`;

    return `${baseInstructions}${contextSection}\n\n${modeInstructions}\n\n${formatInstructions}`;
}
