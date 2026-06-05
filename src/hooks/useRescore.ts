import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, RoastTone } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { getAnalysisHistory } from '@/services/analyses';
import { getProfile } from '@/services/profile';
import { buildRescoreInput } from '@/services/financialSnapshot';
import { FEATURES } from '@/config/features';

/**
 * Snapshot-driven re-score: reconstruct the analyze input from the current snapshot (no re-typing)
 * and run it. Paywall-gated like any roast (expired-free → Paywall). Shared by the Dashboard
 * stale banner and the notifications center.
 */
export function useRescore(): () => Promise<void> {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { canUseApp } = useSubscription();
  return useCallback(async () => {
    if (!user) return;
    if (FEATURES.PAYWALL_ENFORCEMENT && !canUseApp) { navigation.navigate('Paywall'); return; }
    const [history, prof] = await Promise.all([getAnalysisHistory(user.id), getProfile(user.id)]);
    const input = await buildRescoreInput(user.id, history[0]?.id);
    if (input) navigation.navigate('Processing', { userInput: input, tone: (prof?.preferred_tone as RoastTone) ?? 'savage' });
  }, [user, canUseApp, navigation]);
}
