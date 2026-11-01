import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTrackForStorage, PlayerStorageAdapter } from '../dist/index.js';

test('sanitizeTrackForStorage - strips transient blob: URLs from track object', () => {
  const normalTrack = { id: 1, title: 'Song', src: 'https://cdn.example.com/song.mp3' };
  assert.deepEqual(sanitizeTrackForStorage(normalTrack), normalTrack);

  const blobTrack = { id: 2, title: 'Blob Song', src: 'blob:http://localhost/uuid-123', custom: 'keep' };
  const cleaned = sanitizeTrackForStorage(blobTrack);
  assert.equal(cleaned.src, undefined);
  assert.equal(cleaned.title, 'Blob Song');
  assert.equal(cleaned.custom, 'keep');

  const fallbackTrack = { id: 'track-42', title: 'Fallback Song', url: 'blob:http://localhost/uuid-456' };
  const cleanedFallback = sanitizeTrackForStorage(fallbackTrack, {
    fallbackUrl: (id) => `/stream?id=${id}`
  });
  assert.equal(cleanedFallback.url, '/stream?id=track-42');
});

test('PlayerStorageAdapter - saves, loads, and clears state safely with mock storage', () => {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    key: (i) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; }
  };
  globalThis.window = { localStorage: globalThis.localStorage };

  const adapter = new PlayerStorageAdapter({ prefix: 'test_player_' });
  assert.equal(adapter.isAvailable(), true);

  const tracks = [
    { id: 10, title: 'Track 1', src: 'https://example.com/1.mp3' },
    { id: 20, title: 'Track 2', src: 'blob:https://example.com/temp' }
  ];

  adapter.save({
    queue: tracks,
    queueIndex: 1,
    playMode: 'loop',
    currentTime: 45.5,
    volume: 0.8,
    playlistId: 'custom-playlist',
    autoSkipTrial: true
  });

  const loaded = adapter.load();
  assert.equal(loaded.queue?.length, 2);
  assert.equal(loaded.queue[0].src, 'https://example.com/1.mp3');
  assert.equal(loaded.queue[1].src, undefined); // Sanitized blob
  assert.equal(loaded.queueIndex, 1);
  assert.equal(loaded.playMode, 'loop');
  assert.equal(loaded.currentTime, 45.5);
  assert.equal(loaded.volume, 0.8);
  assert.equal(loaded.playlistId, 'custom-playlist');
  assert.equal(loaded.autoSkipTrial, true);

  adapter.clear();
  assert.equal(Object.keys(store).length, 0);
});
