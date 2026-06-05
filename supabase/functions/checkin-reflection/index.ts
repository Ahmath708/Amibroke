import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { SYSTEM_PROMPT } from './prompt.ts';

// Short, personalized monthly check-in reflection (unified financial model §7). Light empathetic
// generation → Haiku (model routing: Sonnet does the heavy roast/plan; this just writes a caring
// sentence). No tool use — the response is plain text.
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const API_URL = 'https://api.anthropic.com/v1/messages';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info',
};
const VALID_TONES = new Set(['savage', 'gentle', 'therapist', 'older_sibling', 'finance_bro']);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'Claude API key not set', stage: 'config_error' }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const tone = VALID_TONES.has(body?.tone) ? body.tone : 'savage';
    const userMessage = JSON.stringify({
      mood: body?.mood ?? 'unspecified',
      note: body?.note ?? '',
      delta: body?.delta ?? null,
      planStatus: body?.planStatus ?? '',
      tone,
    });

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 60,
        temperature: 0.7,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return jsonResponse({ error: `Claude API error ${res.status}`, detail: detail.slice(0, 300), stage: 'anthropic_error' }, 502);
    }

    const data = await res.json();
    const text = (data.content ?? [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join(' ')
      .trim();
    if (!text) return jsonResponse({ error: 'Empty reflection', stage: 'empty_response' }, 502);
    return jsonResponse({ reflection: text.slice(0, 400) });
  } catch (e) {
    return jsonResponse({ error: `Reflection failed: ${(e as Error).message}`, stage: 'unknown' }, 500);
  }
});
