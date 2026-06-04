// Same step shape as action-plan's generate_plan — a revision is still a 90-day
// plan; only the input context (current plan + what changed) differs.
export const generatePlanTool = {
  name: 'generate_plan',
  description: 'Return the REVISED 90-day action plan (the remaining steps re-fit to the new situation, plus any new steps). Server will validate and return it.',
  input_schema: {
    type: 'object',
    required: ['steps', 'overallMessage'],
    properties: {
      steps: {
        type: 'array',
        minItems: 4,
        maxItems: 6,
        items: {
          type: 'object',
          required: ['week', 'title', 'description', 'category', 'impact', 'confidence'],
          properties: {
            week: { type: 'string', maxLength: 20 },
            title: { type: 'string', maxLength: 80 },
            description: { type: 'string', maxLength: 300 },
            category: { type: 'string', enum: ['savings', 'debt', 'income', 'mindset'] },
            impact: { type: 'string', maxLength: 200 },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
      overallMessage: { type: 'string', maxLength: 400 },
    },
  },
};

// Patch mode (hybrid): instead of a whole new plan, classify each EXISTING step by
// id (keep/drop/modify) and add new ones. Server applies deterministically and
// preserves step identity + completion state. `add` items have no id (server assigns).
const STEP_FIELDS = {
  week: { type: 'string', maxLength: 20 },
  title: { type: 'string', maxLength: 80 },
  description: { type: 'string', maxLength: 300 },
  category: { type: 'string', enum: ['savings', 'debt', 'income', 'mindset'] },
  impact: { type: 'string', maxLength: 200 },
  confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  // Machine-readable goal of the step — the key the server uses to de-duplicate
  // intents (e.g. never two active 'build_efund' steps). Set on every add/modify.
  target: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['debt_paydown', 'build_efund', 'cut_spend', 'grow_income', 'habit'] },
      amount: { type: 'number' },
    },
  },
};

export const revisePatchTool = {
  name: 'revise_plan_patch',
  description: 'Return a PATCH over the current plan steps (by id): keep, drop, modify, and add. The server applies it deterministically and preserves completion state.',
  input_schema: {
    type: 'object',
    required: ['keep', 'drop', 'modify', 'add', 'overallMessage'],
    properties: {
      keep: { type: 'array', items: { type: 'string' }, description: 'ids of steps to keep unchanged' },
      drop: { type: 'array', items: { type: 'string' }, description: 'ids of steps that no longer apply' },
      modify: {
        type: 'array',
        items: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, ...STEP_FIELDS } },
        description: 'existing steps to edit — id required, plus only the fields that change',
      },
      add: {
        type: 'array',
        items: { type: 'object', required: ['week', 'title', 'description', 'category', 'impact', 'confidence'], properties: STEP_FIELDS },
        description: 'brand-new steps for the new situation',
      },
      overallMessage: { type: 'string', maxLength: 400 },
    },
  },
};
