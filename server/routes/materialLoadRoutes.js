import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { ingestGoogleDoc } from "../controllers/materialLoadController.js";

const router = express.Router();

router.use(authMiddleware);
router.post("/ingest-google-doc", ingestGoogleDoc);

export default router;
