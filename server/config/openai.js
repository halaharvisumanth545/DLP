import dotenv from 'dotenv';
dotenv.config();

import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const openaiClient = OPENAI_API_KEY
    ? new OpenAI({ apiKey: OPENAI_API_KEY })
    : null;

export async function generateTextReply(input, options = {}) {
    const {
        systemPrompt = "You are a helpful academic assistant.",
        model,
        maxTokens = 600,
        temperature = 0.2,
        fallbackText = "I could not generate a response at this time.",
    } = options;

    if (!openaiClient) {
        return fallbackText;
    }

    const messages = [
        { role: "system", content: systemPrompt },
    ];

    if (Array.isArray(input)) {
        messages.push(...input);
    } else {
        messages.push({ role: "user", content: String(input || "") });
    }

    try {
        const response = await openaiClient.chat.completions.create({
            model: model || DEFAULT_OPENAI_MODEL,
            messages,
            max_tokens: maxTokens,
            temperature,
        });

        const content = response.choices?.[0]?.message?.content?.trim();
        return content || fallbackText;
    } catch (error) {
        console.warn(`[AI] Text reply generation failed for ${model || DEFAULT_OPENAI_MODEL}: ${error.message}`);
        return fallbackText;
    }
}

export async function generateCompletion(prompt, options = {}) {
    const {
        model,
        maxTokens = 2000,
        temperature = 0.7,
        response_format,
        fallbackContext = "",
        validate = null,
        allowFallback = true,
    } = options;

    const systemPrompt = `You are an expert university professor with 20+ years of experience in teaching complex topics clearly and accurately. Your goal is to generate highly professional, error-free, and perfectly structured study materials and questions.
    
    CRITICAL INSTRUCTIONS:
    1. ALWAYS maintain a formal, academic tone. Do NOT use emojis, slang, or overly casual language.
    2. Explanations must be concise, logically organized, and factually accurate.
    3. If providing examples or context, ensure they are highly relevant and accurate.
    4. You MUST output your response in valid JSON format only, exactly matching the requested schema. Ensure the JSON is complete properly before outputting.
    5. NEVER leave any requested section, subsection, field, key point, example, explanation, or code block empty, placeholder-like, or incomplete.
    6. If code is requested, it must be internally consistent, runnable in principle, and aligned with the explanation, input, and output.
    7. Before finalizing, self-check that every required JSON field contains meaningful, non-empty content and that all requested sections are fully completed.`;

    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 2000;
    const selectedModel = model || DEFAULT_OPENAI_MODEL;

    const callOpenAI = async (attempt = 1) => {
        if (!openaiClient) {
            console.log("[AI] No OpenAI API key found. Skipping OpenAI generation...");
            return null;
        }

        const createOptions = {
            model: selectedModel,
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
            console.log(`[AI] Attempting OpenAI generation (${selectedModel})...`);
            const response = await openaiClient.chat.completions.create(createOptions);
            const content = response.choices?.[0]?.message?.content || "";

            if (!content) {
                throw new Error("OpenAI returned empty content");
            }

            if (validate) {
                try {
                    validate(content);
                } catch (err) {
                    throw new Error(`Output validation failed: ${err.message}`);
                }
            }

            console.log(`[AI] OpenAI generation successful (${selectedModel}).`);
            return content;
        } catch (error) {
            if (error.status === 429 && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                console.warn(`[AI] Rate-limited on ${selectedModel} (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return callOpenAI(attempt + 1);
            }
            throw error;
        }
    };

    try {
        return await callOpenAI();
    } catch (error) {
        console.warn(`[AI] OpenAI generation failed for ${selectedModel}: ${error.message}`);

        if (!allowFallback) {
            throw error;
        }

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
}

// Helper for generating structured JSON responses — mostly unchanged
export async function generateJSON(prompt, options = {}) {
    const { schema, postValidate, attempts = 1, ...restOptions } = options;

    const formatOpt = { type: "json_object" };
    if (schema) {
        formatOpt.schema = schema;
    }

    const repairTruncatedJSON = (str) => {
        let fixed = str.trim();
        const quoteCount = (fixed.match(/"/g) || []).length;
        const escapedQuoteCount = (fixed.match(/\\"/g) || []).length;
        const actualQuotes = quoteCount - escapedQuoteCount;
        if (actualQuotes % 2 !== 0) {
            fixed += '"';
        }

        if (fixed.endsWith(',')) fixed = fixed.slice(0, -1);

        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;

        const missingBraces = Math.max(0, openBraces - closeBraces);
        const missingBrackets = Math.max(0, openBrackets - closeBrackets);

        for (let i = 0; i < missingBrackets; i++) fixed += ']';
        for (let i = 0; i < missingBraces; i++) fixed += '}';

        return fixed;
    };

    const checkRequired = (parsed) => {
        if (schema && schema.required && Array.isArray(schema.required)) {
            for (const reqKey of schema.required) {
                if (parsed[reqKey] === undefined || parsed[reqKey] === null) {
                    throw new Error(`Missing required key: ${reqKey}`);
                }
            }
        }
    };

    const validateJSONContent = (content) => {
        let cleanedResponse = content.trim();
        const jsonMatch = cleanedResponse.match(/```json\s*([\s\S]*?)\s*```/i);
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

        try {
            const parsed = JSON.parse(cleanedResponse);
            checkRequired(parsed);
        } catch (e) {
            const fixedJSON = repairTruncatedJSON(cleanedResponse);
            const fixedParsed = JSON.parse(fixedJSON);
            checkRequired(fixedParsed);
        }
    };

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

    const parseStructuredResponse = (response) => {
        let cleanedResponse = response.trim();

        const jsonMatch = cleanedResponse.match(/```json\s*([\s\S]*?)\s*```/i);
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
        cleanedResponse = cleanedResponse.replace(/\\r/g, '\\\\r')
            .replace(/\\t/g, '\\\\t')
            .replace(/\\f/g, '\\\\f')
            .replace(/\\b/g, '\\\\b');

        console.log("Raw AI Response Length:", cleanedResponse.length);

        try {
            const parsed = JSON.parse(cleanedResponse);
            return restoreLatex(parsed);
        } catch (e) {
            console.error(`JSON parsing failed natively: ${e.message}`);
            console.log("Attempting aggressive JSON truncation repair...");
            const fixedJSON = repairTruncatedJSON(cleanedResponse);
            const parsed = JSON.parse(fixedJSON);
            console.log("JSON rescue successful!");
            return restoreLatex(parsed);
        }
    };

    let finalPrompt = prompt + "\n\nIMPORTANT: Respond with ONLY the raw valid JSON object matching the requested format. Do NOT wrap it in markdown code blocks or any other formatting.";

    if (schema) {
        finalPrompt += "\n\nUse this JSON schema for the output:\n" + JSON.stringify(schema, null, 2);
    }

    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const response = await generateCompletion(
                finalPrompt,
                { ...restOptions, temperature: 0.3, response_format: formatOpt, validate: validateJSONContent, allowFallback: false }
            );

            const parsed = parseStructuredResponse(response);
            if (postValidate) {
                postValidate(parsed);
            }

            return parsed;
        } catch (error) {
            lastError = error;
            console.warn(`[AI] Structured output validation failed (attempt ${attempt}/${attempts}): ${error.message}`);
        }
    }

    throw lastError || new Error("OpenAI returned invalid JSON");
}

export default { generateCompletion, generateJSON };
