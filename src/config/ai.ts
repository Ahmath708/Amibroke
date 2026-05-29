/**
 * Dev-only AI mocks flag.
 * In dev (__DEV__ = true), mocks are ON by default so we don't accidentally
 * spend API credits while building/QA-ing the frontend flow.
 * Flip to `false` to hit the real endpoints when needed.
 *
 * In release/production builds __DEV__ is false, so USE_AI_MOCKS
 * is always false — mocks NEVER ship to production.
 */
export const USE_AI_MOCKS = __DEV__ && true;
