import { fork } from "child_process";
import { readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { Textbook } from "../models/Textbook.js";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



const pinecone = process.env.PINECONE_API_KEY
    ? new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
    : null;
const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "dlp";
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || "";
const EMBEDDING_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
const EMBEDDING_DIM = Number(process.env.OPENAI_EMBED_DIM || 1536);
const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 80;
const CHAR_PER_TOKEN = 4;

function extractErrorMessage(error) {
    if (!error) return "Unknown error";
    if (typeof error.message === "string" && error.message.trim()) return error.message;
    return String(error);
}

function ensureEmbeddingClient() {
    if (!openai) {
        throw new Error("OpenAI API key not configured for embeddings. Set OPENAI_API_KEY in server/.env.");
    }
}

// ─── Pinecone Index ────────────────────────────────────────────────
async function getPineconeIndex() {
    if (!pinecone) {
        throw new Error("Pinecone API key not configured.");
    }

    const { indexes } = await pinecone.listIndexes();
    const exists = indexes && indexes.some(function (idx) { return idx.name === PINECONE_INDEX_NAME; });

    if (!exists) {
        console.log("[RAG] Creating Pinecone index: " + PINECONE_INDEX_NAME);
        await pinecone.createIndex({
            name: PINECONE_INDEX_NAME,
            dimension: EMBEDDING_DIM,
            metric: "cosine",
            spec: { serverless: { cloud: "aws", region: "us-east-1" } },
        });
        console.log("[RAG] Waiting for index to initialize...");
        await new Promise(function (resolve) { setTimeout(resolve, 5000); });
    }

    var idx = pinecone.index(PINECONE_INDEX_NAME);
    return PINECONE_NAMESPACE ? idx.namespace(PINECONE_NAMESPACE) : idx;
}

// ─── Embed (OpenAI) ────────────────────────────────────────────────
async function embedTexts(texts) {
    ensureEmbeddingClient();

    if (!Array.isArray(texts) || texts.length === 0) {
        return [];
    }

    try {
        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: texts,
            dimensions: EMBEDDING_DIM,
            encoding_format: "float",
        });

        const embeddings = response.data.map(function (item) {
            return item.embedding;
        });

        if (embeddings.length !== texts.length) {
            throw new Error("OpenAI embeddings response count did not match the input count.");
        }

        for (var i = 0; i < embeddings.length; i++) {
            if (!Array.isArray(embeddings[i]) || embeddings[i].length !== EMBEDDING_DIM) {
                throw new Error("OpenAI embedding response did not include a valid " + EMBEDDING_DIM + "-dimension vector.");
            }
        }

        return embeddings;
    } catch (error) {
        throw new Error("OpenAI embedding request failed: " + extractErrorMessage(error));
    }
}

async function embedText(text) {
    var embeddings = await embedTexts([text]);
    return embeddings[0];
}

// ─── Extract text via child process ────────────────────────────────
function extractTextFromPDF(pdfFilePath) {
    var outputPath = join(tmpdir(), "dlp_text_" + Date.now() + ".json");

    return new Promise(function (resolve, reject) {
        var workerPath = join(__dirname, "..", "utils", "pdfWorker.js");
        var child = fork(workerPath, [pdfFilePath, outputPath], {
            execArgv: ["--max-old-space-size=4096"],
        });

        child.on("message", function (msg) {
            if (msg.success) {
                resolve({ outputPath: outputPath, numPages: msg.numPages });
            } else {
                reject(new Error("PDF extraction failed: " + msg.error));
            }
        });

        child.on("error", function (err) {
            reject(new Error("PDF worker error: " + err.message));
        });

        child.on("close", function (code) {
            if (code !== 0 && code !== null) {
                reject(new Error("PDF worker exited with code " + code));
            }
        });
    });
}

