export const NATIONAL_BASELINES = {
  currentCcApr: 0.21,
  // Source: Fed G.19 Consumer Credit, Feb 2026 — 21.00% for all accounts
  // https://fred.stlouisfed.org/series/TERMCBCCALLNS

  currentStudentLoanRate: 0.0639,
  // Source: studentaid.gov, 2025-26 academic year — 6.39% for undergraduate Direct loans
  // https://studentaid.gov/understand-aid/types/loans/interest-rates

  healthySavingsRate: 0.15,

  adequateEmergencyMonths: 3,

  medianNetIncomeByAge: {
    '18-24': 2400,
    // Source: BLS Usual Weekly Earnings Q4 2025 — $774/wk for 16-24 → ~$3,350/mo gross → ~$2,400 after tax
    // https://www.bls.gov/news.release/archives/wkyeng_01282026.htm

    '25-29': 3200,
    // Source: BLS Q4 2025 — $1,143/wk for 25-34 → ~$4,950/mo gross → ~$3,200 after tax (lower end of bracket)

    '30-34': 3900,
    // Source: BLS Q4 2025 — $1,143/wk for 25-34 → ~$4,950/mo gross → ~$3,900 after tax (upper end of bracket)

    '35-44': 4600,
    // Source: BLS Q4 2025 — $1,360/wk for 35-44 → ~$5,890/mo gross → ~$4,600 after tax

    '45+': 5100,
    // Source: BLS Q4 2025 — $1,368/wk for 45-54 → ~$5,925/mo gross → ~$5,100 after tax
    // https://www.bls.gov/news.release/archives/wkyeng_01282026.htm
  },
};
