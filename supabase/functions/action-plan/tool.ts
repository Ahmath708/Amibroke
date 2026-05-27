export const generatePlanTool = {
  name: 'generate_plan',
  description: 'Generate a structured 90-day action plan. Server will validate and return the plan.',
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
