export const submitCaptionsTool = {
  name: 'submit_captions',
  description: 'Submit exactly 3 short, distinct share captions for a financial scorecard. Server will validate and return them.',
  input_schema: {
    type: 'object',
    required: ['captions'],
    properties: {
      captions: {
        type: 'array',
        items: { type: 'string', maxLength: 150 },
        minItems: 3,
        maxItems: 3,
      },
    },
  },
};
