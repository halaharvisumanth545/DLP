import OpenAI from "openai";

// Lazy initialization - only create client when needed
let openaiClient = null;

function getOpenAIClient() {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey || apiKey === "your_openai_api_key_here") {
            console.warn("⚠️  OPENAI_API_KEY not configured - AI features will use fallback responses");
            return null;
        }

        openaiClient = new OpenAI({ apiKey });
    }
    return openaiClient;
}

// Helper function to generate chat completions
export async function generateCompletion(prompt, options = {}) {
    const client = getOpenAIClient();

    if (!client) {
        // Return fallback response when API key not configured
        return "AI generation is not available. Please configure OPENAI_API_KEY in your .env file.";
    }

    const {
        model = "gpt-4o-mini",  // Upgraded default model
        maxTokens = 1000,
        temperature = 0.7,
    } = options;

    try {
        const response = await client.chat.completions.create({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: maxTokens,
            temperature,
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI API Error:", error);
        throw error;
    }
}

// Helper for generating structured JSON responses
export async function generateJSON(prompt, options = {}) {
    const client = getOpenAIClient();

    if (!client) {
        // Return demo fallback response when API key not configured
        console.log("OpenAI API key not configured - returning demo content");
        return {
            sections: [
                {
                    title: "AI Generation Unavailable",
                    content: "The OpenAI API key is not configured. To enable AI-powered study material generation, please configure your OPENAI_API_KEY in the server's .env file. Once configured, this feature will generate comprehensive, personalized study materials based on your selected topic and study mode.",
                    keyPoints: [
                        "Configure OPENAI_API_KEY in server/.env",
                        "Restart the server after configuration",
                        "AI will generate personalized study content"
                    ]
                }
            ]
        };
    }

    const response = await generateCompletion(
        prompt + "\n\nIMPORTANT: Respond with ONLY the raw JSON object. Do NOT wrap it in markdown code blocks or any other formatting.",
        { ...options, temperature: 0.3 }
    );

    // Clean the response - remove markdown code block wrappers
    let cleanedResponse = response.trim();

    // Remove ```json or ``` wrappers (handle various formats)
    if (cleanedResponse.startsWith('```')) {
        // Remove opening code block
        cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '');
        // Remove closing code block
        cleanedResponse = cleanedResponse.replace(/\n?```\s*$/i, '');
    }

    // Fix common JSON formatting issues
    // Remove trailing commas which are invalid in JSON but common in AI output
    cleanedResponse = cleanedResponse.replace(/,(\s*[}\]])/g, '$1');

    /**
     * Recursive function to replace @@ placeholders with backslashes
     * This allows us to parse valid JSON first, then restore LaTeX backslashes 
     * without fighting the JSON parser.
     */
    // Log raw response for debugging
    console.log("Raw AI Response Length:", cleanedResponse.length);

    /**
     * Recursive function to replace ||| placeholders with actual backslashes
     * This allows us to parse valid JSON first, then restore LaTeX backslashes 
     * without fighting the JSON parser.
     */
    const restoreLatex = (obj) => {
        if (typeof obj === 'string') {
            // Replace ||| with \
            // In JS string literal, \\ matches a single backslash.
            return obj.replace(/\|\|\|/g, '\\');
        }
        if (Array.isArray(obj)) {
            return obj.map(restoreLatex);
        }
        if (obj && typeof obj === 'object') {
            const newObj = {};
            for (const key in obj) {
                newObj[key] = restoreLatex(obj[key]);
            }
            return newObj;
        }
        return obj;
    };

    try {
        // ATTEMPT 1: Parse with ||| placeholders intact (Resulting JSON should be valid)
        const parsed = JSON.parse(cleanedResponse);
        return restoreLatex(parsed);
    } catch (e) {
        console.error("JSON parsing failed:", e.message);
        console.log("Failed Response Start:", cleanedResponse.substring(0, 500));

        // Simpler fallback - just try to fix common JSON errors without regex magic
        try {
            // Sometimes AI adds a comma at the end
            const fixed = cleanedResponse.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            const parsed = JSON.parse(fixed);
            return restoreLatex(parsed);
        } catch (e2) {
            console.error("Retry parsing failed:", e2.message);
        }

        // Final fallback: Return structured content directly
        console.log("All parsing attempts failed - returning text fallback");
        return {
            title: "Content Generated",
            overview: "",
            content: cleanedResponse.replace(/\|\|\|/g, '\\'), // Restore LaTeX in text fallback too
            sections: [] // Empty sections so it renders the main content
        };
    }
}

export default { generateCompletion, generateJSON, getOpenAIClient };
