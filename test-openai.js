import { generateComprehensiveMaterial } from "./server/controllers/openaiController.js";

const req = {
    body: {
        topic: "Structural Design Patterns - Flyweight Pattern",
        subtopics: ["Flyweight Pattern"],
        mode: "short",
        syllabusId: "69ac47f946d116e948054e6c"
    },
    user: {
        userId: "698c4045f869d1eb9f39e5e6"
    }
};

const res = {
    json: (data) => console.log("SUCCESS:", JSON.stringify(data).substring(0, 150) + "...."),
    status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
};

await generateComprehensiveMaterial(req, res);
process.exit(0);
