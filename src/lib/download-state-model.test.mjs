// src/lib/download-state-model.test.mjs
// node:test, zero new dependencies. Run with: node --test src/lib/*.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { UI, DOWNLOAD_SAFE_STATES, mapBackendStateToUI, buildShadowGame } from './download-state-model.js';

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

describe('DOWNLOAD_SAFE_STATES', () => {
  test('contains exactly the states a lagging download event must never overwrite', () => {
    assert.ok(DOWNLOAD_SAFE_STATES.has(UI.INSTALLED));
    assert.ok(DOWNLOAD_SAFE_STATES.has(UI.RUNNING));
    assert.ok(!DOWNLOAD_SAFE_STATES.has(UI.DOWNLOADING));
    assert.ok(!DOWNLOAD_SAFE_STATES.has(UI.ERROR), 'ERROR must NOT be safe — a failed job needs to actually show as failed');
  });
});
