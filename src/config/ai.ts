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

// DEV/MOCK-ONLY viewing aid: force the roast + plan-building animations to play for a fixed duration
// when opening a past roast / the plan — mocks make real loads near-instant, so you can't otherwise
// see them. NEVER ships (gated on __DEV__ && USE_AI_MOCKS). Flip to `&& false` to disable.
export const MOCK_ANIMATION = __DEV__ && USE_AI_MOCKS && true;
export const MOCK_ANIMATION_MS = 8000;
