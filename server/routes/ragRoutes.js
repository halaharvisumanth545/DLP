import express from "express";
import multer from "multer";
import { tmpdir } from "os";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
    uploadTextbook,
    searchTextbook,
    generateWithRAG,
    listTextbooks,
    deleteTextbook,
} from "../controllers/ragController.js";

const router = express.Router();

// Multer config: saves uploaded PDFs to OS temp directory (not memory)
const upload = multer({
    dest: tmpdir(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed."));
        }
    },
});

// All RAG routes require authentication
router.use(authMiddleware);

// Upload textbook — uses multer middleware for file upload
router.post("/upload-textbook", upload.single("pdf"), uploadTextbook);

// Search + Generate + List + Delete (JSON body, no file upload)
router.post("/search", searchTextbook);
router.post("/generate-with-rag", generateWithRAG);
router.get("/textbooks", listTextbooks);
router.delete("/textbooks/:id", deleteTextbook);

export default router;
