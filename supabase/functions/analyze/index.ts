import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info',
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20; // Increased for production stability
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

const BLOCKED_PATTERNS = [/suicid/i, /kill yourself/i, /kys/i, /die\b/i, /end it all/i];

function moderateInput(text: string): { safe: boolean; reason: string | null } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text.toLowerCase())) {
      return { safe: false, reason: 'We detected potentially harmful content. If you\'re in crisis, please reach out to a professional helpline.' };
    }
  }
  if (text.length > 5000) return { safe: false, reason: 'Input too long. Please keep it under 5000 characters.' };
  if (text.length < 10) return { safe: false, reason: 'Please describe your finances in more detail.' };
  return { safe: true, reason: null };
}

function moderateRoast(text: string): string {
  const replacements: [string, string][] = [
    ['you are broke', 'your finances are strained'],
    ['you\'re broke', 'you\'re financially strained'],
    ['you\'re poor', 'money is tight right now'],
    ['you are poor', 'money is tight right now'],
    ['you\'re failing', 'you\'re struggling'],
    ['you are failing', 'you\'re struggling'],
    ['you\'re terrible', 'there\'s room for improvement'],
    ['you are terrible', 'there\'s room for improvement'],
    ['you\'re hopeless', 'it feels overwhelming'],
    ['you are hopeless', 'it feels overwhelming'],
  ];
  let result = text;
  for (const [bad, good] of replacements) {
    result = result.replace(new RegExp(bad, 'gi'), good);
  }
  return result;
}

const TONE_PROMPTS: Record<string, string> = {
  gentle: `- Warm and supportive, like a caring friend who wants the best for you
- Soften hard truths with encouragement
- Focus on hope and possibility
- Use phrases like "here's the thing..." and "let's work on this together"`,
  savage: `- Brutally honest, no sugar-coating
- Gen-Z / TikTok native language
- Funny but cutting one-liners
- Use phrases like "bestie..." and "we need to talk"
- Make it memeable and screenshot-worthy`,
  therapist: `- Calm, analytical, and psychologically-minded
- Connect spending patterns to emotional needs
- Use phrases like "it seems like..." and "have you considered..."
- Focus on the "why" behind the behavior`,
  older_sibling: `- Tough love from someone who's been there
- Mix of "I'm not mad, I'm disappointed" and genuine care
- Practical, street-smart advice
- Use phrases like "look, I get it..." and "here's what I'd do"`,
  finance_bro: `- Confident, hype-man energy
- Use phrases like "we're gonna fix this" and "let's get that bread"
- Optimistic but grounded in reality
- Crunch the numbers with personality`,
};

