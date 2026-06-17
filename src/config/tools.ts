import type { ComponentType } from 'react';
import { ClipboardDocumentListIcon, CalculatorIcon, AdjustmentsHorizontalIcon, MagnifyingGlassIcon } from 'react-native-heroicons/outline';

export type ToolKey = 'action_plan' | 'debt_payoff' | 'scenario' | 'subscription_audit';

export type ToolMeta = {
  key: ToolKey;
  label: string;
  /** Functional one-liner — the Tools list + the Dashboard plan card. */
  desc: string;
  /** Benefit-driven copy — the Paywall preview, where the pitch actually converts. */
  pitch: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  requires: 'action_plan' | 'deep_dive';
  soon?: boolean;
};

/**
 * Single source of truth for the premium tools — icon, name, and the two copy registers. Every
 * surface (Dashboard plan card, Paywall preview) imports from here so they never drift. Icons match
 * the canonical glyphs used elsewhere: plan → ClipboardDocumentList (nav FAB menu), debt → Calculator
 * + scenario → AdjustmentsHorizontal (the Financials "Lab" rows).
 */
export const TOOLS: Record<ToolKey, ToolMeta> = {
  action_plan: {
    key: 'action_plan',
    label: '90-Day Action Plan',
    desc: 'Your week-by-week money roadmap',
    pitch: 'Week-by-week roadmap with specific dollar targets',
    icon: ClipboardDocumentListIcon,
    requires: 'action_plan',
  },
  debt_payoff: {
    key: 'debt_payoff',
    label: 'Debt Payoff',
    desc: 'Avalanche vs snowball strategy',
    pitch: "See how much interest you're burning and when you'll be free",
    icon: CalculatorIcon,
    requires: 'deep_dive',
  },
  scenario: {
    key: 'scenario',
    label: 'Scenario Simulator',
    desc: 'Model "what if" money moves',
    pitch: 'What if you got a raise? Cut takeout? Find out instantly',
    icon: AdjustmentsHorizontalIcon,
    requires: 'deep_dive',
    soon: true,
  },
  subscription_audit: {
    key: 'subscription_audit',
    label: 'Subscription Audit',
    desc: 'Track subscriptions & spot waste',
    pitch: 'Spot the recurring charges you forgot you were paying',
    icon: MagnifyingGlassIcon,
    requires: 'action_plan',
  },
};

/**
 * Canonical name for the monthly check-in. It isn't a paywalled tool, but its name shows up across
 * surfaces (nav title, Profile reminder, paywall comparison), so it lives here too — a rename is one
 * edit, same as the tools above. Import it; never hardcode "Monthly Check-In".
 */
export const CHECK_IN_NAME = 'Monthly Check-In';