// ─── Chunking ──────────────────────────────────────────────────────
function chunkText(text) {
    var charChunkSize = CHUNK_SIZE * CHAR_PER_TOKEN;
    var charOverlap = CHUNK_OVERLAP * CHAR_PER_TOKEN;

    var cleanedText = text
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]+/g, " ")
        .trim();

    if (!cleanedText) return [];

    var chunks = [];
    var start = 0;

    while (start < cleanedText.length) {
        var end = start + charChunkSize;

        if (end < cleanedText.length) {
            var slice = cleanedText.substring(start, end);
            var lastSentenceEnd = Math.max(
                slice.lastIndexOf(". "),
                slice.lastIndexOf(".\n"),
                slice.lastIndexOf("? "),
                slice.lastIndexOf("! ")
            );
            if (lastSentenceEnd > charChunkSize * 0.5) {
                end = start + lastSentenceEnd + 1;
            }
        } else {
            end = cleanedText.length;
        }

        var chunkContent = cleanedText.substring(start, end).trim();
        if (chunkContent.length > 50) {
            chunks.push({ text: chunkContent, chunkIndex: chunks.length });
        }

        start = end - charOverlap;
        if (start >= cleanedText.length) break;
    }

    return chunks;
}

// ─── Full Ingestion Pipeline ───────────────────────────────────────
export async function ingestTextbook(filePath, fileName, userId, syllabusId) {
    var textbook = new Textbook({
        userId: userId,
        syllabusId: syllabusId || null,
        fileName: fileName,
        status: "processing",
    });
    await textbook.save();

    try {
        // Step 1: Extract text in child process
        console.log("[RAG] Step 1/3: Extracting text from \"" + fileName + "\" (child process)...");
        var extracted = await extractTextFromPDF(filePath);

        // Clean up uploaded file
        try { unlinkSync(filePath); } catch (e) { /* ok */ }

        // Read extracted text from temp file
        var rawData = readFileSync(extracted.outputPath, "utf8");
        var parsed = JSON.parse(rawData);
        try { unlinkSync(extracted.outputPath); } catch (e) { /* ok */ }

        var text = parsed.text;
        var numPages = extracted.numPages;

        if (!text || text.trim().length < 100) {
            throw new Error("PDF contains too little readable text.");
        }

        // Step 2: Chunk
        console.log("[RAG] Step 2/3: Chunking " + text.length + " chars...");
        var chunks = chunkText(text);

        if (chunks.length === 0) {
            throw new Error("Could not create any text chunks from the PDF.");
        }

        // Estimate pages
        var charsPerPage = text.length / (numPages || 1);
        var charOffset = 0;
        for (var ci = 0; ci < chunks.length; ci++) {
            chunks[ci].pageEstimate = Math.floor(charOffset / charsPerPage) + 1;
            charOffset += chunks[ci].text.length;
        }

        // Step 3: Embed and upsert to Pinecone
        console.log("[RAG] Step 3/3: Creating OpenAI embeddings and upserting " + chunks.length + " chunks to Pinecone...");
        var index = await getPineconeIndex();
        var textbookId = textbook._id.toString();

        var BATCH_SIZE = 5;
        var upsertedCount = 0;

        for (var i = 0; i < chunks.length; i += BATCH_SIZE) {
            var batch = chunks.slice(i, i + BATCH_SIZE);
            var vectors = [];
            var embeddings = await embedTexts(batch.map(function (chunk) {
                return chunk.text;
            }));

            for (var j = 0; j < batch.length; j++) {
                var chunk = batch[j];
                vectors.push({
                    id: textbookId + "_" + chunk.chunkIndex,
                    values: embeddings[j],
                    metadata: {
                        textbookId: textbookId,
                        userId: userId,
                        syllabusId: syllabusId || "",
                        fileName: fileName,
                        chunkIndex: chunk.chunkIndex,
                        pageEstimate: chunk.pageEstimate,
                        text: chunk.text.substring(0, 8000),
                    },
                });
            }

            await index.upsert(vectors);
            upsertedCount += vectors.length;

            var batchNum = Math.floor(i / BATCH_SIZE) + 1;
            var totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
            console.log("[RAG]   Batch " + batchNum + "/" + totalBatches + " (" + upsertedCount + "/" + chunks.length + ")");

            if (i + BATCH_SIZE < chunks.length) {
                await new Promise(function (resolve) { setTimeout(resolve, 300); });
            }
        }

        // Update textbook metadata
        textbook.totalChunks = upsertedCount;
        textbook.totalPages = numPages;
        textbook.status = "ready";
        await textbook.save();

        console.log("[RAG] ✅ Ingested \"" + fileName + "\" (" + numPages + " pages, " + upsertedCount + " chunks)");

        return {
            _id: textbook._id,
            fileName: textbook.fileName,
            totalChunks: textbook.totalChunks,
            totalPages: textbook.totalPages,
            status: textbook.status,
        };
    } catch (error) {
        textbook.status = "failed";
        textbook.errorMessage = error.message;
        await textbook.save();

        try {
            var idx = await getPineconeIndex();
            var tbId = textbook._id.toString();
            var idsToDelete = Array.from({ length: 1000 }, function (_, k) { return tbId + "_" + k; });
            await idx.deleteMany(idsToDelete);
        } catch (cleanupErr) { /* ignore */ }

        console.error("[RAG] ❌ Ingestion failed for \"" + fileName + "\":", error.message);
        throw error;
    }
}

