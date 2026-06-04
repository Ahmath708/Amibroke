import { useEffect, useState } from 'react';
import { useNavigation, StackActions } from '@react-navigation/native';
import { useSubscription } from './useSubscription';

/**
 * Gate a paid screen on a capability. Trial-aware (via useSubscription's
 * hasAccess) — full access during the 3-day window, otherwise the owned tier
 * decides. Redirects to the Paywall once when access is missing.
 *
 * Replaces the duplicated `getSubscription → canAccess → getTrialStatus →
 * replace('Paywall')` block that was hand-written in each gated screen.
 */
export function useRequireEntitlement(required: 'action_plan' | 'deep_dive'): { authorized: boolean; loading: boolean } {
  const { hasAccess, loading } = useSubscription();
  const navigation = useNavigation<any>();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (loading || redirected) return;
    if (!hasAccess(required)) {
      setRedirected(true);
      navigation.dispatch(StackActions.replace('Paywall'));
    }
  }, [loading, redirected, hasAccess, required, navigation]);

  return { authorized: !loading && hasAccess(required), loading };
}
