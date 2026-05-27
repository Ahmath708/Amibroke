// DEPRECATED. Use scripts/manual-test.ts (Node + tsx) instead.
// This Deno-based script does not work with the new tool-use architecture.

// Test script to call Anthropic Claude Sonnet model directly. (OLD APPROACH — DO NOT USE)
// Usage (with Deno): deno run -A scripts/test_anthropic.ts "<user input>" [tone]
// Example: deno run -A scripts/test_anthropic.ts "I earn $5000 a month and spend $3000 on rent and groceries" savage

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY environment variable not set");
  Deno.exit(1);
}

const args = Deno.args;
if (args.length < 1) {
  console.error("Usage: deno run -A scripts/test_anthropic.ts <userInput> [tone]");
  Deno.exit(1);
}
const userInput = args[0];
const tone = args[1] ?? "savage";

const TONE_PROMPTS: Record<string, string> = {
  gentle: `- Warm and supportive, like a caring friend who wants the best for you\n- Soften hard truths with encouragement\n- Focus on hope and possibility\n- Use phrases like "here's the thing..." and "let's work on this together"`,
  savage: `- Brutally honest, no sugar-coating\n- Gen-Z / TikTok native language\n- Funny but cutting one-liners\n- Use phrases like "bestie..." and "we need to talk"\n- Make it memeable and screenshot-worthy`,
  therapist: `- Calm, analytical, and psychologically‑minded\n- Connect spending patterns to emotional needs\n- Use phrases like "it seems like..." and "have you considered..."\n- Focus on the "why" behind the behavior`,
  older_sibling: `- Tough love from someone who's been there\n- Mix of "I'm not mad, I'm disappointed" and genuine care\n- Practical, street‑smart advice\n- Use phrases like "look, I get it..." and "here's what I'd do"`,
  finance_bro: `- Confident, hype‑man energy\n- Use phrases like "we're gonna fix this" and "let's get that bread"\n- Optimistic but grounded in reality\n- Crunch the numbers with personality`
};
const toneGuide = TONE_PROMPTS[tone] || TONE_PROMPTS.savage;

const prompt = `You are "Am I Broke?", a brutally honest AI financial advisor that blends cold data analysis with a distinct personality. Analyze the user's financial story below and return ONLY a JSON object that exactly matches the schema provided—no markdown, no extra commentary.

Your tone:
${toneGuide}

Guidelines:
- Base every numeric field on concrete evidence from the user's description. Do NOT fabricate numbers. If a value is not explicitly provided, give a reasoned estimate and note uncertainty in the summary.
- Avoid assumptions beyond what is stated. If information is missing, acknowledge the limitation in the summary.
- Provide a concise, honest summary that includes any major uncertainties.
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
NEVER: pretend to be a licensed financial advisor, give illegal tax advice, guarantee investment outcomes, shame users aggressively, mention self‑harm.

Analyze this financial situation and return JSON: "${userInput}"`;

const messages = [{ role: "user", content: prompt }];

const response = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: "You are a financial analysis AI that returns ONLY valid JSON. No markdown, no extra text.",
    messages,
  }),
});

if (!response.ok) {
  const err = await response.text();
  console.error(`API error ${response.status}: ${err}`);
  Deno.exit(1);
}

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
