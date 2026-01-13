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

// ⭐ PRICING (USD per 1M tokens) - Update these as needed
const PRICING = {
    'claude-haiku-4-5-20251001': {
        input: 0.80,    // $0.80 per 1M input tokens
        output: 4.00    // $4.00 per 1M output tokens
    },
    'claude-sonnet-4-5-20250929': {
        input: 3.00,    // $3.00 per 1M input tokens
        output: 15.00   // $15.00 per 1M output tokens
    },
    'claude-opus-4-1-20250514': {
        input: 15.00,   // $15.00 per 1M input tokens
        output: 75.00   // $75.00 per 1M output tokens
    }
};

// ⭐ Exchange rate (USD to THB) - Update this regularly or fetch from API
const USD_TO_THB = 33.50; // 1 USD = 33.50 THB (example rate)

// ⭐ Token usage tracker
class TokenTracker {
    constructor() {
        this.sessions = new Map();
    }

    trackRequest(sessionId, usage, model) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                requests: 0,
                totalInputTokens: 0,
                totalOutputTokens: 0,
                totalCostUSD: 0,
                totalCostTHB: 0,
                model: model
            });
        }

        const session = this.sessions.get(sessionId);
        const pricing = PRICING[model] || PRICING['claude-haiku-4-5-20251001'];

        const inputCost = (usage.input_tokens / 1000000) * pricing.input;
        const outputCost = (usage.output_tokens / 1000000) * pricing.output;
        const requestCostUSD = inputCost + outputCost;
        const requestCostTHB = requestCostUSD * USD_TO_THB;

        session.requests++;
        session.totalInputTokens += usage.input_tokens;
        session.totalOutputTokens += usage.output_tokens;
        session.totalCostUSD += requestCostUSD;
        session.totalCostTHB += requestCostTHB;

        return {
            requestTokens: {
                input: usage.input_tokens,
                output: usage.output_tokens,
                total: usage.input_tokens + usage.output_tokens
            },
            requestCost: {
                usd: requestCostUSD,
                thb: requestCostTHB
            },
            sessionTotals: {
                requests: session.requests,
                totalTokens: session.totalInputTokens + session.totalOutputTokens,
                totalCostUSD: session.totalCostUSD,
                totalCostTHB: session.totalCostTHB
            }
        };
    }

    getSessionStats(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    clearSession(sessionId) {
        this.sessions.delete(sessionId);
    }
}

const tokenTracker = new TokenTracker();

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
        service: 'Claude API Service',
        exchangeRate: `1 USD = ${USD_TO_THB} THB`
    });
});

// ⭐ NEW: Get token usage stats
app.get('/api/usage/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const stats = tokenTracker.getSessionStats(sessionId);

    if (!stats) {
        return res.json({
            success: true,
            message: 'No usage data for this session',
            usage: null
        });
    }

    res.json({
        success: true,
        usage: {
            model: stats.model,
            requests: stats.requests,
            tokens: {
                input: stats.totalInputTokens,
                output: stats.totalOutputTokens,
                total: stats.totalInputTokens + stats.totalOutputTokens
            },
            cost: {
                usd: stats.totalCostUSD.toFixed(6),
                thb: stats.totalCostTHB.toFixed(2)
            },
            averageTokensPerRequest: Math.round(
                (stats.totalInputTokens + stats.totalOutputTokens) / stats.requests
            )
        }
    });
});

// ⭐ NEW: Clear session usage
app.delete('/api/usage/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    tokenTracker.clearSession(sessionId);
    res.json({
        success: true,
        message: 'Session usage data cleared'
    });
});

