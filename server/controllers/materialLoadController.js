import { runMaterialLoadWorkflow } from "../services/materialLoadService.js";

function isGoogleDocsUrl(value) {
    return typeof value === "string" && /docs\.google\.com\/document\/d\//i.test(value);
}

export async function ingestGoogleDoc(req, res) {
    try {
        const { docsUrl, syllabusId = "" } = req.body || {};
        const userId = req.user?.userId || "";

        if (!isGoogleDocsUrl(docsUrl)) {
            return res.status(400).json({
                error: "A valid Google Docs URL is required.",
            });
        }

        const result = await runMaterialLoadWorkflow({
            docsUrl,
            userId,
            syllabusId,
        });

        res.json({
            success: true,
            message: "Google Doc ingested successfully.",
            ingestion: result,
        });
    } catch (error) {
        console.error("[Material Load] Ingestion failed:", error.message);
        res.status(500).json({
            error: "Failed to ingest the Google Doc.",
            details: error.message,
        });
    }
}
