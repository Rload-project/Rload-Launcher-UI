// src/lib/download-state-model.test.mjs
// node:test, zero new dependencies. Run with: node --test src/lib/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { UI, DOWNLOAD_SAFE_STATES, mapBackendStateToUI, buildShadowGame, toErrStr, computeHydratedEntryUpdate, getStateBadge } from './download-state-model.js';

describe('getStateBadge — RENDER_PATH_TESTED (pure projection level, no DOM)', () => {
  test('ERROR state gets a distinct, non-null badge — this is literally what makes the failed job visible in Active Downloads', () => {
    const badge = getStateBadge(UI.ERROR);
    assert.ok(badge);
    assert.equal(badge.label, 'Error');
  });

  test('PAUSED and DOWNLOADING get distinct labels from each other and from ERROR', () => {
    assert.equal(getStateBadge(UI.PAUSED).label, 'Paused');
    assert.equal(getStateBadge(UI.DOWNLOADING).label, 'Loading…');
    const labels = new Set([UI.ERROR, UI.PAUSED, UI.DOWNLOADING, UI.INSTALLING].map(s => getStateBadge(s).label));
    assert.equal(labels.size, 4, 'no two of these states should render the same label');
  });

  test('IDLE and CANCELED have no badge config (nothing rendered, matches existing pre-fix behavior)', () => {
    assert.equal(getStateBadge(UI.IDLE), null);
    assert.equal(getStateBadge(UI.CANCELED), null);
  });
});

describe('mapBackendStateToUI', () => {
  test('downloading family', () => {
    for (const s of ['downloading', 'download', 'in_progress', 'progress']) {
      assert.equal(mapBackendStateToUI(s), UI.DOWNLOADING, s);
    }
  });

  test('paused', () => {
    assert.equal(mapBackendStateToUI('paused'), UI.PAUSED);
  });

  test('verifying/extracting/installing all map to INSTALLING (deliberate coarse grouping, documented)', () => {
    assert.equal(mapBackendStateToUI('verifying'), UI.INSTALLING);
    assert.equal(mapBackendStateToUI('extracting'), UI.INSTALLING);
    assert.equal(mapBackendStateToUI('installing'), UI.INSTALLING);
  });

  test('completed family also maps to INSTALLING (existing pre-fix behavior, unchanged)', () => {
    for (const s of ['completed', 'done', 'finished']) {
      assert.equal(mapBackendStateToUI(s), UI.INSTALLING, s);
    }
  });

  test('canceled family', () => {
    assert.equal(mapBackendStateToUI('canceled'), UI.CANCELED);
    assert.equal(mapBackendStateToUI('cancelled'), UI.CANCELED);
  });

  test('error/failed both map to ERROR — this is what makes the failed job visible at all', () => {
    assert.equal(mapBackendStateToUI('error'), UI.ERROR);
    assert.equal(mapBackendStateToUI('failed'), UI.ERROR);
  });

  test('case-insensitive', () => {
    assert.equal(mapBackendStateToUI('FAILED'), UI.ERROR);
    assert.equal(mapBackendStateToUI('Downloading'), UI.DOWNLOADING);
  });

  test('unknown/empty state returns null (caller must not clobber existing uiByGame state)', () => {
    assert.equal(mapBackendStateToUI('some_future_status_this_code_does_not_know'), null);
    assert.equal(mapBackendStateToUI(''), null);
    assert.equal(mapBackendStateToUI(undefined), null);
  });
});

describe('buildShadowGame', () => {
  test('title falls back to the raw gameId when there is no catalog entry', () => {
    const g = buildShadowGame('synthetic-15gb-staging-test', null);
    assert.equal(g.gameId, 'synthetic-15gb-staging-test');
    assert.equal(g.title, 'synthetic-15gb-staging-test');
  });

  test('marked _source:"download-only" so GameSinglePage can suppress the fake Retry button', () => {
    const g = buildShadowGame('g', null);
    assert.equal(g._source, 'download-only');
  });

  test('downloadSize is hydrated from dl.totalBytes when available (matches the live 14.0 GB proof)', () => {
    const g = buildShadowGame('synthetic-15gb-staging-test', { totalBytes: 15000170224 });
    assert.equal(g.downloadSize, 15000170224);
  });

  test('downloadSize is null (not 0, not undefined) when dl is absent — GameInfoCard renders "—" for null, not "0 B"', () => {
    const g = buildShadowGame('g', null);
    assert.equal(g.downloadSize, null);
  });

  test('every array field defaults to an empty array, not null/undefined — downstream .filter()/.map() call sites never crash', () => {
    const g = buildShadowGame('g', null);
    for (const field of ['screenshots', 'tags', 'genres', 'languages', 'featureCards']) {
      assert.ok(Array.isArray(g[field]), `${field} must be an array`);
      assert.equal(g[field].length, 0);
    }
  });

  test('has no installable payload — downloadUrl/sha256 are empty strings, not catalog values', () => {
    const g = buildShadowGame('g', null);
    assert.equal(g.downloadUrl, '');
    assert.equal(g.sha256, '');
  });
});

