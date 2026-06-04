import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { getCheckinConfig, getCheckIns } from '@/services/checkins';
import { CheckinConfig, CheckIn, EMPTY_CHECKIN_CONFIG } from '@/types';
import { dueStatus } from '@/utils/checkinSchedule';

export interface CheckinStatus {
  loading: boolean;
  configured: boolean;      // has at least one pinned goal
  due: boolean;             // a scheduled check-in is due and not yet done
  dueDate: Date | null;     // the period due now, or the next upcoming
  lastCheckIn: CheckIn | null;
  checkIns: CheckIn[];      // newest first
  config: CheckinConfig;
}

const INITIAL: CheckinStatus = {
  loading: true, configured: false, due: false, dueDate: null,
  lastCheckIn: null, checkIns: [], config: EMPTY_CHECKIN_CONFIG,
};

/**
 * Loads the monthly check-in config + history and derives whether a check-in is
 * due. Refreshes on screen focus so the Home/History surfaces update right after
 * a check-in is completed.
 */
export function useCheckinStatus(): CheckinStatus {
  const { user } = useAuth();
  const [state, setState] = useState<CheckinStatus>(INITIAL);

  const load = useCallback(async () => {
    if (!user) { setState({ ...INITIAL, loading: false }); return; }
    const [config, checkIns] = await Promise.all([getCheckinConfig(user.id), getCheckIns(user.id)]);
    const last = checkIns[0] ?? null;
    const status = dueStatus(
      config.firstAnalyzeAt ? new Date(config.firstAnalyzeAt) : null,
      last ? new Date(last.created_at) : null,
      new Date(),
    );
    setState({
      loading: false,
      configured: config.goals.length > 0,
      due: status?.due ?? false,
      dueDate: status?.dueDate ?? null,
      lastCheckIn: last,
      checkIns,
      config,
    });
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return state;
}
