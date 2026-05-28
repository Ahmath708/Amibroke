import type { Fixture } from './lib/harness';

// All score/scoreLabel/roast values taken from cycle_3_analyze_2026-05-28T03-36-25-379Z.json
// (the v1.0 finalized analyze prompt, 13/13 pass, hypothesis 2 KEPT).
//
// Fixture → source analysis:
//   low_savage  → edge_negative_savings (score 15, Fragile, expenses > income)
//   low_therapist → partial_1 (score 33, Fragile, CC debt + no savings)
//   mid_gentle  → detailed_3 (score 45, Surviving, $50k CC on $15k/mo income)
//   mid_finance_bro → detailed_2 (score 51, Surviving, homeowner with CC balance)
//   high_older_sibling → cfpb_thriving (score 87, Thriving, fully funded)
//   high_savage → cfpb_thriving (score 87, Thriving, savage tone variant)

export const FIXTURES: Fixture[] = [
  {
    id: 'low_savage',
    group: 'A-low',
    label: 'Score 15, savage tone — expenses exceed income',
    input: {
      score: 15,
      scoreLabel: 'Financially Fragile',
      roast: 'It seems like your credit cards have quietly become a co-signer on your lifestyle — and they\'re charging 21% for the privilege.',
      tone: 'savage',
    },
  },
  {
    id: 'low_therapist',
    group: 'A-low',
    label: 'Score 33, therapist tone — CC debt + no savings',
    input: {
      score: 33,
      scoreLabel: 'Financially Fragile',
      roast: 'Bestie, "a lot of CC debt" and $250 in savings on $4k/mo is just paying a subscription fee to be broke. You\'re funding Visa\'s quarterly earnings call every single month. 💀',
      tone: 'therapist',
    },
  },
  {
    id: 'mid_gentle',
    group: 'B-mid',
    label: 'Score 45, gentle tone — high earner, hidden CC debt',
    input: {
      score: 45,
      scoreLabel: 'Surviving',
      roast: 'Bro, you\'re making $180k a year and still $50k in the hole on credit cards. That\'s not a money problem, that\'s a lifestyle problem wearing a money problem\'s clothes. We need to talk.',
      tone: 'gentle',
    },
  },
  {
    id: 'mid_finance_bro',
    group: 'B-mid',
    label: 'Score 51, finance_bro tone — homeowner with CC balance',
    input: {
      score: 51,
      scoreLabel: 'Surviving',
      roast: 'Bro, you own a home, have a job, and still only save $200/mo? That\'s like having a Ferrari and only putting $5 of gas in it. The CC balance is the villain in your origin story — let\'s kill it.',
      tone: 'finance_bro',
    },
  },
  {
    id: 'high_older_sibling',
    group: 'C-high',
    label: 'Score 87, older_sibling tone — thriving, maxed 401k',
    input: {
      score: 87,
      scoreLabel: 'Thriving',
      roast: 'Here\'s the thing — your finances are so healthy it\'s almost unfair. The only thing to "fix" here is making sure that $80k isn\'t just sitting there collecting dust while inflation quietly nibbles at it. 😊',
      tone: 'older_sibling',
    },
  },
  {
    id: 'high_savage',
    group: 'C-high',
    label: 'Score 87, savage tone — thriving, zero debt',
    input: {
      score: 87,
      scoreLabel: 'Thriving',
      roast: 'Here\'s the thing — your finances are so healthy it\'s almost unfair. The only thing to "fix" here is making sure that $80k isn\'t just sitting there collecting dust while inflation quietly nibbles at it. 😊',
      tone: 'savage',
    },
  },
];
