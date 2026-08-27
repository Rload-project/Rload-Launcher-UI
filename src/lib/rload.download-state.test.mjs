// src/lib/rload.download-state.test.mjs
//
// node:test, zero new dependencies (Node 18+ ships this). Run with:
//   node --test src/lib/*.test.mjs
//
// Two things are proven here, separately:
//  1. normalizeProgress()/normalizeState() — pure field-mapping, direct calls.
//  2. subscribeDownloads() — the REAL wiring: a fake window.rload.games IPC
//     bridge captures the callbacks Electron's preload would normally call,
//     then we invoke them with synthetic raw events exactly as main.js's
//     DownloadManager would emit them, and assert what the consumer
//     (onState/onProgress passed by launcher-games.jsx) actually receives.
//     This is HYDRATION_PATH is separate (listDownloads(), not tested here);
//     this file proves the LIVE event path: onState() -> normalizeState() ->
//     consumer callback, with no DOM, no Electron, no real download.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProgress, normalizeState, subscribeDownloads } from './rload.js';

describe('normalizeProgress', () => {
  test('maps all fields including percent computed from bytes', () => {
    const out = normalizeProgress({ id: 'd1', gameId: 'synthetic-15gb-staging-test', version: '1.0.0', bytesDownloaded: 5000000, totalBytes: 15000170224 });
    assert.equal(out.id, 'd1');
    assert.equal(out.gameId, 'synthetic-15gb-staging-test');
    assert.equal(out.bytesDownloaded, 5000000);
    assert.equal(out.totalBytes, 15000170224);
    assert.equal(out.percent, 0); // rounds down at this scale, not a bug
  });

  test('falls back through alternate byte-count field names', () => {
    const out = normalizeProgress({ gameId: 'g', received: 10, total: 100 });
    assert.equal(out.bytesDownloaded, 10);
    assert.equal(out.totalBytes, 100);
    assert.equal(out.percent, 10);
  });

  test('null input returns null', () => {
    assert.equal(normalizeProgress(null), null);
  });
});

describe('normalizeState', () => {
  test('exposes every field the UI model needs — the exact point Avi flagged', () => {
    const out = normalizeState({
      id: 'd1', gameId: 'synthetic-15gb-staging-test', version: '1.0.0',
      status: 'failed', bytesDownloaded: 0, totalBytes: 15000170224,
      error: { code: 'HTTP_4XX', status: 403 }, canResume: false,
    });
    assert.equal(out.id, 'd1');
    assert.equal(out.gameId, 'synthetic-15gb-staging-test');
    assert.equal(out.state, 'failed');
    assert.equal(out.bytesDownloaded, 0);
    assert.equal(out.totalBytes, 15000170224);
    assert.deepEqual(out.error, { code: 'HTTP_4XX', status: 403 });
    assert.equal(out.canResume, false);
  });

  test('canResume:true survives normalization (paused, resumable)', () => {
    const out = normalizeState({ gameId: 'g', status: 'paused', canResume: true });
    assert.equal(out.state, 'paused');
    assert.equal(out.canResume, true);
  });

  test('canResume absent from the raw event normalizes to null, not true', () => {
    const out = normalizeState({ gameId: 'g', status: 'paused' });
    assert.equal(out.canResume, null);
  });

  test('accepts s.state as a fallback when s.status is absent', () => {
    const out = normalizeState({ gameId: 'g', state: 'downloading' });
    assert.equal(out.state, 'downloading');
  });

  test('null input returns null', () => {
    assert.equal(normalizeState(null), null);
  });
});

describe('subscribeDownloads — real wiring via a fake IPC bridge', () => {
  function installFakeBridge() {
    const captured = { onState: null, onProgress: null };
    globalThis.window = {
      rload: {
        games: {
          onState: (cb) => { captured.onState = cb; return () => { captured.onState = null; }; },
          onProgress: (cb) => { captured.onProgress = cb; return () => { captured.onProgress = null; }; },
        },
      },
    };
    return captured;
  }

  test('a synthetic onState "downloading" event reaches the consumer normalized', () => {
    const bridge = installFakeBridge();
    const received = [];
    subscribeDownloads({ onState: (s) => received.push(s) });
    assert.equal(typeof bridge.onState, 'function', 'subscribeDownloads must register a real onState callback');

    // Exactly the shape main.js's DownloadManager._emitState() broadcasts —
    // see downloadManager.js list()/onState wiring.
    bridge.onState({ id: 'd1', gameId: 'ultrakill', status: 'downloading', bytesDownloaded: 100, totalBytes: 1000, canResume: null });

    assert.equal(received.length, 1);
    assert.equal(received[0].gameId, 'ultrakill');
    assert.equal(received[0].state, 'downloading');
    assert.equal(received[0].bytesDownloaded, 100);
    assert.equal(received[0].totalBytes, 1000);
  });

  test('a synthetic onState "paused" event with canResume:true reaches the consumer', () => {
    const bridge = installFakeBridge();
    const received = [];
    subscribeDownloads({ onState: (s) => received.push(s) });

    bridge.onState({ id: 'd2', gameId: 'synthetic-15gb-staging-test', status: 'paused', bytesDownloaded: 5000000, totalBytes: 15000170224, canResume: true });

    assert.equal(received[0].state, 'paused');
    assert.equal(received[0].canResume, true, 'canResume must survive the real onState() -> normalizeState() -> consumer path, not just the pure function in isolation');
  });

  test('a synthetic onState "failed" event for a download-only game reaches the consumer with error and canResume:false', () => {
    const bridge = installFakeBridge();
    const received = [];
    subscribeDownloads({ onState: (s) => received.push(s) });

    bridge.onState({
      id: 'b94023a9-5aa1-48b5-b29c-759b875daa4b', gameId: 'synthetic-15gb-staging-test',
      status: 'failed', bytesDownloaded: 0, totalBytes: 15000170224,
      error: { code: 'HTTP_4XX', status: 403 }, canResume: false,
    });

    assert.equal(received[0].state, 'failed');
    assert.equal(received[0].canResume, false);
    assert.deepEqual(received[0].error, { code: 'HTTP_4XX', status: 403 });
  });

  test('progress and state events are independent — a progress tick does not need a prior state event', () => {
    const bridge = installFakeBridge();
    const progressReceived = [];
    subscribeDownloads({ onProgress: (p) => progressReceived.push(p) });

    bridge.onProgress({ id: 'd1', gameId: 'ultrakill', bytesDownloaded: 250, totalBytes: 1000 });

    assert.equal(progressReceived.length, 1);
    assert.equal(progressReceived[0].percent, 25);
  });

  test('unsubscribe stops future events from reaching the consumer', () => {
    const bridge = installFakeBridge();
    const received = [];
    const unsub = subscribeDownloads({ onState: (s) => received.push(s) });
    unsub();
    // subscribeDownloads' own returned unsub calls the bridge's unsub, which
    // nulls out bridge.onState — a leftover reference can't fire anymore.
    assert.equal(bridge.onState, null);
  });
});
