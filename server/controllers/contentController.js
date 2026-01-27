import { Syllabus } from "../models/Syllabus.js";
import { StudyMaterial } from "../models/StudyMaterial.js";
import { extractTopics } from "../utils/topicExtractor.js";
import { generateStudyContent } from "../services/openaiService.js";
import { extractTextFromPDF } from "../utils/pdfParser.js";

// Upload and parse syllabus
export async function uploadSyllabus(req, res) {
    try {
        const { fileName, content, pdfBase64 } = req.body;
        const userId = req.user.userId;

        let syllabusContent = content;

        // If PDF base64 is provided, parse it first
        if (pdfBase64) {
            try {
                const pdfBuffer = Buffer.from(pdfBase64, "base64");
                syllabusContent = await extractTextFromPDF(pdfBuffer);
                console.log("PDF parsed successfully, extracted text length:", syllabusContent.length);
            } catch (pdfError) {
                console.error("PDF parsing failed:", pdfError);
                return res.status(400).json({ error: "Failed to parse PDF file. Please try pasting the content directly." });
            }
        }

        if (!syllabusContent) {
            return res.status(400).json({ error: "Syllabus content is required" });
        }

        // Create syllabus record
        const syllabus = await Syllabus.create({
            userId,
            fileName: fileName || "Untitled Syllabus",
            originalContent: syllabusContent,
            status: "pending",
        });

        // Extract topics using AI
        try {
            const topics = await extractTopics(syllabusContent);
            syllabus.topics = topics;
            syllabus.status = "parsed";
            await syllabus.save();
        } catch (parseError) {
            console.error("Topic extraction failed:", parseError);
            syllabus.status = "failed";
            await syllabus.save();
        }

        res.status(201).json({
            message: "Syllabus uploaded successfully",
            syllabus: {
                id: syllabus._id,
                fileName: syllabus.fileName,
                topics: syllabus.topics,
                status: syllabus.status,
            },
        });
    } catch (error) {
        console.error("Upload syllabus error:", error);
        res.status(500).json({ error: "Failed to upload syllabus" });
    }
}


// Generate study material for a topic
export async function generateStudyMaterial(req, res) {
    try {
        const { syllabusId, topic, mode = "intermediate" } = req.body;
        const userId = req.user.userId;

        if (!syllabusId || !topic) {
            return res.status(400).json({ error: "Syllabus ID and topic are required" });
        }

        // Verify syllabus belongs to user
        const syllabus = await Syllabus.findOne({ _id: syllabusId, userId });
        if (!syllabus) {
            return res.status(404).json({ error: "Syllabus not found" });
        }

        // Check for existing material
        let material = await StudyMaterial.findOne({ syllabusId, topic, mode, userId });

        if (!material) {
            // Generate new content using OpenAI
            const generatedContent = await generateStudyContent(topic, mode, syllabus.originalContent);

            material = await StudyMaterial.create({
                userId,
                syllabusId,
                topic,
                mode,
                content: generatedContent.content,
                sections: generatedContent.sections,
                metadata: {
                    wordCount: generatedContent.content.split(/\s+/).length,
                    estimatedReadTime: Math.ceil(generatedContent.content.split(/\s+/).length / 200),
                },
            });
        }

        res.json({
            message: "Study material generated",
            material: {
                id: material._id,
                topic: material.topic,
                mode: material.mode,
                content: material.content,
                sections: material.sections,
                metadata: material.metadata,
            },
        });
    } catch (error) {
        console.error("Generate study material error:", error);
        res.status(500).json({ error: "Failed to generate study material" });
    }
}

// Get study materials for a syllabus
export async function getStudyMaterials(req, res) {
    try {
        const { syllabusId } = req.params;
        const userId = req.user.userId;

        const materials = await StudyMaterial.find({ syllabusId, userId })
            .select("topic mode metadata createdAt");

        res.json({ materials });
    } catch (error) {
        console.error("Get study materials error:", error);
        res.status(500).json({ error: "Failed to get study materials" });
    }
}

// Get single study material
export async function getStudyMaterialById(req, res) {
    try {
        const material = await StudyMaterial.findOne({
            _id: req.params.id,
            userId: req.user.userId,
        });

        if (!material) {
            return res.status(404).json({ error: "Study material not found" });
        }

        res.json({ material });
    } catch (error) {
        console.error("Get study material error:", error);
        res.status(500).json({ error: "Failed to get study material" });
    }
}

// Delete syllabus
export async function deleteSyllabus(req, res) {
    try {
        const syllabus = await Syllabus.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.userId,
        });

        if (!syllabus) {
            return res.status(404).json({ error: "Syllabus not found" });
        }

        // Also delete associated study materials
        await StudyMaterial.deleteMany({ syllabusId: req.params.id });

        res.json({ message: "Syllabus deleted successfully" });
    } catch (error) {
        console.error("Delete syllabus error:", error);
        res.status(500).json({ error: "Failed to delete syllabus" });
    }
}

// Save study material with custom name
export async function saveStudyMaterial(req, res) {
    try {
        const { syllabusId, topic, mode, name, content, sections, metadata } = req.body;
        const userId = req.user.userId;

        if (!syllabusId || !topic || !content) {
            return res.status(400).json({ error: "Syllabus ID, topic, and content are required" });
        }

        // Generate default name if not provided
        const materialName = name || `${topic} - ${mode} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        const material = await StudyMaterial.create({
            userId,
            syllabusId,
            topic,
            name: materialName,
            mode: mode || 'intermediate',
            content,
            sections: sections || [],
            metadata: metadata || {
                wordCount: content.split(/\s+/).length,
                estimatedReadTime: Math.ceil(content.split(/\s+/).length / 200),
            },
        });

        res.status(201).json({
            message: "Study material saved successfully",
            material: {
                id: material._id,
                name: material.name,
                topic: material.topic,
                mode: material.mode,
                createdAt: material.createdAt,
            },
        });
    } catch (error) {
        console.error("Save study material error:", error);
        res.status(500).json({ error: "Failed to save study material" });
    }
}

// Get all study materials for a user
export async function getAllStudyMaterials(req, res) {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20, mode, search } = req.query;

        const query = { userId };

        if (mode && mode !== 'all') {
            query.mode = mode;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { topic: { $regex: search, $options: 'i' } },
            ];
        }

        const materials = await StudyMaterial.find(query)
            .select("name topic mode metadata createdAt")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await StudyMaterial.countDocuments(query);

        res.json({
            materials,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Get all study materials error:", error);
        res.status(500).json({ error: "Failed to get study materials" });
    }
}

// Delete study material
export async function deleteStudyMaterial(req, res) {
    try {
        const material = await StudyMaterial.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.userId,
        });

        if (!material) {
            return res.status(404).json({ error: "Study material not found" });
        }

        res.json({ message: "Study material deleted successfully" });
    } catch (error) {
        console.error("Delete study material error:", error);
        res.status(500).json({ error: "Failed to delete study material" });
    }
}
