// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Anthropic client (server-side, secure)
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const SYSTEM_PROMPT = `You are a web development assistant. 

CRITICAL JSON FORMATTING RULES:
1. You MUST respond with ONLY valid JSON
2. You MUST find all the color Hex in the code. Prepare to use them when user ask for color
3. Use proper JSON escaping for special characters:
   - Newlines must be \\n (not literal newlines)
   - Quotes must be \\"
   - Backslashes must be \\\\
4. The class name of the element must contain timestamp to prevent same class name collision on css
5. if the source code contain any image, you must remember the alt text of the image as the image name, then if user want to use the image, you must use the image alt text as the image name
6. Format:
{
  "message": "Description of changes and the color Hex found in the code",
  "html": "Complete HTML code with proper escaping",
  "css": "Complete CSS code with proper escaping",
  "js": "Complete JavaScript code with proper escaping"
}
IMPORTANT: 
- Do NOT include <script src="script.js"> or <link rel="stylesheet" href="style.css"> tags.
- Design: ALWAYS create full-width, edge-to-edge layouts unless a specific component is requested.
- Scaling: Ensure the main container/body fills the entire viewport width (100%) and height (100vh) where appropriate. Avoid small fixed-width "containers" in the middle of the page.
- All logic and styles must be in the "js" and "css" fields or inlined if necessary.
- Use only the code part that must be changed or added. Do NOT include any code that is not necessary.

Do NOT wrap in markdown code blocks.
ONLY return the raw JSON object.`;

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Claude API Service'
    });
});

// Main code update endpoint
app.post('/api/code/update', async (req, res) => {
    try {
        const { history, currentHtml, currentCss, currentJs } = req.body;

        // Validation
        if (!history || !Array.isArray(history)) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'history must be an array'
            });
        }

        // Build messages array
        const messages = [
            ...history.map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : 'user',
                content: msg.content
            })),
            {
                role: 'user',
                content: `Current Code State:
HTML:
${currentHtml || ''}

CSS:
${currentCss || ''}

JS:
${currentJs || ''}

Task: Please update the code based on my previous requests. Return ONLY valid JSON.`
            }
        ];

        console.log('Sending request to Claude API...');

        // Call Claude API
        const msg = await anthropic.messages.create({
            model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
            max_tokens: parseInt(process.env.MAX_TOKENS) || 8192,
            system: SYSTEM_PROMPT,
            messages: messages,
        });

        const responseText = msg.content[0].text;

        console.log("Raw response length:", responseText.length);

        // AGGRESSIVE MARKDOWN REMOVAL
        let jsonText = responseText.trim();

        // Method 1: Remove markdown code blocks with regex
        jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

        // Method 2: If still has backticks, find the JSON object directly
        if (jsonText.includes('```')) {
            const firstBrace = jsonText.indexOf('{');
            const lastBrace = jsonText.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonText = jsonText.substring(firstBrace, lastBrace + 1);
            }
        }

        // Final cleanup
        jsonText = jsonText.trim();

        console.log("Cleaned JSON (first 200 chars):", jsonText.substring(0, 200));
        console.log("Cleaned JSON (last 200 chars):", jsonText.substring(jsonText.length - 200));

        // Parse with better error handling
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError.message);
            console.error("Failed at position:", parseError.message.match(/position (\d+)/)?.[1]);
            console.error("Problematic section:", jsonText.substring(
                Math.max(0, (parseError.message.match(/position (\d+)/)?.[1] || 0) - 50),
                Math.min(jsonText.length, (parseError.message.match(/position (\d+)/)?.[1] || 0) + 50)
            ));

            // Last resort: try to extract manually
            console.log("Attempting manual extraction...");
            const messageMatch = jsonText.match(/"message"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/);
            const htmlMatch = jsonText.match(/"html"\s*:\s*"([\s\S]*?)"\s*,\s*"css"/);
            const cssMatch = jsonText.match(/"css"\s*:\s*"([\s\S]*?)"\s*,\s*"js"/);
            const jsMatch = jsonText.match(/"js"\s*:\s*"([\s\S]*?)"\s*\}/);

            if (messageMatch || htmlMatch) {
                parsed = {
                    message: messageMatch ? messageMatch[1] : 'Code updated',
                    html: htmlMatch ? htmlMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : currentHtml,
                    css: cssMatch ? cssMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : currentCss,
                    js: jsMatch ? jsMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : currentJs
                };
                console.log("✅ Manual extraction successful");
            } else {
                throw parseError;
            }
        }

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Invalid response format');
        }

        console.log("✅ Successfully parsed response");
        console.log("Message:", parsed.message);
        console.log("HTML length:", parsed.html?.length || 0);
        console.log("CSS length:", parsed.css?.length || 0);
        console.log("JS length:", parsed.js?.length || 0);

        // Send successful response
        res.json({
            success: true,
            message: parsed.message || 'Code updated successfully',
            html: parsed.html || currentHtml || '',
            css: parsed.css || currentCss || '',
            js: parsed.js || currentJs || ''
        });

    } catch (error) {
        console.error("❌ Error processing request:", error.message);

        // Handle specific error types
        if (error.status === 401) {
            return res.status(401).json({
                success: false,
                error: 'Authentication failed',
                message: 'Invalid API key'
            });
        }

        if (error.status === 429) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: 'Too many requests. Please try again later.'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message || 'Failed to process request',
            html: req.body.currentHtml || '',
            css: req.body.currentCss || '',
            js: req.body.currentJs || ''
        });
    }
});

// Analyze code endpoint (extract colors, get suggestions)
app.post('/api/code/analyze', async (req, res) => {
    try {
        const { html, css, js } = req.body;

        const messages = [{
            role: 'user',
            content: `Analyze this code and extract all color hex codes. Also provide brief suggestions:

HTML:
${html || ''}

CSS:
${css || ''}

JS:
${js || ''}

Return ONLY valid JSON with this format:
{
  "colors": ["#hex1", "#hex2"],
  "suggestions": "Brief suggestions here"
}`
        }];

        const msg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            messages: messages,
        });

        let jsonText = msg.content[0].text.trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '');

        const parsed = JSON.parse(jsonText);

        res.json({
            success: true,
            colors: parsed.colors || [],
            suggestions: parsed.suggestions || 'No suggestions available'
        });

    } catch (error) {
        console.error("❌ Error analyzing code:", error.message);
        res.status(500).json({
            success: false,
            error: 'Analysis failed',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Claude API Service running on port ${PORT}`);
    console.log(`📝 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔧 Code update: http://localhost:${PORT}/api/code/update`);
    console.log(`🎨 Code analyze: http://localhost:${PORT}/api/code/analyze`);
});