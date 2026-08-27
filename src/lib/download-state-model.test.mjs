// src/lib/download-state-model.test.mjs
// node:test, zero new dependencies. Run with: node --test src/lib/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { UI, DOWNLOAD_SAFE_STATES, mapBackendStateToUI, buildShadowGame, toErrStr, computeHydratedEntryUpdate, getStateBadge, getDownloadAction, resolveDownloadCommandTarget, executeDownloadAction } from './download-state-model.js';

describe('getDownloadAction — CTA decision logic, no JSX (RENDER_PATH_TESTED, closes Avi\'s last gap)', () => {
  const catalogGame = { gameId: 'ultrakill', _source: 'local' };
  const downloadOnlyGame = { gameId: 'synthetic-15gb-staging-test', _source: 'download-only' };
  const access = true;

  test('DOWNLOADING -> pause, enabled', () => {
    const a = getDownloadAction(UI.DOWNLOADING, access, catalogGame, { percent: 40 }, false);
    assert.equal(a.action, 'pause');
    assert.equal(a.disabled, false);
  });

  test('PAUSED + canResume:true -> resume, enabled', () => {
    const a = getDownloadAction(UI.PAUSED, access, catalogGame, { canResume: true }, false);
    assert.equal(a.action, 'resume');
    assert.equal(a.disabled, false);
  });

  test('PAUSED + canResume:false -> no action, disabled — never call resumeDownload() on a dead end', () => {
    const a = getDownloadAction(UI.PAUSED, access, catalogGame, { canResume: false }, false);
    assert.equal(a.action, null);
    assert.equal(a.disabled, true);
  });

  test('PAUSED + canResume missing (undefined/null) -> treated the same as false, no action', () => {
    const a = getDownloadAction(UI.PAUSED, access, catalogGame, {}, false);
    assert.equal(a.action, null);
  });

  test('ERROR on a download-only game -> no action, never Retry — the exact fix for the fake-button bug', () => {
    const a = getDownloadAction(UI.ERROR, access, downloadOnlyGame, null, false);
    assert.equal(a.action, null);
    assert.equal(a.disabled, true);
    assert.equal(a.label, 'DOWNLOAD FAILED');
  });

  test('ERROR on a real catalog game -> RETRY INSTALL still offered (unchanged existing behavior)', () => {
    const a = getDownloadAction(UI.ERROR, access, catalogGame, null, false);
    assert.equal(a.action, 'install');
    assert.equal(a.label, 'RETRY INSTALL');
  });

  test('VERIFYING/EXTRACTING/INSTALLING states (all map to UI.INSTALLING) -> no action', () => {
    const a = getDownloadAction(UI.INSTALLING, access, catalogGame, null, false);
    assert.equal(a.action, null);
  });

  test('RUNNING -> no action (PLAYING…)', () => {
    assert.equal(getDownloadAction(UI.RUNNING, access, catalogGame, null, false).action, null);
  });

  test('INSTALLED -> play', () => {
    assert.equal(getDownloadAction(UI.INSTALLED, access, catalogGame, null, false).action, 'play');
  });

  test('unknown/undefined uiState on a real catalog game -> falls to default (install), unchanged legacy behavior', () => {
    const a = getDownloadAction(undefined, access, catalogGame, null, false);
    assert.equal(a.action, 'install');
  });

  test('unknown/undefined uiState on a download-only game -> no action, NOT install (Avi\'s catch: the legacy fallback cannot install a shadow game — empty downloadUrl/sha256)', () => {
    const a = getDownloadAction(undefined, access, downloadOnlyGame, null, false);
    assert.equal(a.action, null);
    assert.equal(a.disabled, true);
  });

  test('no download-only path ever reaches the legacy "install" action, across every state', () => {
    for (const state of [UI.IDLE, UI.DOWNLOADING, UI.PAUSED, UI.INSTALLING, UI.INSTALLED, UI.RUNNING, UI.UPDATE_AVAILABLE, UI.UPDATING, UI.ERROR, UI.CANCELED, undefined, 'totally_unknown']) {
      const a = getDownloadAction(state, access, downloadOnlyGame, { canResume: true, percent: 1 }, false);
      assert.notEqual(a.action, 'install', `state=${state} must never resolve to "install" for a download-only game`);
    }
  });

  test('no CTA depends on catalog membership except the ERROR/Retry distinction — DOWNLOADING/PAUSED behave identically for catalog and download-only games', () => {
    const catalogA = getDownloadAction(UI.DOWNLOADING, access, catalogGame, { percent: 10 }, false);
    const shadowA = getDownloadAction(UI.DOWNLOADING, access, downloadOnlyGame, { percent: 10 }, false);
    assert.equal(catalogA.action, shadowA.action);
    const catalogP = getDownloadAction(UI.PAUSED, access, catalogGame, { canResume: true }, false);
    const shadowP = getDownloadAction(UI.PAUSED, access, downloadOnlyGame, { canResume: true }, false);
    assert.equal(catalogP.action, shadowP.action);
  });

  test('no subscription access overrides everything else with SUBSCRIBE TO PLAY', () => {
    const a = getDownloadAction(UI.DOWNLOADING, false, catalogGame, { percent: 50 }, false);
    assert.equal(a.action, 'subscribe');
  });

  test('busy disables pause/resume/install/update/play but does not change the action itself', () => {
    const a = getDownloadAction(UI.DOWNLOADING, access, catalogGame, {}, true);
    assert.equal(a.action, 'pause');
    assert.equal(a.disabled, true);
  });
});

