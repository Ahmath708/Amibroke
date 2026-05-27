import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AnalyzeRequestSchema } from './schemas';

void describe('AnalyzeRequestSchema', () => {
  void it('parses a valid request', () => {
    const result = AnalyzeRequestSchema.parse({
      freeText: 'I make $4k a month and have $8k in credit card debt',
      userContext: {
        state: 'CA',
        ageBracket: '25-29',
        incomeBracket: '4k_6k',
        livingSituation: 'renting',
        employmentStatus: 'full_time',
        debtBracket: '5k_15k',
        liquidSavingsBracket: 'none',
      },
      tone: 'savage',
    });
    assert.equal(result.freeText.length, 51);
    assert.equal(result.tone, 'savage');
    assert.equal(result.userContext.debtBracket, '5k_15k');
  });

  void it('rejects a request missing required field', () => {
    assert.throws(
      () => AnalyzeRequestSchema.parse({
        freeText: 'short',
        userContext: {
          state: 'CA',
          ageBracket: '25-29',
          incomeBracket: '4k_6k',
          livingSituation: 'renting',
          employmentStatus: 'full_time',
        },
        tone: 'savage',
      }),
      /freeText/,
    );
  });

  void it('rejects invalid tone', () => {
    assert.throws(
      () => AnalyzeRequestSchema.parse({
        freeText: 'I make $4k a month',
        userContext: {
          state: 'CA',
          ageBracket: '25-29',
          incomeBracket: '4k_6k',
          livingSituation: 'renting',
          employmentStatus: 'full_time',
        },
        tone: 'angry',
      }),
    );
  });
});
