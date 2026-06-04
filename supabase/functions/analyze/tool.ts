// JSON Schema tool definition for Anthropic tool use (submit_analysis).
// Mirrors AIRawOutputSchema from shared/schemas.ts.

export const submitAnalysisTool = {
  name: 'submit_analysis',
  description: 'Submit the analyzed financial picture. Server will compute derived metrics from your output.',
  input_schema: {
    type: 'object',
    required: [
      'monthlyIncome',
      'monthlyExpenses',
      'liquidSavings',
      'debts',
      'cfpb_responses',
      'scoreModifier',
      'scoreModifierReason',
      'summary',
      'roast',
      'insights',
      'topProblems',
      'positiveBehaviors',
      'topFix',
      'emotionalStatus',
      'mentionedSpending',
    ],
    properties: {
      monthlyIncome: {
        type: 'object',
        properties: {
          value: { type: 'number', minimum: 0 },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          source: { type: 'string', enum: ['user_stated', 'inferred'] },
        },
        required: ['value', 'confidence', 'source'],
      },
      monthlyExpenses: {
        type: 'object',
        properties: {
          value: { type: 'number', minimum: 0 },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          source: { type: 'string', enum: ['user_stated', 'inferred'] },
        },
        required: ['value', 'confidence', 'source'],
      },
      liquidSavings: {
        type: 'object',
        properties: {
          value: { type: 'number', minimum: 0 },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          source: { type: 'string', enum: ['user_stated', 'inferred'] },
        },
        required: ['value', 'confidence', 'source'],
      },
      debts: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 40 },
            balance: { type: 'number', minimum: 0 },
            interestRate: { type: 'number', minimum: 0, maximum: 0.5 },
            minimumPayment: { type: 'number', minimum: 0 },
            urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            source: { type: 'string', enum: ['user_stated', 'inferred'] },
          },
          required: ['name', 'balance', 'interestRate', 'minimumPayment', 'urgency', 'source'],
        },
      },
      cfpb_responses: {
        type: 'array',
        minItems: 10,
        maxItems: 10,
        items: {
          type: 'object',
          properties: {
            value: { type: 'integer', minimum: 0, maximum: 4 },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['value', 'confidence'],
        },
      },
      scoreModifier: { type: 'integer', minimum: -10, maximum: 10 },
      scoreModifierReason: { type: 'string', maxLength: 200 },
      summary: { type: 'string', maxLength: 400 },
      roast: { type: 'string', maxLength: 240 },
      insights: {
        type: 'array',
        maxItems: 5,
        items: { type: 'string', maxLength: 160 },
      },
      topProblems: {
        type: 'array',
        maxItems: 3,
        items: { type: 'string', maxLength: 140 },
      },
      positiveBehaviors: {
        type: 'array',
        maxItems: 3,
        items: { type: 'string', maxLength: 140 },
      },
      topFix: {
        type: 'object',
        properties: {
          action: { type: 'string', maxLength: 200 },
          monthlyImpact: { type: 'number', minimum: 0 },
        },
        required: ['action', 'monthlyImpact'],
      },
      emotionalStatus: {
        type: 'object',
        properties: {
          label: { type: 'string', maxLength: 40 },
          emoji: { type: 'string', maxLength: 4 },
        },
        required: ['label', 'emoji'],
      },
      mentionedSpending: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', maxLength: 40 },
            amount: { type: 'number', minimum: 0 },
            source: { type: 'string', enum: ['user_stated'] },
          },
          required: ['category', 'amount', 'source'],
        },
      },
    },
  },
};
