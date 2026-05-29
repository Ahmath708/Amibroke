const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export function getProvider(body: any): { name: string; anthropicKey: string; groqKey: string } {
  const name = body?.provider === 'groq' ? 'groq' : 'claude';
  return { name, anthropicKey: ANTHROPIC_API_KEY, groqKey: GROQ_API_KEY };
}

function claudeHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  };
}

function groqHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${GROQ_API_KEY}`,
  };
}

async function claudeFetch(messages: Array<{ role: string; content: string }>, systemPrompt: string, tools: any[], maxTokens = 2500): Promise<any> {
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: claudeHeaders(),
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      temperature: 0.2,
      system: [{ type: 'text', text: systemPrompt }],
      tools,
      tool_choice: { type: 'tool', name: tools[0]?.name || '' },
      messages,
    }),
  });
  return handleClaudeResponse(response);
}

async function groqFetch(messages: Array<{ role: string; content: string }>, systemPrompt: string, maxTokens = 2500): Promise<any> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: groqHeaders(),
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  return handleGroqResponse(response);
}

async function handleClaudeResponse(response: Response): Promise<any> {
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('retry-after') || '5');
    console.warn(`[claude] Rate limited, retrying after ${retryAfter}s`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return null; // caller retries
  }
  if (response.status >= 500) {
    console.warn(`[claude] Server error ${response.status}, retrying...`);
    await new Promise((r) => setTimeout(r, 2000));
    return null; // caller retries
  }
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let apiMessage = `Claude API error: ${response.status}`;
    try { const parsed = JSON.parse(errorBody); if (parsed.error?.message) apiMessage = `Claude API error: ${parsed.error.message}`; } catch { /* ignore */ }
    const error: any = new Error(apiMessage);
    error.status = response.status;
    error.stage = 'claude_api_error';
    error.rawResponse = errorBody;
    error.detail = apiMessage;
    throw error;
  }
  return await response.json();
}

async function handleGroqResponse(response: Response): Promise<any> {
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('retry-after') || '5');
    console.warn(`[groq] Rate limited, retrying after ${retryAfter}s`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return null;
  }
  if (response.status >= 500) {
    console.warn(`[groq] Server error ${response.status}, retrying...`);
    await new Promise((r) => setTimeout(r, 2000));
    return null;
  }
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let apiMessage = `Groq API error: ${response.status}`;
    try { const parsed = JSON.parse(errorBody); if (parsed.error?.message) apiMessage = `Groq API error: ${parsed.error.message}`; } catch { /* ignore */ }
    const error: any = new Error(apiMessage);
    error.status = response.status;
    error.stage = 'groq_api_error';
    throw error;
  }
  return await response.json();
}

export async function callAi(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  tools: any[],
  provider: string,
  maxTokens = 2500,
): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let data: any = null;

    if (provider === 'groq') {
      const response = await groqFetch(messages, systemPrompt, maxTokens);
      if (response === null) continue;
      const content = response.choices?.[0]?.message?.content || '';
      let parsed: any;
      try {
        const cleaned = content.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        const error: any = new Error('Failed to parse Groq response as JSON');
        error.stage = 'parse_error';
        error.rawResponse = content;
        throw error;
      }
      return parsed;
    }

    data = await claudeFetch(messages, systemPrompt, tools, maxTokens);
    if (data === null) continue;

    const toolUse = data.content.find((c: any) => c.type === 'tool_use');
    if (!toolUse) {
      const error: any = new Error('No tool_use block in response');
      error.stage = 'tool_use_missing';
      error.rawResponse = JSON.stringify(data);
      throw error;
    }
    return toolUse.input;
  }

  const error: any = new Error('Max retries exceeded calling AI');
  error.stage = 'retry_exhausted';
  throw error;
}
