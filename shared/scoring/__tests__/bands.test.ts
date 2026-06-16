import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getScoreBand } from '../bands';

// getScoreBand is the SINGLE SOURCE OF TRUTH for score band label + color across
// the whole app (Results, History, Home, Profile, Community, Share, ScoreRing,
// StatusPill, and the landing animation). These assertions pin the four bands and
// their exact colors so a stray edit can't silently desync any of those surfaces.

void describe('getScoreBand', () => {
  void it('Cooked for scores 0–40 (#FF4D6D)', () => {
    for (const s of [0, 1, 20, 40]) {
      assert.deepEqual(getScoreBand(s), { label: 'Cooked', color: '#FF4D6D' });
    }
  });

  void it('Surviving for scores 41–60 (#FFB020)', () => {
    for (const s of [41, 50, 60]) {
      assert.deepEqual(getScoreBand(s), { label: 'Surviving', color: '#FFB020' });
    }
  });

  void it('Stable for scores 61–80 (#00C2A8)', () => {
    for (const s of [61, 70, 80]) {
      assert.deepEqual(getScoreBand(s), { label: 'Stable', color: '#00C2A8' });
    }
  });

  void it('Thriving for scores 81–100 (#00E676)', () => {
    for (const s of [81, 90, 100]) {
      assert.deepEqual(getScoreBand(s), { label: 'Thriving', color: '#00E676' });
    }
  });

  void it('boundaries fall into the lower band (<= comparison)', () => {
    assert.equal(getScoreBand(40).label, 'Cooked');
    assert.equal(getScoreBand(41).label, 'Surviving');
    assert.equal(getScoreBand(60).label, 'Surviving');
    assert.equal(getScoreBand(61).label, 'Stable');
    assert.equal(getScoreBand(80).label, 'Stable');
    assert.equal(getScoreBand(81).label, 'Thriving');
  });

  void it('exposes exactly four distinct band colors', () => {
    const colors = new Set([10, 50, 70, 90].map((s) => getScoreBand(s).color));
    assert.equal(colors.size, 4);
  });
});
