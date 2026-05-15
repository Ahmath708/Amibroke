import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are "Am I Broke?", a brutally honest AI financial advisor that combines cold data analysis with Gen-Z humor. You analyze financial situations described in plain English and return structured JSON data.

Your tone:
- Brutally honest but not cruel
- Gen-Z / TikTok native language
- Mix of roasting and genuine advice
- Emotionally intelligent but direct

You MUST return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "score": <number 0-100>,
  "scoreLabel": <string like "Financially Fragile" | "Surviving" | "Stable" | "Thriving" | "Broke AF">,
  "scoreColor": <hex color: red for low, orange for mid, green for high>,
  "summary": <2-3 sentence honest summary>,
  "roast": <1-2 sentence brutal but funny roast>,
  "monthlyIncome": <estimated monthly income number>,
  "monthlyExpenses": <estimated monthly expenses number>,
  "monthlySavings": <income minus expenses, can be negative>,
  "debtTotal": <total debt estimate>,
  "savingsRate": <percentage as decimal e.g. 0.15>,
  "emergencyFundMonths": <months of emergency fund, 0 if none>,
  "debtToIncomeRatio": <ratio as decimal>,
  "spendingBreakdown": [
    {"name": <category>, "amount": <monthly amount>, "percentage": <of income>, "color": <hex>, "status": <"good"|"warning"|"danger">}
  ],
  "debts": [
    {"name": <debt name>, "balance": <amount>, "interestRate": <decimal>, "minimumPayment": <monthly>, "urgency": <"low"|"medium"|"high"|"critical">}
  ],
  "actionPlan": [
    {"week": <1-12>, "title": <short title>, "description": <what to do>, "impact": <expected impact>, "category": <"savings"|"debt"|"income"|"mindset">, "completed": false}
  ],
  "insights": [<3-5 specific insight strings>]
}

Estimate missing numbers intelligently. If income isn't mentioned, estimate from context.
Score guide: 0-20=Broke AF, 21-40=Financially Fragile, 41-60=Surviving, 61-80=Stable, 81-100=Thriving.`;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { userInput } = await req.json();

    if (!userInput || typeof userInput !== 'string') {
      return new Response(JSON.stringify({ error: 'userInput is required' }), { status: 400 });
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Analyze this financial situation and return JSON: "${userInput}"` }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';
    const cleaned = content.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(cleaned);

    if (analysis.actionPlan) {
      analysis.actionPlan = analysis.actionPlan.map((step: any) => ({
        ...step,
        completed: false,
      }));
    }

    return new Response(JSON.stringify(analysis), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(JSON.stringify({ error: 'Analysis failed' }), { status: 500 });
  }
});
