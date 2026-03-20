/**
 * Worker: Extract text from PDF page-by-page, write ONLY the raw text to a file, exit.
 * The child's sole job is extraction — it exits immediately after so pdfjs memory is freed.
 * Chunking happens in the main process where 294K chars is trivial.
 *
 * Usage: node pdfWorker.js <pdfFilePath> <outputFilePath>
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const pdfFilePath = process.argv[2];
const outputFilePath = process.argv[3];

async function extractText(filePath) {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const data = new Uint8Array(readFileSync(filePath));
    const doc = await pdfjsLib.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
    }).promise;

    const numPages = doc.numPages;
    let fullText = "";

    for (let i = 1; i <= numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();

        let pageText = "";
        let lastY = null;
        for (const item of textContent.items) {
            if (item.str) {
                if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
                    pageText += "\n";
                }
                pageText += item.str;
                lastY = item.transform[5];
            }
        }

        fullText += pageText + "\n\n";
        page.cleanup();

        if (i % 50 === 0) {
            console.error(`[Worker] Extracted page ${i}/${numPages}`);
        }
    }

    // Write text + metadata to file BEFORE destroying doc (in case destroy triggers GC issues)
    const result = JSON.stringify({ numPages, text: fullText });
    writeFileSync(outputFilePath, result, "utf8");

    console.error(`[Worker] Wrote ${fullText.length} chars from ${numPages} pages to file`);

    // Now destroy doc — all pdfjs memory will be freed when this process exits
    try { await doc.cleanup(); } catch (e) {}
    try { await doc.destroy(); } catch (e) {}

    return numPages;
}

try {
    const numPages = await extractText(pdfFilePath);
    process.send({ success: true, numPages });
    process.exit(0);
} catch (error) {
    console.error(`[Worker] Error: ${error.message}`);
    process.send({ success: false, error: error.message });
    process.exit(1);
}
