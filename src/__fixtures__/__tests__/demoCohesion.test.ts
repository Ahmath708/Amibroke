// Guards the demo persona's cohesion — every mock derives from demoPersona.ts, so these invariants
// must hold or the demo contradicts itself on camera. Also exercises the runtime FinalAnalysisSchema
// parse (tsc can't see it) for SAMPLE_ANALYSIS + every getMockAnalysisById path.
import { buildMoneyTrend } from '@shared/moneyTrend';
import { computeFinalScore } from '@shared/scoring/index.ts';
import { PERSONA_TIMELINE, personaLatest, debtTotal, personaMoneyEvents } from '../demoPersona';
import { getMockAnalysisById, MOCK_HISTORY, MOCK_SNAPSHOT, MOCK_CHECKINS } from '../mockHistory';
import { SAMPLE_ANALYSIS } from '../sampleAnalysis';

describe('demo persona cohesion', () => {
  it('every history row resolves to an analysis with the SAME score (no "tap 80 → see 55")', () => {
    expect(MOCK_HISTORY.length).toBeGreaterThan(0);
    for (const row of MOCK_HISTORY) {
      const a = getMockAnalysisById(row.id);
      expect(a).not.toBeNull();
      expect(a!.score).toBe(row.score);
    }
  });

  it('every timeline id resolves + parses, with the point\'s debt', () => {
    for (const p of PERSONA_TIMELINE) {
      const a = getMockAnalysisById(p.id);
      expect(a).not.toBeNull();
      expect(a!.debtTotal).toBe(debtTotal(p));
    }
  });

  it('the snapshot is the latest roast point', () => {
    const last = personaLatest();
    expect(MOCK_SNAPSHOT.monthlyIncome!.value).toBe(last.income);
    expect(MOCK_SNAPSHOT.monthlyExpenses!.value).toBe(last.expenses);
    expect(MOCK_SNAPSHOT.liquidSavings!.value).toBe(last.savings);
    expect(MOCK_SNAPSHOT.debtTotal).toBe(debtTotal(last));
  });

  it('SAMPLE_ANALYSIS == the latest point', () => {
    expect(SAMPLE_ANALYSIS.score).toBe(personaLatest().score);
    expect(SAMPLE_ANALYSIS.debtTotal).toBe(debtTotal(personaLatest()));
  });

  it('every mock score is what its own CFPB answers compute to (engine-derived, no hardcoded drift)', () => {
    for (const p of PERSONA_TIMELINE) {
      const a = getMockAnalysisById(p.id)!;
      // The engine score from the fixture's OWN responses must equal the stored score (the old mock
      // claimed 80 while its responses computed to ~43 — this guards that from ever returning)…
      expect(computeFinalScore(a.cfpb_responses, a.scoreModifier).score).toBe(a.score);
      // …and the score must still be the intended persona-arc value.
      expect(a.score).toBe(p.score);
    }
  });

  it('debt decreases monotonically across the arc (the glow-up)', () => {
    const d = PERSONA_TIMELINE.map(debtTotal);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeLessThanOrEqual(d[i - 1]);
  });

  it('the money trend ends at the snapshot', () => {
    const t = buildMoneyTrend(personaMoneyEvents());
    expect(t.debt[t.debt.length - 1].value).toBe(MOCK_SNAPSHOT.debtTotal);
    expect(t.savings[t.savings.length - 1].value).toBe(MOCK_SNAPSHOT.liquidSavings!.value);
    expect(MOCK_CHECKINS.length).toBe(2);
  });
});
