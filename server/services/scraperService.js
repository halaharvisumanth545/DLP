import * as cheerio from 'cheerio';
import axios from 'axios';

/**
 * Searches the web (via Wikipedia API) and scrapes the top result for a given query.
 * This approach bypasses strict search engine rate limits (like DuckDuckGo/Google).
 * @param {string} query - The search query
 * @param {number} maxResults - Max number of URLs to scrape
 * @returns {Promise<string>} - The concatenated text content from scraped pages
 */
export async function scrapeWebForContext(query, maxResults = 1) {
    try {
        console.log(`[Scraper] Searching Wikipedia for: "${query}"`);

        // 1. Search Wikipedia API for the topic
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
        const headers = { 'User-Agent': 'DLP-App-Scraper/1.0 (Contact: admin@example.com)' };
        const searchResponse = await axios.get(searchUrl, { headers });

        const searchResults = searchResponse.data?.query?.search;

        if (!searchResults || searchResults.length === 0) {
            console.warn('[Scraper] No Wikipedia results found.');
            return "";
        }

        // Only take the top result to keep context highly relevant
        const topResultTitle = searchResults[0].title;
        console.log(`[Scraper] Found Top Wikipedia Article: "${topResultTitle}"`);

        // 2. Fetch the actual HTML content of that page via Wikipedia API (parse)
        const contentUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(topResultTitle)}&format=json&prop=text`;
        const contentResponse = await axios.get(contentUrl, { headers });

        const htmlContent = contentResponse.data?.parse?.text?.['*'];
        if (!htmlContent) return "";

        // 3. Parse HTML and extract images and text
        const $ = cheerio.load(htmlContent);
        let extractedContext = '';

        $('p, h2, h3, h4').each((i, el) => {
            const text = $(el).text().trim();
            if (text) {
                extractedContext += text + '\n\n';
            }
        });

        // Limit the total context size so it fits well within AI token limits
        // Wikipedia articles can be massive, 10,000 chars is plenty of context for a Small AI
        let cleanedText = extractedContext.substring(0, 10000);

        return `### Source: Wikipedia - ${topResultTitle}\n\n${cleanedText}`;

    } catch (error) {
        console.error('[Scraper] Master error in scrapeWebForContext:', error.message);
        return ""; // Fail gracefully
    }
}

export default { scrapeWebForContext };
