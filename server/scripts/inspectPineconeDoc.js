import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";

function extractDocumentId(input) {
    if (!input || typeof input !== "string") {
        throw new Error("Provide a Google Docs URL or a document ID.");
    }

    const trimmed = input.trim();
    const match = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : trimmed;
}

function normalizeForSuggestion(value) {
    return value
        .toLowerCase()
        .replace(/l/g, "i")
        .replace(/o/g, "0");
}

async function collectMatchingIds(index, namespace, prefix) {
    const ids = [];
    let paginationToken;

    do {
        const response = await index.listPaginated({
            namespace,
            prefix,
            paginationToken,
        });

        ids.push(...response.vectors.map((vector) => vector.id));
        paginationToken = response.pagination?.next || undefined;
    } while (paginationToken);

    return ids;
}

async function collectSampleIds(index, namespace, limit = 200) {
    const ids = [];
    let paginationToken;

    while (ids.length < limit) {
        const response = await index.listPaginated({
            namespace,
            paginationToken,
        });

        ids.push(...response.vectors.map((vector) => vector.id));
        paginationToken = response.pagination?.next || undefined;

        if (!paginationToken) {
            break;
        }
    }

    return ids;
}

function buildSuggestions(documentId, allIds) {
    const normalizedTarget = normalizeForSuggestion(documentId);
    const suggestions = [];

    for (const id of allIds) {
        const sourceId = id.split("_")[0];
        if (normalizeForSuggestion(sourceId) === normalizedTarget) {
            suggestions.push(sourceId);
        }
    }

    return [...new Set(suggestions)];
}

async function main() {
    const input = process.argv[2];
    const namespace = process.argv[3] || process.env.PINECONE_NAMESPACE;
    const limit = Number(process.argv[4] || 5);

    if (!input) {
        throw new Error("Usage: node scripts/inspectPineconeDoc.js <google-doc-url-or-id> [namespace] [sample-count]");
    }

    const documentId = extractDocumentId(input);
    const prefix = `${documentId}_`;

    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index(process.env.PINECONE_INDEX_NAME);

    console.log("Inspecting Pinecone document");
    console.log("Index:", process.env.PINECONE_INDEX_NAME);
    console.log("Namespace:", namespace || "(default)");
    console.log("Document ID:", documentId);

    const ids = await collectMatchingIds(index, namespace, prefix);
    console.log("Matched vectors:", ids.length);

    if (ids.length === 0) {
        const sampleIds = await collectSampleIds(index, namespace, 250);
        const suggestions = buildSuggestions(documentId, sampleIds);

        console.log("No vectors found for that exact document ID.");
        if (suggestions.length > 0) {
            console.log("Possible similar document IDs:");
            suggestions.forEach((suggestion) => console.log("-", suggestion));
        }
        return;
    }

    const fetched = await index.fetch({
        namespace,
        ids: ids.slice(0, Math.max(1, limit)),
    });

    const records = Object.entries(fetched.records).map(([id, record]) => ({
        id,
        metadata: record.metadata,
    }));

    console.dir(records, { depth: null });
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
