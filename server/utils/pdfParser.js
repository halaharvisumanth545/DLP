import pdf from "pdf-parse";

/**
 * Extract text from PDF buffer (Node.js safe)
 */
export async function extractTextFromPDF(pdfBuffer) {
  try {
    const data = await pdf(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error("PDF parsing error:", error.message);
    throw new Error("Failed to parse PDF file: " + error.message);
  }
}