function buildPrompt(tone: string, userInput: string): string {
  const toneGuide = TONE_PROMPTS[tone] || TONE_PROMPTS.savage;
  return `You are "Am I Broke?", a brutally honest AI financial advisor that blends cold data analysis with a distinct personality. Analyze the user's financial story below and return ONLY a JSON object that exactly matches the schema provided—no markdown, no extra commentary.

Your tone:
${toneGuide}

Guidelines:
- CRITICAL: You MUST estimate ALL numeric fields based on context clues. NEVER return 0 for monthlyIncome, monthlyExpenses, debtTotal, or savingsRate. If the user doesn't give exact figures, infer from their lifestyle cues (job mentions, spending habits, location hints, age, etc.) using realistic typical values.
- Example: if someone says "I eat out too much" estimate ~$400-800/mo for dining and reasonable income based on their implied lifestyle.
- Example: if someone says "I'm a student" estimate $0-2000/mo income, $1000-2500 expenses.
- If no debt is mentioned, set debtTotal to 0 and debts to [].
- If no subscriptions are mentioned, still include at least 2 generic subscription categories in spendingBreakdown.
- Always return at least 3 items in spendingBreakdown and at least 3 actionPlan steps.
- Provide a concise, honest "summary" that includes any major uncertainties.
- Return ONLY valid JSON with this precise structure:
{
  "score": <number 0-100>,
  "scoreLabel": <string like "Financially Fragile" | "Surviving" | "Stable" | "Thriving" | "Broke AF">,
  "scoreColor": <hex color>,
  "summary": <2-3 sentence honest summary>,
  "roast": <1-2 sentence roast matching the selected tone>,
  "monthlyIncome": <estimated monthly income number>,
  "monthlyExpenses": <estimated monthly expenses number>,
  "monthlySavings": <income minus expenses, can be negative>,
  "debtTotal": <total debt estimate>,
  "savingsRate": <percentage as decimal e.g. 0.15>,
  "emergencyFundMonths": <months of emergency fund, 0 if none>,
  "debtToIncomeRatio": <ratio as decimal>,
  "spendingBreakdown": [{"name": <category>, "amount": <monthly amount>, "percentage": <of income>, "color": <hex>, "status": <"good"|"warning"|"danger">}],
  "debts": [{"name": <debt name>, "balance": <amount>, "interestRate": <decimal>, "minimumPayment": <monthly>, "urgency": <"low"|"medium"|"high"|"critical">}],
  "actionPlan": [{"week": <1-12>, "title": <short title>, "description": <what to do>, "impact": <expected impact>, "category": <"savings"|"debt"|"income"|"mindset">, "completed": false}],
  "insights": [<3-5 specific insight strings>],
  "topProblems": [<2-3 biggest financial problems>],
  "positiveBehaviors": [<1-3 things they're doing right>],
  "topFix": {"action": <single most impactful action>, "monthlyImpact": <estimated monthly savings in dollars>},
  "emotionalStatus": {"label": <short status>, "emoji": <single emoji>}
}

Score guide: 0-20=Broke AF, 21-40=Financially Fragile, 41-60=Surviving, 61-80=Stable, 81-100=Thriving.
NEVER: pretend to be a licensed financial advisor, give illegal tax advice, guarantee investment outcomes, shame users aggressively, mention self-harm.

Analyze this financial situation and return JSON: "${userInput}"`;
}

function jsonResponse(body: unknown, status = 200, extraHeaders = {}) {
  const headers = { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders };
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

async function callClaudeWithRetry(messages: any[], maxRetries = 3): Promise<any> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[claude] Calling API, attempt ${attempt + 1}`);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2500,
          system: 'You are a financial analysis AI that returns ONLY valid JSON. No markdown, no extra text.',
          messages,
        }),
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5');
        console.warn(`[claude] Rate limited, retrying after ${retryAfter}s`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (response.status >= 500) {
        console.warn(`[claude] Server error ${response.status}, retrying...`);
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[claude] API error: ${response.status} — body: ${errorBody}`);
        let apiMessage = `Claude API error: ${response.status}`;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.error?.message) {
            apiMessage = `Claude API error: ${parsed.error.message}`;
          }
        } catch { /* ignore parse errors */ }
        const error: any = new Error(apiMessage);
        error.status = response.status;
        error.rawResponse = errorBody;
        error.stage = 'claude_api_error';
        error.detail = apiMessage;
        throw error;
      }

      const data = await response.json();
      console.log('[claude] API success');
      return data;
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }
  throw lastError;
}

async function callGroqWithRetry(messages: any[], maxRetries = 3): Promise<any> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[groq] Calling API, attempt ${attempt + 1}`);
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 2500,
          temperature: 0.7,
          messages: [
            { role: 'system', content: 'You are a financial analysis AI that returns ONLY valid JSON. No markdown, no extra text.' },
            ...messages,
          ],
        }),
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5');
        console.warn(`[groq] Rate limited, retrying after ${retryAfter}s`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (response.status >= 500) {
        console.warn(`[groq] Server error ${response.status}, retrying...`);
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[groq] API error: ${response.status} — body: ${errorBody}`);
        let apiMessage = `Groq API error: ${response.status}`;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.error?.message) {
            apiMessage = `Groq API error: ${parsed.error.message}`;
          }
        } catch { /* ignore parse errors */ }
        const error: any = new Error(apiMessage);
        error.status = response.status;
        error.rawResponse = errorBody;
        error.stage = 'groq_api_error';
        error.detail = apiMessage;
        throw error;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      console.log('[groq] API success');
      return { content: [{ text: content }] };
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }
  throw lastError;
}