// ─── Search ────────────────────────────────────────────────────────
export async function retrieveRelevantChunks(query, filter, topK, options) {
    topK = topK || 5;
    filter = filter || {};
    options = options || {};

    var failSilently = options.failSilently === true;

    try {
        console.log("[RAG] Embedding query with OpenAI " + EMBEDDING_MODEL + ": \"" + query.substring(0, 80) + "...\"");
        var queryEmbedding = await embedText(query);

        var pineconeFilter = {};
        if (filter.userId) pineconeFilter.userId = filter.userId;
        if (filter.textbookId) pineconeFilter.textbookId = filter.textbookId;
        if (filter.syllabusId) pineconeFilter.syllabusId = filter.syllabusId;

        var index = await getPineconeIndex();
        var hasFilter = Object.keys(pineconeFilter).length > 0;

        console.log("[RAG] Querying Pinecone with filter:", hasFilter ? JSON.stringify(pineconeFilter) : "none");

        var queryResult = await index.query({
            vector: queryEmbedding,
            topK: topK,
            includeMetadata: true,
            filter: hasFilter ? pineconeFilter : undefined,
        });

        // Fallback: if filtered query returned nothing, retry without filters
        // (handles vectors ingested externally without user-specific metadata)
        if ((!queryResult.matches || queryResult.matches.length === 0) && hasFilter) {
            console.log("[RAG] No results with filters, retrying without filters...");
            queryResult = await index.query({
                vector: queryEmbedding,
                topK: topK,
                includeMetadata: true,
            });
        }

        if (!queryResult.matches || queryResult.matches.length === 0) {
            console.log("[RAG] No matching chunks found.");
            return [];
        }

        var results = queryResult.matches.map(function (match) {
            return {
                text: match.metadata.text || "",
                score: match.score,
                fileName: match.metadata.fileName,
                pageEstimate: match.metadata.pageEstimate,
                textbookId: match.metadata.textbookId,
                chunkIndex: match.metadata.chunkIndex,
            };
        });

        console.log("[RAG] Retrieved " + results.length + " chunks (best: " + (results[0].score || 0).toFixed(4) + ")");
        return results;
    } catch (error) {
        if (failSilently) {
            console.warn("[RAG] Retrieval unavailable, continuing without textbook context:", extractErrorMessage(error));
            return [];
        }

        throw error;
    }
}

// ─── Delete ────────────────────────────────────────────────────────
export async function deleteTextbookChunks(textbookId) {
    try {
        var index = await getPineconeIndex();
        var id = textbookId.toString();
        var textbook = await Textbook.findById(textbookId).select("totalChunks").lean();
        var count = (textbook && textbook.totalChunks) || 500;

        var idsToDelete = Array.from({ length: count }, function (_, i) { return id + "_" + i; });

        for (var i = 0; i < idsToDelete.length; i += 100) {
            var batch = idsToDelete.slice(i, i + 100);
            await index.deleteMany(batch);
        }

        console.log("[RAG] Deleted " + count + " vectors for textbook " + id);
    } catch (error) {
        console.error("[RAG] Delete failed:", error.message);
    }
}

export default {
    ingestTextbook: ingestTextbook,
    retrieveRelevantChunks: retrieveRelevantChunks,
    deleteTextbookChunks: deleteTextbookChunks,
};