describe('resolveDownloadCommandTarget — never gameId as a fallback for the download id', () => {
  test('returns the download id looked up by gameId, not the gameId itself', () => {
    const id = resolveDownloadCommandTarget({
      selectedGameId: 'synthetic-15gb-staging-test',
      downloadIdByGame: { 'synthetic-15gb-staging-test': 'b94023a9-5aa1-48b5-b29c-759b875daa4b' },
    });
    assert.equal(id, 'b94023a9-5aa1-48b5-b29c-759b875daa4b');
    assert.notEqual(id, 'synthetic-15gb-staging-test', 'must never return the gameId itself');
  });

  test('no entry for this gameId -> null, never falls back to selectedGameId', () => {
    const id = resolveDownloadCommandTarget({ selectedGameId: 'no-download-yet', downloadIdByGame: {} });
    assert.equal(id, null);
  });

  test('no selectedGameId at all -> null', () => {
    assert.equal(resolveDownloadCommandTarget({ selectedGameId: null, downloadIdByGame: { g: 'd1' } }), null);
  });

  test('a gameId that happens to collide with another game\'s download id is not confused — exact key lookup only', () => {
    const id = resolveDownloadCommandTarget({
      selectedGameId: 'ultrakill',
      downloadIdByGame: { ultrakill: 'd-ultrakill-1', 'synthetic-15gb-staging-test': 'd-synthetic-1' },
    });
    assert.equal(id, 'd-ultrakill-1');
  });
});

describe('executeDownloadAction — proves exactly one IPC call, with exactly the resolved id, never gameId', () => {
  function spies() {
    const calls = { pause: [], resume: [] };
    return {
      calls,
      pause: async (id) => { calls.pause.push(id); return { ok: true }; },
      resume: async (id) => { calls.resume.push(id); return { ok: true }; },
    };
  }

  test('action:"pause" calls pause(targetId) exactly once, never resume', async () => {
    const { calls, pause, resume } = spies();
    const res = await executeDownloadAction({ action: 'pause', targetId: 'd1', pause, resume });
    assert.deepEqual(calls.pause, ['d1']);
    assert.deepEqual(calls.resume, []);
    assert.equal(res.ok, true);
  });

  test('action:"resume" calls resume(targetId) exactly once, never pause', async () => {
    const { calls, pause, resume } = spies();
    await executeDownloadAction({ action: 'resume', targetId: 'd1', pause, resume });
    assert.deepEqual(calls.resume, ['d1']);
    assert.deepEqual(calls.pause, []);
  });

  test('the id passed to the IPC call is exactly targetId — a gameId-shaped string is passed through unchanged, never re-derived', async () => {
    const { calls, pause, resume } = spies();
    // Deliberately gameId-shaped to prove this function does no lookup of
    // its own — resolveDownloadCommandTarget already did that upstream.
    await executeDownloadAction({ action: 'pause', targetId: 'synthetic-15gb-staging-test', pause, resume });
    assert.deepEqual(calls.pause, ['synthetic-15gb-staging-test']);
  });

  test('action:"none"/null -> no IPC call at all', async () => {
    const { calls, pause, resume } = spies();
    const res = await executeDownloadAction({ action: null, targetId: 'd1', pause, resume });
    assert.deepEqual(calls.pause, []);
    assert.deepEqual(calls.resume, []);
    assert.equal(res.ok, false);
  });

  test('missing targetId -> no IPC call, even with a valid action', async () => {
    const { calls, pause, resume } = spies();
    await executeDownloadAction({ action: 'pause', targetId: null, pause, resume });
    assert.deepEqual(calls.pause, []);
  });

  test('unsupported action -> no IPC call', async () => {
    const { calls, pause, resume } = spies();
    await executeDownloadAction({ action: 'install', targetId: 'd1', pause, resume });
    assert.deepEqual(calls.pause, []);
    assert.deepEqual(calls.resume, []);
  });
});

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
