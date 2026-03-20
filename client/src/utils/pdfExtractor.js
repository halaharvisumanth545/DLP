import * as pdfjsLib from "pdfjs-dist";

// Use the bundled worker for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
).toString();

/**
 * Extract text from a PDF file in the browser using pdfjs-dist.
 * @param {File} file - The PDF file selected by the user
 * @returns {Promise<string>} - The extracted text content
 */
export async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pageTexts = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Build text from items, preserving line structure
        let lastY = null;
        let lineText = "";
        const lines = [];

        for (const item of textContent.items) {
            if (item.str === undefined) continue;

            // Detect line breaks by checking Y-position changes
            const currentY = item.transform[5];
            if (lastY !== null && Math.abs(currentY - lastY) > 2) {
                // Y position changed → new line
                if (lineText.trim()) {
                    lines.push(lineText.trim());
                }
                lineText = item.str;
            } else {
                // Same line — append with spacing
                lineText += (item.hasEOL ? "\n" : " ") + item.str;
            }
            lastY = currentY;
        }
        // Push last line
        if (lineText.trim()) {
            lines.push(lineText.trim());
        }

        pageTexts.push(lines.join("\n"));
    }

    return pageTexts.join("\n\n");
}
