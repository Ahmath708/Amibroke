/**
 * Dev-only mock community feed (USE_AI_MOCKS) so the Community tab has life in QA/demos without a
 * real DB. display_name is the raw @handle (the feed renders @display_name); roasts are share-safe
 * (gist, no exact figures) to mirror the reframed prompt.
 */
import type { CommunityPost } from '@/types';
import { getScoreBand } from '@shared/scoring/bands.ts';

// [handle, score, roast, summary, reactions, isoLocal]
type Raw = [string, number, string, string, Record<string, number>, string];

const RAW: Raw[] = [
  ['payday_phantom', 34, "Money comes in, money leaves, you never see it — like a ghost with a debit card. The overdraft fee is basically your roommate now.", 'Living paycheck to paycheck with a debt overhang.', { '💀': 41, '😭': 18, '🔥': 6 }, '2026-06-09T21:30:00'],
  ['doordash_dynasty', 49, "You're not broke, you're just single-handedly funding a small delivery-driver empire. Cooking is free, bestie — it's been free this whole time.", 'Spending outpaces income, mostly on convenience.', { '😭': 33, '💀': 27, '🤡': 12 }, '2026-06-09T18:05:00'],
  ['rentpoor_rachel', 45, "Half your money evaporates to rent and the other half to 'treat yourself' Tuesdays. Somehow it is always Tuesday.", 'High fixed costs, thin margin, no buffer yet.', { '😭': 22, '🔥': 9 }, '2026-06-08T14:40:00'],
  ['crypto_casualty', 41, "You took 'buy high, sell low' as a personal challenge and you are absolutely winning. The portfolio is a haunted house.", 'Volatile risk-taking with no safety net.', { '💀': 29, '🤡': 15, '🔥': 7 }, '2026-06-08T09:12:00'],
  ['softlife_sam', 66, "Genuinely not bad — a cushion is forming. Stop poking it with random 2am Amazon carts and you're golden.", 'Stable footing, small leaks to plug.', { '🔥': 19, '😭': 4 }, '2026-06-07T20:55:00'],
  ['budget_baddie', 79, "An actual emergency fund AND a paid-off card? Who hurt you into financial responsibility? Whoever it was, thank them.", 'Strong habits, real buffer, low debt.', { '🔥': 38, '🫡': 14 }, '2026-06-07T11:20:00'],
  ['saver_supreme', 85, "Okay, show-off. The only thing broke about you is the algorithm that served you this app. Respectfully — log off and go enjoy it.", 'Thriving. Genuinely doing the thing.', { '🫡': 27, '🔥': 21 }, '2026-06-06T16:00:00'],
];

export const MOCK_FEED: CommunityPost[] = RAW.map(([handle, score, roast, summary, reactions, iso], i) => ({
  id: `mockfeed-${i + 1}`,
  user_id: `mockuser-${i + 1}`,
  display_name: handle,
  score,
  score_label: getScoreBand(score).label,
  roast,
  summary,
  reactions,
  created_at: iso,
  my_reactions: [],
}));
