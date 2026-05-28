import type { Fixture } from './lib/harness';

export const FIXTURES: Fixture[] = [
  // Low score, savage — classic broke user
  {
    id: 'low_savage',
    group: 'A-low',
    label: 'Score 28, savage tone',
    input: {
      score: 28,
      scoreLabel: 'Terrible',
      roast: 'Your wallet is on life support.',
      tone: 'savage',
    },
  },
  // Mid score, therapist tone
  {
    id: 'mid_therapist',
    group: 'A-low',
    label: 'Score 55, therapist tone',
    input: {
      score: 55,
      scoreLabel: 'Fair',
      roast: 'You are financially fragile, like a House of Cards in a windstorm.',
      tone: 'therapist',
    },
  },
  // High score, gentle
  {
    id: 'high_gentle',
    group: 'A-low',
    label: 'Score 82, gentle tone',
    input: {
      score: 82,
      scoreLabel: 'Great',
      roast: 'Your financial life is actually pretty solid. No, really.',
      tone: 'gentle',
    },
  },
  // Low score, older sibling
  {
    id: 'low_older_sibling',
    group: 'B-mid',
    label: 'Score 35, older_sibling tone',
    input: {
      score: 35,
      scoreLabel: 'Poor',
      roast: 'We need to have a talk about your money management.',
      tone: 'older_sibling',
    },
  },
  // Mid score, finance bro
  {
    id: 'mid_finance_bro',
    group: 'B-mid',
    label: 'Score 60, finance_bro tone',
    input: {
      score: 60,
      scoreLabel: 'Average',
      roast: 'Your portfolio is not exactly killing it, my dude.',
      tone: 'finance_bro',
    },
  },
  // High score, savage
  {
    id: 'high_savage',
    group: 'B-mid',
    label: 'Score 90, savage tone',
    input: {
      score: 90,
      scoreLabel: 'Excellent',
      roast: 'Stop flexing and go enjoy your financial freedom.',
      tone: 'savage',
    },
  },
  // Very low score, therapist
  {
    id: 'very_low_therapist',
    group: 'C-edge',
    label: 'Score 12, therapist tone — edge case',
    input: {
      score: 12,
      scoreLabel: 'Critical',
      roast: 'Your finances have left the building.',
      tone: 'therapist',
    },
  },
  // Perfect score, any tone
  {
    id: 'perfect_gentle',
    group: 'C-edge',
    label: 'Score 100, gentle tone — edge case',
    input: {
      score: 100,
      scoreLabel: 'Perfect',
      roast: 'You have achieved financial nirvana.',
      tone: 'gentle',
    },
  },
];
