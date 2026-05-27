import { getBaselines } from '../../../shared/baselines/index.ts';
import type { UserContext } from '../../../shared/types.ts';

export function getBaselinesForRequest(userContext: UserContext) {
  const baselines = getBaselines(userContext.state);
  return {
    stateMedianRent1br: baselines.medianRent1br,
    stateColTier: baselines.colTier,
    ageMedianNetIncome: baselines.medianNetIncomeByAge[userContext.ageBracket] ?? baselines.medianNetIncome,
    currentCcApr: baselines.currentCcApr,
    currentStudentLoanRate: baselines.currentStudentLoanRate,
    healthySavingsRate: baselines.healthySavingsRate,
    adequateEmergencyMonths: baselines.adequateEmergencyMonths,
    recommendedRentPctOfIncome: baselines.recommendedRentPctOfIncome,
  };
}
