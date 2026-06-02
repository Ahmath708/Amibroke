import { runSuite } from './lib/harness';
import { FIXTURES } from './fixtures.captions';
import { assertCaptions } from './assertions';

runSuite({
  suite: 'captions',
  endpointPath: 'generate-captions',
  fixtures: FIXTURES,
  assertFixture: (responseBody) => {
    return assertCaptions(responseBody);
  },
}).catch((err) => {
  console.error('Runner error:', err);
  process.exit(1);
});
