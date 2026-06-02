# Contributing

## Eval Methodology

The project uses a structured eval framework to test backend edge functions (analyze, action-plan, generate-captions).

### Structure

```
tools/eval/
├── lib/
│   └── harness.ts          # Shared test harness (fixture runner, assertions, logging)
├── fixtures.analyze.ts     # 13 test fixtures for analyze
├── fixtures.action-plan.ts # Test fixtures for action-plan (8 core + edge cases)
├── fixtures.captions.ts    # Test fixtures for generate-captions (6 core + edge cases)
├── assertions.ts           # Zod-based output validators
├── runner.analyze.ts       # Analyze eval runner
├── runner.action-plan.ts   # Action-plan eval runner
├── runner.captions.ts      # Captions eval runner
└── results/
    └── SUMMARY.md          # All eval cycle results
```

### Running an eval cycle

```bash
# Run all fixtures for a function
npx tsx tools/eval/runner.action-plan.ts --cycle 4 --fixture all

# Run a specific fixture
npx tsx tools/eval/runner.action-plan.ts --cycle 4 --fixture ap_fragile_negative_savings
```

### Cycle conventions

- Each cycle increments the counter in `tools/eval/lib/harness.ts` (max 40 calls before reset)
- Results append to `results/SUMMARY.md`
- If a hypothesis (prompt change) is KEPT, mark it explicitly in the summary

### Assertions

Assertions live in `assertions.ts` and use Zod schemas to validate:
- Structural correctness (required fields, types, ranges)
- Business logic (e.g., score ranges, confidence anchoring, length minimums)

### Adding fixtures

1. Add a new entry to the appropriate `fixtures.*.ts` file
2. Each fixture requires: `id`, `group`, `label`, and `input` matching the function's request schema
3. Run the runner to verify the fixture passes

## Pre-commit checks

A pre-commit hook runs `npx tsc --noEmit` to catch type errors. Install with:

```bash
git config core.hooksPath .githooks
```

## CI/CD

GitHub Actions runs on push/PR to `develop` and `main`:
- TypeScript type check
- Unit tests
- Automatic deploy to Supabase on `main` merge
