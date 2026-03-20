// =============================================
// COMMENTED OUT: Original Groq and Gemini imports
// =============================================
// import Groq from "groq-sdk";
// import { GoogleGenerativeAI } from "@google/generative-ai";

import dotenv from 'dotenv';
dotenv.config();

// =============================================
// NEW: GitHub Models Configuration via OpenAI SDK
// =============================================
import OpenAI from "openai";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const githubClient = GITHUB_TOKEN ? new OpenAI({ 
    baseURL: "https://models.inference.ai.azure.com", 
    apiKey: GITHUB_TOKEN 
}) : null;

// GitHub Models Free Tier chain
const FREE_MODELS = [
    "gpt-4o-mini", // Blazing fast, cheap/free
    "gpt-4o",      // Best quality
    "Cohere-command-r-plus-08-2024",
    "Meta-Llama-3.1-70B-Instruct"
];

export async function generateCompletion(prompt, options = {}) {
    const {
        model,  // Will use FREE_MODELS chain if not explicitly set
        maxTokens = 2000,
        temperature = 0.7,
        response_format,
        fallbackContext = "", // Raw scraped text to fallback on if everything fails

        // COMMENTED OUT: Original Groq/Gemini model options
        // groqModel = "llama-3.1-8b-instant",
        // geminiModel = "gemini-2.5-flash",
        // forceModel,
        
        // NEW: Validation callback for ensuring valid output before accepting it
        validate = null 
    } = options;

    let systemPrompt = `You are an expert university professor with 20+ years of experience in teaching complex topics clearly and accurately. Your goal is to generate highly professional, error-free, and perfectly structured study materials and questions.
    
    CRITICAL INSTRUCTIONS:
    1. ALWAYS maintain a formal, academic tone. Do NOT use emojis, slang, or overly casual language.
    2. Explanations must be concise, logically organized, and factually accurate.
    3. If providing examples or context, ensure they are highly relevant and accurate.
    4. You MUST output your response in valid JSON format only, exactly matching the requested schema. Ensure the JSON is complete properly before outputting.`;

    // =============================================
    // NEW: GitHub Models provider with retry + multi-model fallback
    // =============================================
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 2000;

    const callGithubModels = async (modelId, attempt = 1) => {
        const createOptions = {
            model: modelId,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            max_tokens: maxTokens,
            temperature: temperature,
        };

        if (response_format && response_format.type === "json_object") {
            createOptions.response_format = { type: "json_object" };
        }

        try {
            const response = await githubClient.chat.completions.create(createOptions);
            const content = response.choices?.[0]?.message?.content || "";

            if (!content) {
                throw new Error("GitHub Models returned empty content");
            }

            // Add validation to ensure we don't return truncated JSON
            if (validate) {
                try {
                    validate(content);
                } catch (err) {
                    throw new Error(`Output validation failed: ${err.message}`);
                }
            }

            return content;
        } catch (error) {
            // If rate-limited (429), retry with exponential backoff
            if (error.status === 429 && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                console.warn(`[AI] Rate-limited on ${modelId} (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return callGithubModels(modelId, attempt + 1);
            }
            throw error;
        }
    };

    const tryGithubModels = async () => {
        if (!githubClient) {
            console.log(`[AI] No GitHub Token found. Skipping GitHub Models...`);
            return null;
        }

        const modelsToTry = model ? [model, ...FREE_MODELS.filter(m => m !== model)] : [...FREE_MODELS];

        for (const modelId of modelsToTry) {
            try {
                console.log(`[AI] Attempting GitHub Models Generation (${modelId})...`);
                const result = await callGithubModels(modelId);
                console.log(`[AI] GitHub Models Generation Successful (${modelId}).`);
                return result;
            } catch (error) {
                console.warn(`[AI] GitHub Models failed for ${modelId}: ${error.message}`);
            }
        }

        console.error(`[AI] All GitHub Models exhausted.`);
        return null;
    };

    // =============================================
    // COMMENTED OUT: Original tryGroq function
    // =============================================
    /*
    const tryGroq = async () => {
        if (!groqClient) {
            console.log(`[AI] No Groq API Key found. Skipping Groq...`);
            return null;
        }
        try {
            console.log(`[AI] Attempting Groq Generation (${groqModel})...`);
            const createOptions = {
                model: groqModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                max_tokens: maxTokens,
                temperature: temperature,
            };

            if (response_format && response_format.type === "json_object") {
                createOptions.response_format = { type: "json_object" };
            }

            const response = await groqClient.chat.completions.create(createOptions);
            console.log(`[AI] Groq Generation Successful.`);
            return response.choices[0]?.message?.content || "";
        } catch (error) {
            console.warn(`[AI] Groq failed or limit reached: ${error.message}`);
            return null;
        }
    };
    */

    // =============================================
    // COMMENTED OUT: Original tryGemini function
    // =============================================
    /*
    const tryGemini = async () => {
        if (!genAI) {
            console.log(`[AI] No Gemini API Key found. Skipping Gemini...`);
            return null;
        }
        try {
            console.log(`[AI] Attempting Gemini Generation (${geminiModel})...`);
            const model = genAI.getGenerativeModel({
                model: geminiModel,
                systemInstruction: systemPrompt
            });

            const generationConfig = {
                temperature: temperature,
                maxOutputTokens: maxTokens,
            };

            if (response_format && response_format.type === "json_object") {
                generationConfig.responseMimeType = "application/json";
                if (response_format.schema) {
                    const convertSchemaTypes = (schema) => {
                        if (!schema || typeof schema !== "object") return schema;
                        const newSchema = Array.isArray(schema) ? [] : {};
                        for (const key in schema) {
                            if (key === "type" && typeof schema[key] === "string") {
                                newSchema[key] = schema[key].toLowerCase();
                            } else if (typeof schema[key] === "object") {
                                newSchema[key] = convertSchemaTypes(schema[key]);
                            } else {
                                newSchema[key] = schema[key];
                            }
                        }
                        return newSchema;
                    };
                    generationConfig.responseSchema = convertSchemaTypes(response_format.schema);
                }
            }

            const chatSession = model.startChat({ generationConfig });
            const result = await chatSession.sendMessage(prompt);
            console.log(`[AI] Gemini Generation Successful.`);
            return result.response.text();
        } catch (error) {
            console.warn(`[AI] Gemini failed or limit reached: ${error.message}`);
            return null;
        }
    };
    */

    let finalContent = null;

    // =============================================
    // NEW: Single provider chain — GitHub Models only
    // =============================================
    finalContent = await tryGithubModels();

    // =============================================
    // COMMENTED OUT: Original fallback chain with forceModel support
    // =============================================
    /*
    if (forceModel === "gemini") {
        finalContent = await tryGemini();
        if (!finalContent) {
            console.warn(`[AI] Gemini forced but failed. Falling back to Groq...`);
            finalContent = await tryGroq();
        }
    } else if (forceModel === "groq") {
        finalContent = await tryGroq();
        if (!finalContent) {
            console.warn(`[AI] Groq forced but failed. Falling back to Gemini...`);
            finalContent = await tryGemini();
        }
    } else {
        // Default: Try Groq first, then Gemini
        finalContent = await tryGroq();
        if (!finalContent) {
            console.warn(`[AI] Default Groq failed. Falling back to Gemini...`);
            finalContent = await tryGemini();
        }
    }
    */

    if (finalContent) return finalContent;

    // Ultimate Fallback (Raw Context) — unchanged
    console.error(`[AI] ALL AI FALLBACKS FAILED OR UNAVAILABLE.`);

    if (response_format && response_format.type === "json_object") {
        const fallbackText = fallbackContext || "No context was found for this query.";
        const paragraphs = fallbackText.split('\\n\\n').map(p => `<p>${p.trim()}</p>`).join('');

        return JSON.stringify({
            sections: [
                {
                    title: "Automated Context Retrieval",
                    content: `<blockquote><strong>Notice:</strong> We were unable to synthesize a polished response at this time. Here is the direct information retrieved from our web sources.</blockquote>\\n${paragraphs}`,
                    keyPoints: ["Generated via automated text retrieval", "Web context fallback system"]
                }
            ]
        });
    }

    return fallbackContext || "AI generation is temporarily unavailable and no context was found.";
}

// Helper for generating structured JSON responses — mostly unchanged
export async function generateJSON(prompt, options = {}) {
    const { schema, ...restOptions } = options;

    const formatOpt = { type: "json_object" };
    if (schema) {
        formatOpt.schema = schema;
    }

    // Build aggressive JSON repair function to handle truncated free-tier outputs
    const repairTruncatedJSON = (str) => {
        let fixed = str.trim();
        // 1. If it ends in the middle of a string, close the string
        const quoteCount = (fixed.match(/"/g) || []).length;
        // Escape quotes don't count towards open/close toggle
        const escapedQuoteCount = (fixed.match(/\\"/g) || []).length;
        const actualQuotes = quoteCount - escapedQuoteCount;
        if (actualQuotes % 2 !== 0) {
            fixed += '"';
        }
        
        // If it ends in a comma, remove it before closing objects
        if (fixed.endsWith(',')) fixed = fixed.slice(0, -1);
        
        // 2. Count open vs closed brackets/braces
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;
        
        // 3. Close them
        const missingBraces = Math.max(0, openBraces - closeBraces);
        const missingBrackets = Math.max(0, openBrackets - closeBrackets);
        
        // Very basic closing order (fails on complex nesting if cut exactly wrong, but saves 90% of cases)
        for (let i = 0; i < missingBrackets; i++) fixed += ']';
        for (let i = 0; i < missingBraces; i++) fixed += '}';
        
        return fixed;
    };

    // Validation callback ensures bad JSON throws and auto-retries the next model!
    const validateJSONContent = (content) => {
        let cleanedResponse = content.trim();
        const jsonMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (jsonMatch) {
            cleanedResponse = jsonMatch[1].trim();
        } else {
            const firstBracket = cleanedResponse.search(/[{[]/);
            const lastBracket = Math.max(cleanedResponse.lastIndexOf('}'), cleanedResponse.lastIndexOf(']'));
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket >= firstBracket) {
                cleanedResponse = cleanedResponse.substring(firstBracket, lastBracket + 1);
            }
        }
        cleanedResponse = cleanedResponse.replace(/,(\s*[}\]])/g, '$1');
        
        const checkRequired = (parsed) => {
            if (schema && schema.required && Array.isArray(schema.required)) {
                for (const reqKey of schema.required) {
                    if (parsed[reqKey] === undefined || parsed[reqKey] === null) {
                        throw new Error(`Missing required key: ${reqKey}`);
                    }
                }
            }
        };

        try {
            const parsed = JSON.parse(cleanedResponse);
            checkRequired(parsed);
        } catch (e) {
            // Try repairing it during validation. If repair fails too, throw to trigger fallback!
            const fixedJSON = repairTruncatedJSON(cleanedResponse);
            const fixedParsed = JSON.parse(fixedJSON); // Will throw if STILL invalid (e.g., truncated drastically)
            checkRequired(fixedParsed); // Throw if missing required keys even after syntactic repair
        }
    };

    let finalPrompt = prompt + "\n\nIMPORTANT: Respond with ONLY the raw valid JSON object matching the requested format. Do NOT wrap it in markdown code blocks or any other formatting.";

    if (schema) {
        finalPrompt += "\n\nUse this JSON schema for the output:\n" + JSON.stringify(schema, null, 2);
    }

    const response = await generateCompletion(
        finalPrompt,
        { ...restOptions, temperature: 0.3, response_format: formatOpt, validate: validateJSONContent }
    );

    // Clean the response - remove markdown code block wrappers
    let cleanedResponse = response.trim();

    // Robustly extract JSON block if wrapped in markdown
    const jsonMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch) {
        cleanedResponse = jsonMatch[1].trim();
    } else {
        // Fallback: try to find the first { or [ and last } or ]
        const firstBracket = cleanedResponse.search(/[{[]/);
        const lastBracket = Math.max(cleanedResponse.lastIndexOf('}'), cleanedResponse.lastIndexOf(']'));
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket >= firstBracket) {
            cleanedResponse = cleanedResponse.substring(firstBracket, lastBracket + 1);
        }
    }

    // Fix trailing commas
    cleanedResponse = cleanedResponse.replace(/,(\s*[}\]])/g, '$1');

    // TACTICAL LATEX RESCUE:
    // Gemini SDK auto-escapes invalid JSON sequences (e.g. `\end` -> `\\end`), but leaves 
    // overlapping VALID JSON control sequences alone (`\text` -> Tab + 'ext'). 
    // We forcibly double the backslashes strictly for `r, t, f, b` to save the LaTeX!
    cleanedResponse = cleanedResponse.replace(/\\r/g, '\\\\r') // \rightarrow, \rho
        .replace(/\\t/g, '\\\\t') // \text, \theta
        .replace(/\\f/g, '\\\\f') // \frac
        .replace(/\\b/g, '\\\\b'); // \begin, \beta

    console.log("Raw AI Response Length:", cleanedResponse.length);

    const restoreLatex = (obj) => {
        if (typeof obj === 'string') {
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

    // repairTruncatedJSON is now declared above for validation

    try {
        const parsed = JSON.parse(cleanedResponse);
        return restoreLatex(parsed);
    } catch (e) {
        console.error(`JSON parsing failed natively: ${e.message}`);
        
        try {
            console.log("Attempting aggressive JSON truncation repair...");
            const fixedJSON = repairTruncatedJSON(cleanedResponse);
            const parsed = JSON.parse(fixedJSON);
            console.log("JSON rescue successful!");
            return restoreLatex(parsed);
        } catch (e2) {
            console.error(`Aggressive repair failed: ${e2.message}`);
        }

        console.log("All parsing attempts failed - returning text fallback");
        
        const fallbackText = cleanedResponse.replace(/\|\|\|/g, '\\\\');
        const paragraphs = fallbackText.split('\\n\\n').map(p => `<p>${p.trim()}</p>`).join('');
        
        return {
            title: "Automated Context Retrieval",
            overview: "",
            content: `<blockquote><strong>Notice:</strong> We encountered a formatting error synthesizing this response (likely due to token limits). Here is the raw data retrieved.</blockquote>\n${paragraphs}`,
            sections: []
        };
    }
}

export default { generateCompletion, generateJSON };
