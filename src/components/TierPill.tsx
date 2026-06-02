import React from 'react';
import StatusPill from '@/components/StatusPill';
import { TierColors } from '@/theme/colors';
import { SubscriptionTier } from '@/services/subscriptions';

const LABELS: Record<SubscriptionTier, string> = {
  free: 'Free Plan',
  action_plan: 'Action Plan',
  deep_dive: 'Deep Dive',
};

/** A subscription-tier badge using the shared 3-color tier palette (see TierColors).
 *  Wraps StatusPill so tier styling stays consistent everywhere it appears. */
export default function TierPill({ tier, size }: { tier: SubscriptionTier; size?: 'sm' | 'md' }) {
  return <StatusPill label={LABELS[tier]} color={TierColors[tier]} size={size} />;
}
