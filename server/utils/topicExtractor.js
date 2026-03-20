import { generateJSON } from "../config/openai.js";

// Extract topics from syllabus content using AI
export async function extractTopics(content) {
    const prompt = `Analyze this syllabus/course content and extract structured topics.

Content:
${content.substring(0, 4000)}

Return a JSON array of topics:
[
  {
    "name": "Main Topic Name",
    "subtopics": ["Subtopic 1", "Subtopic 2", "Subtopic 3"],
    "estimatedHours": 5
  }
]

Extract all major topics and their subtopics. Estimate study hours based on complexity.
Be thorough but concise with topic names.`;

    try {
        const result = await generateJSON(prompt, { maxTokens: 1500 });

        let extracted = [];
        if (Array.isArray(result)) {
            extracted = result;
        } else if (result.topics && Array.isArray(result.topics)) {
            extracted = result.topics;
        }

        if (extracted.length > 0) {
            return extracted;
        }
        
        throw new Error("AI returned no topics, using fallback");
    } catch (error) {
        console.error("Topic extraction error:", error);
        // Fallback: basic extraction
        return extractTopicsBasic(content);
    }
}

// Basic topic extraction without AI (fallback)
export function extractTopicsBasic(content) {
    const topics = [];
    const lines = content.split("\n");

    // Common patterns for topic headers
    const headerPatterns = [
        /^#+\s*(.+)/, // Markdown headers
        /^(?:unit|chapter|module|topic|section)\s*[\d.:]+\s*(.+)/i,
        /^[\d.]+\s+([A-Z][^.]+)/, // Numbered items starting with capital
        /^\*\*(.+)\*\*$/, // Bold text
    ];

    let currentTopic = null;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        let isHeader = false;
        // Check if line matches a header pattern
        for (const pattern of headerPatterns) {
            const match = trimmedLine.match(pattern);
            if (match) {
                if (currentTopic) {
                    topics.push(currentTopic);
                }
                currentTopic = {
                    name: match[1].trim(),
                    subtopics: [],
                    estimatedHours: 2, // Default estimate
                };
                isHeader = true;
                break;
            }
        }

        if (isHeader) continue;

        // Check for subtopics (indented or bulleted items)
        if (currentTopic) {
            const subtopicPatterns = [
                /^[-•*]\s*(.+)/, // Bullet points
                /^\s+[-•*]\s*(.+)/, // Indented bullets
                /^[a-z]\)\s*(.+)/i, // a) b) c) format
                /^\d+\.\d+\s+(.+)/, // 1.1, 1.2 format
            ];

            let matchedSubtopic = false;
            for (const pattern of subtopicPatterns) {
                const match = trimmedLine.match(pattern);
                if (match && match[1].length > 3 && match[1].length < 100) {
                    currentTopic.subtopics.push(match[1].trim());
                    matchedSubtopic = true;
                    break;
                }
            }
            
            // If it's regular text under a header, treat it as a subtopic
            if (!matchedSubtopic && trimmedLine.length > 3 && trimmedLine.length < 150) {
                currentTopic.subtopics.push(trimmedLine);
            }
        }
    }

    if (currentTopic) {
        topics.push(currentTopic);
    }

    // If no topics found, create a single general topic
    if (topics.length === 0) {
        topics.push({
            name: "General Content",
            subtopics: [],
            estimatedHours: 5,
        });
    }

    return topics;
}

// Extract keywords from content
export function extractKeywords(content, maxKeywords = 20) {
    // Remove common stop words
    const stopWords = new Set([
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "must", "can", "and", "or", "but", "if",
        "then", "else", "when", "where", "why", "how", "what", "which", "who",
        "this", "that", "these", "those", "it", "its", "to", "of", "in", "for",
        "on", "with", "as", "at", "by", "from", "about", "into", "through",
        "during", "before", "after", "above", "below", "between", "under",
        "again", "further", "once", "here", "there", "all", "each", "few",
        "more", "most", "other", "some", "such", "no", "nor", "not", "only",
        "own", "same", "so", "than", "too", "very", "just", "also",
    ]);

    // Extract words
    const words = content
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !stopWords.has(word));

    // Count frequency
    const frequency = {};
    words.forEach((word) => {
        frequency[word] = (frequency[word] || 0) + 1;
    });

    // Sort by frequency and return top keywords
    return Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKeywords)
        .map(([word]) => word);
}