describe('toErrStr', () => {
  test('empty/null input', () => {
    assert.equal(toErrStr(null), '');
    assert.equal(toErrStr(undefined), '');
  });
  test('string passes through', () => {
    assert.equal(toErrStr('boom'), 'boom');
  });
  test('object without .message falls back to JSON.stringify — matches the real 403 payload shape', () => {
    assert.equal(toErrStr({ code: 'HTTP_4XX', status: 403 }), '{"code":"HTTP_4XX","status":403}');
  });
  test('Error instance uses .message', () => {
    assert.equal(toErrStr(new Error('nope')), 'nope');
  });
});

describe('computeHydratedEntryUpdate — cold-start hydration decision logic (HYDRATION_PATH_TESTED)', () => {
  const noExisting = { uiState: null, hasDl: false, hasDlId: false, hasErr: false };

  test('no gameId on the raw entry -> null (nothing to hydrate)', () => {
    assert.equal(computeHydratedEntryUpdate(noExisting, { status: 'failed' }), null);
  });

  test('unmapped/unknown status -> null (never guess a UI state)', () => {
    assert.equal(computeHydratedEntryUpdate(noExisting, { gameId: 'g', status: 'some_future_status' }), null);
  });

  test('the exact real historical entry: failed, 0 bytes, canResume:false, HTTP_4XX/403 error, hits all four fields', () => {
    const entry = {
      id: 'b94023a9-5aa1-48b5-b29c-759b875daa4b', gameId: 'synthetic-15gb-staging-test', version: '1.0.0',
      status: 'failed', bytesDownloaded: 0, totalBytes: 15000170224,
      canResume: false, error: { code: 'HTTP_4XX', status: 403 },
    };
    const u = computeHydratedEntryUpdate(noExisting, entry);
    assert.equal(u.gameId, 'synthetic-15gb-staging-test');
    assert.equal(u.uiState, UI.ERROR);
    assert.equal(u.dlId, 'b94023a9-5aa1-48b5-b29c-759b875daa4b');
    assert.equal(u.dl.totalBytes, 15000170224); // the exact value behind the live "14.0 GB" proof
    assert.equal(u.dl.bytesDownloaded, 0);
    assert.equal(u.dl.canResume, false);
    assert.equal(u.err, '{"code":"HTTP_4XX","status":403}');
  });

  test('dedup: a gameId already present in uiByGame (live event won the race) is left alone', () => {
    const u = computeHydratedEntryUpdate({ ...noExisting, uiState: UI.DOWNLOADING }, { gameId: 'g', status: 'failed' });
    assert.equal(u.uiState, undefined, 'must not overwrite a state a live event already set');
  });

  test('dedup: dl/dlId/err are each independently skipped when already present, even if uiState still needs setting', () => {
    const u = computeHydratedEntryUpdate(
      { uiState: null, hasDl: true, hasDlId: true, hasErr: true },
      { gameId: 'g', id: 'new-id', status: 'failed', bytesDownloaded: 999, totalBytes: 999, error: 'x' }
    );
    assert.equal(u.dl, undefined);
    assert.equal(u.dlId, undefined);
    assert.equal(u.err, undefined);
    assert.equal(u.uiState, UI.ERROR, 'uiState still needs to be set independently of the other three');
  });

  test('non-error mapped state never produces an err field, even without a prior error', () => {
    const u = computeHydratedEntryUpdate(noExisting, { gameId: 'g', status: 'paused', canResume: true });
    assert.equal(u.uiState, UI.PAUSED);
    assert.equal(u.err, undefined);
    assert.equal(u.dl.canResume, true);
  });

  test('percent is computed safely when totalBytes is 0 (no division by zero)', () => {
    const u = computeHydratedEntryUpdate(noExisting, { gameId: 'g', status: 'downloading', bytesDownloaded: 0, totalBytes: 0 });
    assert.equal(u.dl.percent, 0);
  });
});

describe('DOWNLOAD_SAFE_STATES', () => {
  test('contains exactly the states a lagging download event must never overwrite', () => {
    assert.ok(DOWNLOAD_SAFE_STATES.has(UI.INSTALLED));
    assert.ok(DOWNLOAD_SAFE_STATES.has(UI.RUNNING));
    assert.ok(!DOWNLOAD_SAFE_STATES.has(UI.DOWNLOADING));
    assert.ok(!DOWNLOAD_SAFE_STATES.has(UI.ERROR), 'ERROR must NOT be safe — a failed job needs to actually show as failed');
  });
});