// ─── Streaming Response Support ────────────────────────────────────────────────
async function callClaudeStream(messages: any[], writer: WritableStreamDefaultWriter<Uint8Array>) {
  const encoder = new TextEncoder();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',        max_tokens: 2500,
        stream: true,
        system: 'You are a financial analysis AI that returns ONLY valid JSON. No markdown, no extra text.',
        messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let apiMessage = `Claude API error: ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.error?.message) {
          apiMessage = `Claude API error: ${parsed.error.message}`;
        }
      } catch { /* ignore parse errors */ }
      await writer.write(encoder.encode(JSON.stringify({ error: apiMessage, stage: 'claude_api_error', rawResponse: errorBody })));
      await writer.close();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      await writer.write(encoder.encode(JSON.stringify({ error: 'No stream body', stage: 'stream_error' })));
      await writer.close();
      return;
    }

    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText += parsed.delta.text;
            // Send incremental JSON to client
            const cleaned = fullText.replace(/```json|```/g, '').trim();
            try {
              const partial = JSON.parse(cleaned);
              await writer.write(encoder.encode(JSON.stringify({ streaming: true, partial, done: false }) + '\n'));
            } catch {
              // Partial JSON not yet valid, skip
            }
          }
        } catch {
          // Skip malformed SSE data
        }
      }
    }

    // Send final complete response
    const cleaned = fullText.replace(/```json|```/g, '').trim();
    let analysis: any;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      await writer.write(encoder.encode(JSON.stringify({ error: 'Failed to parse Claude response as JSON', stage: 'parse_error', rawResponse: cleaned })));
      await writer.close();
      return;
    }

    if (analysis.roast) analysis.roast = moderateRoast(analysis.roast);
    if (analysis.actionPlan) {
      analysis.actionPlan = analysis.actionPlan.map((step: any) => ({ ...step, completed: false }));
    }

    await writer.write(encoder.encode(JSON.stringify({ streaming: true, data: analysis, done: true }) + '\n'));
    await writer.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await writer.write(encoder.encode(JSON.stringify({ error: `Streaming failed: ${message}`, stage: 'exception' })));
    await writer.close();
  }
}

// ─── Main Server ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', stage: 'request_validation' }, 405);
  }

  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP);

  if (!rateLimit.allowed) {
    return jsonResponse({
      error: 'Rate limit exceeded. Please wait before trying again.',
      stage: 'rate_limit',
      remaining: 0,
    }, 429, {
      'X-RateLimit-Remaining': '0',
      'Retry-After': String(RATE_LIMIT_WINDOW_MS / 1000),
    });
  }

  try {
    const body = await req.json();
    const { userInput, tone, stream, provider } = body;
    const selectedProvider: string = (provider === 'groq' ? 'groq' : 'claude');

    if (!userInput || typeof userInput !== 'string') {
      return jsonResponse({ error: 'userInput is required', stage: 'parse_error' }, 400);
    }

    // Provider key check
    if (selectedProvider === 'groq' && !GROQ_API_KEY) {
      console.error('[analyze] GROQ_API_KEY secret is not set in Supabase');
      return jsonResponse({ error: 'Server misconfiguration: Groq API key not set. Run: npx supabase secrets set GROQ_API_KEY=<your_key>', stage: 'config_error' }, 500);
    }
    if (selectedProvider === 'claude' && !ANTHROPIC_API_KEY) {
      console.error('[analyze] ANTHROPIC_API_KEY secret is not set in Supabase');
      return jsonResponse({ error: 'Server misconfiguration: Claude API key not set. Run: npx supabase secrets set ANTHROPIC_API_KEY=<your_key>', stage: 'config_error' }, 500);
    }

    // Moderation
    const moderation = moderateInput(userInput);
    if (!moderation.safe) {
      return jsonResponse({ error: moderation.reason, stage: 'moderation_failed' }, 400);
    }

    const validTones = ['gentle', 'savage', 'therapist', 'older_sibling', 'finance_bro'];
    const selectedTone = validTones.includes(tone) ? tone : 'savage';
    const userMessage = buildPrompt(selectedTone, userInput);

    // Streaming mode (Claude only)
    if (stream && selectedProvider === 'claude') {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      callClaudeStream([{ role: 'user', content: userMessage }], writer);

      return new Response(readable, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/x-ndjson',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Non-streaming mode (default)
    const messages = [{ role: 'user', content: userMessage }];
    const data = selectedProvider === 'groq'
      ? await callGroqWithRetry(messages)
      : await callClaudeWithRetry(messages);

    const content = data.content[0]?.text || '';
    const cleaned = content.replace(/```json|```/g, '').trim();

    let analysis: any;
    try {
      analysis = JSON.parse(cleaned);
    } catch (e) {
      console.error('[analyze] JSON parse failed:', e);
      const providerLabel = selectedProvider === 'groq' ? 'Groq' : 'Claude';
      return jsonResponse({ 
        error: `Failed to parse ${providerLabel} response as JSON`, 
        stage: 'parse_error', 
        rawResponse: cleaned.slice(0, 1000) 
      }, 502);
    }

    if (analysis.roast) analysis.roast = moderateRoast(analysis.roast);
    if (analysis.actionPlan) {
      analysis.actionPlan = analysis.actionPlan.map((step: any) => ({ ...step, completed: false }));
    }

    // Basic validation of required fields
    const requiredFields = ['score', 'scoreLabel', 'scoreColor', 'summary', 'roast', 'monthlyIncome', 'monthlyExpenses'];
    const missingFields = requiredFields.filter(f => analysis[f] === undefined);
    
    if (missingFields.length > 0) {
      const providerLabel = selectedProvider === 'groq' ? 'Groq' : 'Claude';
      return jsonResponse({ 
        error: `${providerLabel} response missing required fields: ${missingFields.join(', ')}`, 
        stage: 'validation_error', 
        rawResponse: cleaned.slice(0, 1000) 
      }, 502);
    }

    // Fill defaults for array/object fields that may be missing
    if (!analysis.spendingBreakdown) analysis.spendingBreakdown = [];
    if (!analysis.debts) analysis.debts = [];
    if (!analysis.actionPlan) analysis.actionPlan = [];
    if (!analysis.insights) analysis.insights = [];
    if (!analysis.topProblems) analysis.topProblems = [];
    if (!analysis.positiveBehaviors) analysis.positiveBehaviors = [];
    if (!analysis.topFix) analysis.topFix = { action: 'Track your spending for 30 days', monthlyImpact: 0 };
    if (!analysis.emotionalStatus) analysis.emotionalStatus = { label: 'Concerned', emoji: '😬' };
    if (!analysis.savingsRate && analysis.monthlyIncome > 0) analysis.savingsRate = ((analysis.monthlyIncome - analysis.monthlyExpenses) / analysis.monthlyIncome);

    return jsonResponse({ ...analysis, _provider: selectedProvider }, 200, { 'X-RateLimit-Remaining': String(rateLimit.remaining) });
    } catch (error: any) {
    console.error('[analyze] Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stage = error.stage || 'exception';
    const status = error.status || 500;
    const rawResponse = error.rawResponse?.slice(0, 500);
    const httpStatus = error.httpStatus || null;

    const envelope = {
      error: `Analysis failed: ${message}`,
      stage,
      httpStatus,
      rawResponse,
      detail: error.detail || null,
    };

    console.error('[analyze] Error envelope:', JSON.stringify(envelope));
    
    return jsonResponse(envelope, status);
  }
});
