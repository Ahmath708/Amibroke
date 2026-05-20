import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const API_URL = 'https://api.anthropic.com/v1/messages';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
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
  return `You are "Am I Broke?", a brutally honest AI financial advisor that combines cold data analysis with personality. You analyze financial situations described in plain English and return structured JSON data.

Your tone:
${toneGuide}

You MUST return ONLY valid JSON with this exact structure (no markdown, no extra text):
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

Estimate missing numbers intelligently. Score guide: 0-20=Broke AF, 21-40=Financially Fragile, 41-60=Surviving, 61-80=Stable, 81-100=Thriving.
NEVER: pretend to be a licensed financial advisor, give illegal tax advice, guarantee investment outcomes, shame users aggressively, mention self-harm.

Analyze this financial situation and return JSON: "${userInput}"`;
}

function jsonResponse(body: unknown, status = 200, extraHeaders = {}, httpStatus?: number) {
  const headers = { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders };
  if (httpStatus !== undefined) {
    headers['X-HTTP-Status'] = httpStatus.toString();
  }
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

async function callClaudeWithRetry(messages: any[], maxRetries = 3): Promise<any> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2500,
          system: 'You are a financial analysis AI that returns ONLY valid JSON. No markdown, no extra text.',
          messages,
        }),
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5');
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (response.status >= 500) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const error = new Error(`Claude API error: ${response.status} - ${errorBody.slice(0, 200)}`);
        error.status = response.status;
        error.rawResponse = errorBody;
        throw error;
      }
      return await response.json();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Unknown error');
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }
  throw lastError || new Error('Claude API call failed after retries');
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        stream: true,
        system: 'You are a financial analysis AI that returns ONLY valid JSON. No markdown, no extra text.',
        messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      await writer.write(encoder.encode(JSON.stringify({ error: `Claude API error: ${response.status}`, stage: 'claude_api_error' })));
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
      await writer.write(encoder.encode(JSON.stringify({ error: 'Failed to parse Claude response as JSON', stage: 'parse_error' })));
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
    return jsonResponse({ error: 'Method not allowed', stage: 'request_validation' }, 405, 405);
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
    const { userInput, tone, stream } = body;

    if (!userInput || typeof userInput !== 'string') {
      return jsonResponse({ error: 'userInput is required', stage: 'parse_error' }, 400, {}, 400);
    }

    // Moderation
    const moderation = moderateInput(userInput);
    if (!moderation.safe) {
      return jsonResponse({ error: moderation.reason, stage: 'moderation_failed' }, 400, {}, 400);
    }

    const validTones = ['gentle', 'savage', 'therapist', 'older_sibling', 'finance_bro'];
    const selectedTone = validTones.includes(tone) ? tone : 'savage';
    const userMessage = buildPrompt(selectedTone, userInput);

    // Streaming mode
    if (stream) {
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
    const data = await callClaudeWithRetry([{ role: 'user', content: userMessage }]);

    const content = data.content[0]?.text || '';
    const cleaned = content.replace(/```json|```/g, '').trim();

    let analysis: any;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      return jsonResponse({ error: 'Failed to parse Claude response as JSON', stage: 'parse_error', httpStatus: 502, rawResponse: cleaned.slice(0, 1000) }, 502);
    }

    if (analysis.roast) analysis.roast = moderateRoast(analysis.roast);
    if (analysis.actionPlan) {
      analysis.actionPlan = analysis.actionPlan.map((step: any) => ({ ...step, completed: false }));
    }

    if (!analysis.score || typeof analysis.score !== 'number') {
      return jsonResponse({ error: 'Claude response missing required fields', stage: 'validation_error', httpStatus: 502, rawResponse: cleaned.slice(0, 1000) }, 502);
    }

    return jsonResponse(analysis, 200, { 'X-RateLimit-Remaining': String(rateLimit.remaining) });
  } catch (error) {
    console.error('Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: `Analysis failed: ${message}`, stage: 'exception' }, 500);
  }
});
