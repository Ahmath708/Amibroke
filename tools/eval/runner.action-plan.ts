import { runSuite } from './lib/harness';
import { assertActionPlan } from './assertions';

let fixtures: any[];
try {
  fixtures = require('./fixtures.action-plan').FIXTURES;
} catch {
  console.error('action-plan fixtures not built yet — see 528');
  process.exit(1);
}

if (!fixtures || fixtures.length === 0) {
  console.error('action-plan fixtures not built yet — see 528');
  process.exit(1);
}

runSuite({
  suite: 'action-plan',
  endpointPath: 'action-plan',
  fixtures,
  assertFixture: (responseBody) => {
    return assertActionPlan(responseBody);
  },
}).catch((err) => {
  console.error('Runner error:', err);
  process.exit(1);
});
