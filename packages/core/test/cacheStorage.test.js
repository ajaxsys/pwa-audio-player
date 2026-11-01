import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioCacheStorage } from '../dist/index.js';

test('AudioCacheStorage - play count tracking and metadata storage', () => {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    key: (i) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; }
  };
  globalThis.window = { localStorage: globalThis.localStorage };

  const storage = new AudioCacheStorage({
    metaStorageKey: 'test_meta_',
    playCountsStorageKey: 'test_counts_'
  });

  assert.equal(storage.getPlayCount(123), 0);
  assert.equal(storage.recordPlayCount(123), 1);
  assert.equal(storage.recordPlayCount(123), 2);
  assert.equal(storage.getPlayCount(123), 2);

  // Write and read metadata
  storage.writeMeta({
    '/stream?id=123': { id: '123', name: 'Song A', artist: 'Artist A' }
  });

  const ids = storage.getCachedIds();
  assert.ok(ids.has('123') || ids.has(123));

  // Verify play count sync into meta
  storage.recordPlayCount(123);
  const meta = storage.readMeta();
  assert.equal(meta['/stream?id=123'].playCount, 3);
});

test('AudioCacheStorage - isCached handles metadata lookup safely without caches api', async () => {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const storage = new AudioCacheStorage({
    metaStorageKey: 'test_meta_lookup_'
  });

  storage.writeMeta({
    '/stream?id=999': { id: '999', name: 'Test' }
  });

  const isCached = await storage.isCached(999);
  assert.equal(isCached, true);

  const notCached = await storage.isCached(888);
  assert.equal(notCached, false);
});
