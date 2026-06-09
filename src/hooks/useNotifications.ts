import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';
import { getAnalysisHistory } from '@/services/analyses';
import { getActivePlan, shouldRevisePlan } from '@/services/activePlan';
import { getSnapshot } from '@/services/financialSnapshot';
import { isSnapshotStaleSince } from '@shared/financialSnapshot';

export type NotifType = 'score_stale' | 'plan_stale' | 'checkin_due';
export interface AppNotification {
  type: NotifType;
  emoji: string;
  title: string;
  body: string;
}

/**
 * Computed notifications — aggregates the nudges we already derive (no new table): the score is
 * stale (you've checked in since your last roast), the plan needs revising (a material change),
 * and a monthly check-in is due. Refreshes on focus. (Community reactions: a follow-up — needs a
 * "reactions on my posts" query.)
 */
export function useNotifications(): { items: AppNotification[]; loading: boolean } {
  const { user } = useAuth();
  const { due: checkinDue, lastCheckIn, loading: ciLoading } = useCheckinStatus();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!user) { setItems([]); setLoading(false); return; }
    (async () => {
      try {
        const [history, plan, snap] = await Promise.all([
          getAnalysisHistory(user.id), getActivePlan(user.id), getSnapshot(user.id),
        ]);
        const next: AppNotification[] = [];
        const latest = history[0];
        if (latest && snap && isSnapshotStaleSince(snap, latest.created_at)) {
          next.push({ type: 'score_stale', emoji: '📊', title: 'Your score may be out of date', body: 'Your numbers changed since your last roast — refresh it.' });
        }
        if (plan && snap) {
          const revSnap = { debtTotal: snap.debtTotal, liquidSavings: snap.liquidSavings?.value ?? null, monthlyIncome: snap.monthlyIncome?.value ?? null, score: snap.score };
          if (shouldRevisePlan(plan, revSnap).revise) {
            next.push({ type: 'plan_stale', emoji: '🗺️', title: 'Your plan needs an update', body: 'Your numbers moved — refresh your 90-day plan.' });
          }
        }
        if (checkinDue) {
          next.push({ type: 'checkin_due', emoji: '🔥', title: 'Time for your monthly check-in', body: 'Log how things are going and keep your streak alive.' });
        }
        if (active) setItems(next);
      } catch { /* ignore */ } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user, checkinDue, lastCheckIn]));

  return { items, loading: loading || ciLoading };
}
