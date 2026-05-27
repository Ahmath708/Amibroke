import { STATE_BASELINES } from './states.ts';
import { NATIONAL_BASELINES } from './national.ts';

export function getBaselines(state: string | undefined) {
  const stateRow = state && STATE_BASELINES[state.toUpperCase()];
  return {
    ...NATIONAL_BASELINES,
    state: state ?? 'unknown',
    ...(stateRow ?? {
      colTier: 'medium' as const,
      medianRent1br: 1200,
      medianNetIncome: 3500,
      recommendedRentPctOfIncome: 0.30,
    }),
  };
}

export { NATIONAL_BASELINES, STATE_BASELINES };
