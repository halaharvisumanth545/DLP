import { Syllabus } from "../models/Syllabus.js";
import { StudyMaterial } from "../models/StudyMaterial.js";
import { StudyMaterialChatSession } from "../models/StudyMaterialChatSession.js";
import { extractTopics } from "../utils/topicExtractor.js";
import { generateStudyContent } from "../services/openaiService.js";
import { extractTextFromPDF } from "../utils/pdfParser.js";
import { answerStudyMaterialQuery } from "../services/studyMaterialChatService.js";

function formatChatSessionSummary(session) {
    return {
        id: session._id,
        title: session.title,
        topic: session.topic,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
    };
}

function formatChatSessionDetail(session) {
    return {
        ...formatChatSessionSummary(session),
        messages: (session.messages || []).map((message) => ({
            id: message._id,
            role: message.role,
            text: message.text,
            sources: message.sources || [],
            inScope: message.inScope !== false,
            createdAt: message.createdAt,
        })),
    };
}

async function loadOwnedStudyMaterial(materialId, userId) {
    const material = await StudyMaterial.findOne({
        _id: materialId,
        userId,
    });

    if (!material) {
        throw new Error("Study material not found.");
    }

    return material;
}

async function loadOwnedChatSession({ sessionId, materialId, userId }) {
    const session = await StudyMaterialChatSession.findOne({
        _id: sessionId,
        materialId,
        userId,
    });

    if (!session) {
        throw new Error("Chat session not found.");
    }

    return session;
}

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
        const { syllabusId, topic, subtopic, mode = "intermediate" } = req.body;
        const userId = req.user.userId;

        if (!syllabusId || !topic || !subtopic) {
            return res.status(400).json({ error: "Syllabus ID, topic, and exactly one subtopic are required" });
        }

        // Verify syllabus belongs to user
        const syllabus = await Syllabus.findOne({ _id: syllabusId, userId });
        if (!syllabus) {
            return res.status(404).json({ error: "Syllabus not found" });
        }

        let material = null;
        const scopedTopic = `${topic} - ${subtopic}`;

        if (!material) {
            // Generate new content using OpenAI and RAG
            const generatedContent = await generateStudyContent(
                scopedTopic,
                mode, 
                syllabus.originalContent, 
                { userId, syllabusId }
            );

            const materialData = {
                userId,
                syllabusId,
                topic: scopedTopic,
                mode,
                content: generatedContent.content,
                sections: generatedContent.sections,
                metadata: {
                    wordCount: generatedContent.content.split(/\s+/).length,
                    estimatedReadTime: Math.ceil(generatedContent.content.split(/\s+/).length / 200),
                },
            };

            // Only auto-save if mode is not 'short'
            if (mode !== 'short') {
                material = await StudyMaterial.create(materialData);
            } else {
                // For 'short' mode, just return the data structure without saving
                material = {
                    _id: 'temp-' + Date.now(), // Give it a temporary ID for frontend rendering
                    ...materialData
                };
            }
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

export async function chatWithStudyMaterial(req, res) {
    try {
        const { query } = req.body || {};
        const userId = req.user.userId;
        const material = await loadOwnedStudyMaterial(req.params.id, userId);
        const session = await loadOwnedChatSession({
            sessionId: req.params.sessionId,
            materialId: material._id,
            userId,
        });

        if (typeof query !== "string" || query.trim().length === 0) {
            return res.status(400).json({ error: "A query is required." });
        }

        const trimmedQuery = query.trim();
        const userMessage = {
            role: "user",
            text: trimmedQuery,
            sources: [],
            inScope: true,
            createdAt: new Date(),
        };

        const reply = await answerStudyMaterialQuery({
            materialId: material._id,
            userId,
            query: trimmedQuery,
            history: session.messages,
        });

        const assistantMessage = {
            role: "assistant",
            text: reply.answer,
            sources: reply.sources || [],
            inScope: reply.inScope !== false,
            createdAt: new Date(),
        };

        session.messages.push(userMessage, assistantMessage);
        session.lastActivityAt = new Date();
        if (!session.title || session.title === "New chat") {
            session.title = trimmedQuery.length > 48 ? `${trimmedQuery.slice(0, 48).trim()}...` : trimmedQuery;
        }
        await session.save();

        res.json({
            session: formatChatSessionDetail(session),
            message: reply.answer,
            inScope: reply.inScope,
            sources: reply.sources,
        });
    } catch (error) {
        console.error("Study material chat error:", error);
        const status = error.message === "Study material not found." || error.message === "Chat session not found." ? 404 : 500;
        res.status(status).json({
            error: status === 404 ? error.message : "Failed to process the study material query.",
        });
    }
}

export async function createStudyMaterialChatSession(req, res) {
    try {
        const userId = req.user.userId;
        const material = await loadOwnedStudyMaterial(req.params.id, userId);

        const session = await StudyMaterialChatSession.create({
            userId,
            materialId: material._id,
            syllabusId: material.syllabusId,
            topic: material.topic,
            title: "New chat",
            messages: [
                {
                    role: "assistant",
                    text: `Ask me anything about ${material.topic}. I will answer from the study material for this topic.`,
                    sources: [],
                    inScope: true,
                },
            ],
            lastActivityAt: new Date(),
        });

        res.status(201).json({
            session: formatChatSessionDetail(session),
        });
    } catch (error) {
        console.error("Create study material chat session error:", error);
        const status = error.message === "Study material not found." ? 404 : 500;
        res.status(status).json({
            error: status === 404 ? error.message : "Failed to create the chat session.",
        });
    }
}

export async function listStudyMaterialChatSessions(req, res) {
    try {
        const userId = req.user.userId;
        const material = await loadOwnedStudyMaterial(req.params.id, userId);

        const sessions = await StudyMaterialChatSession.find({
            userId,
            materialId: material._id,
        })
            .sort({ lastActivityAt: -1, createdAt: -1 })
            .select("title topic messages createdAt lastActivityAt");

        res.json({
            sessions: sessions.map(formatChatSessionSummary),
        });
    } catch (error) {
        console.error("List study material chat sessions error:", error);
        const status = error.message === "Study material not found." ? 404 : 500;
        res.status(status).json({
            error: status === 404 ? error.message : "Failed to load chat history.",
        });
    }
}

export async function getStudyMaterialChatSession(req, res) {
    try {
        const userId = req.user.userId;
        const material = await loadOwnedStudyMaterial(req.params.id, userId);
        const session = await loadOwnedChatSession({
            sessionId: req.params.sessionId,
            materialId: material._id,
            userId,
        });

        res.json({
            session: formatChatSessionDetail(session),
        });
    } catch (error) {
        console.error("Get study material chat session error:", error);
        const status = error.message === "Study material not found." || error.message === "Chat session not found." ? 404 : 500;
        res.status(status).json({
            error: status === 404 ? error.message : "Failed to load the chat session.",
        });
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

        let materialsQuery = StudyMaterial.find(query)
            .select("name topic mode metadata createdAt syllabusId")
            .populate("syllabusId", "fileName")
            .sort({ createdAt: -1 });

        if (limit !== 'all') {
            materialsQuery = materialsQuery
                .skip((page - 1) * limit)
                .limit(parseInt(limit));
        }

        const materials = await materialsQuery;
        const total = await StudyMaterial.countDocuments(query);

        res.json({
            materials,
            pagination: limit === 'all' ? { total } : {
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

// Combine multiple study materials into a single one
export async function combineMaterials(req, res) {
    try {
        const { materialIds, name } = req.body;
        const userId = req.user.userId;

        if (!materialIds || !Array.isArray(materialIds) || materialIds.length === 0) {
            return res.status(400).json({ error: "Please provide an array of material IDs to combine." });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: "A name for the combined material is required." });
        }

        // Fetch all selected materials belonging to the user
        const materials = await StudyMaterial.find({
            _id: { $in: materialIds },
            userId: userId
        });

        if (materials.length === 0) {
            return res.status(404).json({ error: "No matching study materials found." });
        }

        // Maintain the order as requested by the user, if applicable, by sorting 
        // the fetched materials to match the input materialIds order
        const sortedMaterials = materialIds.map(id => materials.find(m => m._id.toString() === id)).filter(Boolean);

        let combinedContent = "";
        let combinedSections = [];
        let totalWordCount = 0;
        let totalEstimatedReadTime = 0;

        // Use the syllabusId of the first material as a reference 
        const syllabusId = sortedMaterials[0].syllabusId;

        // Concatenate content and merge metadata
        sortedMaterials.forEach((material, index) => {
            // Add a title separator for the content
            combinedContent += `\n\n# ${material.name || material.topic}\n\n`;
            combinedContent += material.content;

            // Merge sections nicely
            if (material.sections && material.sections.length > 0) {
                // If they have sections, we prefix their title or just push them
                material.sections.forEach(section => {
                    combinedSections.push({
                        title: `${material.name || material.topic} - ${section.title}`,
                        content: section.content,
                        keyPoints: section.keyPoints || []
                    });
                });
            } else {
                // If no sections but we want to turn it into a section for completeness:
                combinedSections.push({
                    title: material.name || material.topic,
                    content: material.content,
                    keyPoints: []
                });
            }

            if (material.metadata) {
                totalWordCount += material.metadata.wordCount || 0;
                totalEstimatedReadTime += material.metadata.estimatedReadTime || 0;
            }
        });

        // Create the new combined material
        const combinedMaterial = await StudyMaterial.create({
            userId,
            syllabusId,
            topic: "Combined Material",
            name: name,
            mode: "combined",
            content: combinedContent,
            sections: combinedSections,
            metadata: {
                wordCount: totalWordCount || combinedContent.split(/\s+/).length,
                estimatedReadTime: totalEstimatedReadTime || Math.ceil(combinedContent.split(/\s+/).length / 200),
            }
        });

        res.status(201).json({
            message: "Study materials combined successfully",
            material: {
                id: combinedMaterial._id,
                name: combinedMaterial.name,
                topic: combinedMaterial.topic,
                mode: combinedMaterial.mode,
                createdAt: combinedMaterial.createdAt,
            }
        });

    } catch (error) {
        console.error("Combine study materials error:", error);
        res.status(500).json({ error: "Failed to combine study materials" });
    }
}