// Main code update endpoint
app.post('/api/code/update', async (req, res) => {
    try {
        const { history, currentHtml, currentCss, currentJs, sessionId } = req.body;

        // Validation
        if (!history || !Array.isArray(history)) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'history must be an array'
            });
        }

        // Use sessionId or generate one
        const session = sessionId || `session_${Date.now()}`;

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

        const model = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
        console.log(`Sending request to Claude API (${model})...`);

        // Call Claude API
        const msg = await anthropic.messages.create({
            model: model,
            max_tokens: parseInt(process.env.MAX_TOKENS) || 8192,
            system: SYSTEM_PROMPT,
            messages: messages,
        });

        const responseText = msg.content[0].text;

        // ⭐ Track token usage
        const usageInfo = tokenTracker.trackRequest(session, msg.usage, model);

        console.log("📊 Token Usage:");
        console.log(`   Input tokens:  ${usageInfo.requestTokens.input}`);
        console.log(`   Output tokens: ${usageInfo.requestTokens.output}`);
        console.log(`   Total tokens:  ${usageInfo.requestTokens.total}`);
        console.log(`💰 Cost (this request):`);
        console.log(`   USD: $${usageInfo.requestCost.usd.toFixed(6)}`);
        console.log(`   THB: ฿${usageInfo.requestCost.thb.toFixed(2)}`);
        console.log(`📈 Session totals:`);
        console.log(`   Requests: ${usageInfo.sessionTotals.requests}`);
        console.log(`   Total tokens: ${usageInfo.sessionTotals.totalTokens}`);
        console.log(`   Total cost USD: $${usageInfo.sessionTotals.totalCostUSD.toFixed(6)}`);
        console.log(`   Total cost THB: ฿${usageInfo.sessionTotals.totalCostTHB.toFixed(2)}`);

        console.log("Raw response length:", responseText.length);

        // AGGRESSIVE MARKDOWN REMOVAL
        let jsonText = responseText.trim();
        jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

        if (jsonText.includes('```')) {
            const firstBrace = jsonText.indexOf('{');
            const lastBrace = jsonText.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonText = jsonText.substring(firstBrace, lastBrace + 1);
            }
        }

        jsonText = jsonText.trim();

        // Parse with better error handling
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError.message);

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

        // Send successful response with usage data
        res.json({
            success: true,
            message: parsed.message || 'Code updated successfully',
            html: parsed.html || currentHtml || '',
            css: parsed.css || currentCss || '',
            js: parsed.js || currentJs || '',
            // ⭐ Include usage information
            usage: {
                sessionId: session,
                request: {
                    tokens: usageInfo.requestTokens,
                    cost: {
                        usd: usageInfo.requestCost.usd.toFixed(6),
                        thb: usageInfo.requestCost.thb.toFixed(2)
                    }
                },
                session: {
                    requests: usageInfo.sessionTotals.requests,
                    totalTokens: usageInfo.sessionTotals.totalTokens,
                    totalCost: {
                        usd: usageInfo.sessionTotals.totalCostUSD.toFixed(6),
                        thb: usageInfo.sessionTotals.totalCostTHB.toFixed(2)
                    }
                }
            }
        });

    } catch (error) {
        console.error("❌ Error processing request:", error.message);

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
        const { html, css, js, sessionId } = req.body;
        const session = sessionId || `analyze_${Date.now()}`;
        const model = "claude-haiku-4-5-20251001";

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
            model: model,
            max_tokens: 2048,
            messages: messages,
        });

        // ⭐ Track token usage for analyze
        const usageInfo = tokenTracker.trackRequest(session, msg.usage, model);

        let jsonText = msg.content[0].text.trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '');

        const parsed = JSON.parse(jsonText);

        res.json({
            success: true,
            colors: parsed.colors || [],
            suggestions: parsed.suggestions || 'No suggestions available',
            // ⭐ Include usage information
            usage: {
                sessionId: session,
                tokens: usageInfo.requestTokens,
                cost: {
                    usd: usageInfo.requestCost.usd.toFixed(6),
                    thb: usageInfo.requestCost.thb.toFixed(2)
                }
            }
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
    console.log(`📊 Usage stats: http://localhost:${PORT}/api/usage/:sessionId`);
    console.log(`💱 Exchange rate: 1 USD = ${USD_TO_THB} THB`);
});