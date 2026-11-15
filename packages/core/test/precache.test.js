import test from 'node:test';
import assert from 'node:assert/strict';
import { NextTrackPrecacheController, getTrackPreloadKey } from '../dist/index.js';

function setupPrecacheEnv() {
  const prevCaches = globalThis.caches;
  const prevFetch = globalThis.fetch;
  const prevURL = globalThis.URL;
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;

  const store = new Map();
  const createdUrls = [];
  const revokedUrls = [];
  let seq = 0;

  globalThis.caches = {
    async open() {
      return {
        async match(key) {
          return store.get(String(key));
        },
        async put(key, response) {
          store.set(String(key), response);
        }
      };
    }
  };

  globalThis.URL = {
    createObjectURL(blob) {
      const u = `blob:mock-${++seq}-${blob.size}`;
      createdUrls.push(u);
      return u;
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    }
  };

  const boundAudios = [];
  globalThis.document = {
    querySelectorAll(selector) {
      return selector === 'audio' ? boundAudios : [];
    }
  };

  globalThis.window = {
    caches: globalThis.caches,
    location: { origin: 'https://example.com', href: 'https://example.com/' },
    dispatchEvent() {}
  };

  const restore = () => {
    globalThis.caches = prevCaches;
    globalThis.fetch = prevFetch;
    globalThis.URL = prevURL;
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  };

  return { store, createdUrls, revokedUrls, boundAudios, restore };
}

test('getTrackPreloadKey prioritizes id, then filePath, then title/artist metadata', () => {
  assert.equal(getTrackPreloadKey({ id: 42, title: 'A' }), 'id:42');
  assert.equal(getTrackPreloadKey({ filePath: '/music/a.flac', title: 'A' }), 'path:/music/a.flac');
  assert.equal(getTrackPreloadKey({ title: 'Song', artist: 'Artist' }), 'meta:Song-Artist');
});

test('NextTrackPrecacheController validates bytes, rejects tiny payloads, and flags trial clips when enabled', async (t) => {
  const env = setupPrecacheEnv();
  t.after(() => env.restore());

  const controller = new NextTrackPrecacheController({ skipTrial: true });

  // Case 1: Undersized error payload (< minValidBytes)
  globalThis.fetch = async () => new Response(new Uint8Array(1024), { status: 200 });
  const tinyTrack = { id: 'tiny', src: 'https://cdn.example.com/tiny.mp3' };
  const failures = [];
  const okTiny = await controller.precacheCandidateAudio(tinyTrack, (reason) => failures.push(reason));
  assert.equal(okTiny, false);
  assert.equal(tinyTrack.unplayable, true);
  assert.deepEqual(failures, ['unplayable']);

  // Case 2: Trial clip (< 1.25 MB) when skipTrial is true
  globalThis.fetch = async () => new Response(new Uint8Array(300 * 1024), { status: 200 });
  const trialTrack = { id: 'trial', src: 'https://cdn.example.com/trial.mp3' };
  const okTrial = await controller.precacheCandidateAudio(trialTrack, (reason) => failures.push(reason));
  assert.equal(okTrial, false);
  assert.equal(trialTrack.freeTrial, true);
  assert.deepEqual(failures, ['unplayable', 'trial']);

  controller.clear();
});

test('NextTrackPrecacheController caches valid audio, hits CacheStorage on repeat, and keeps active audio blob alive', async (t) => {
  const env = setupPrecacheEnv();
  t.after(() => env.restore());

  const controller = new NextTrackPrecacheController();
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(new Uint8Array(300 * 1024), {
      status: 200,
      headers: { 'Content-Type': 'audio/wav' }
    });
  };

  const t1 = { id: 't1', src: 'https://cdn.example.com/1.wav' };
  const ok1 = await controller.precacheCandidateAudio(t1, () => {});
  assert.equal(ok1, true);
  assert.equal(fetchCount, 1);

  const blob1 = controller.getPreloadedBlobUrl(t1);
  assert.ok(blob1 && blob1.startsWith('blob:mock-1-'));
  assert.equal(controller.isPreloadedBlobUrlForTrack(blob1, t1), true);

  // Bind blob1 to the active <audio> element before staging t2
  const activeAudio = { src: blob1, currentSrc: blob1 };
  env.boundAudios.push(activeAudio);

  // Second controller verifies CacheStorage hit without calling fetch again
  const controller2 = new NextTrackPrecacheController();
  const okFromCache = await controller2.precacheCandidateAudio(t1, () => {});
  assert.equal(okFromCache, true);
  assert.equal(fetchCount, 1);
  controller2.clear();

  // Staging t2 must preserve blob1 because it is still bound to active <audio>
  const t2 = { id: 't2', src: 'https://cdn.example.com/2.wav' };
  await controller.precacheCandidateAudio(t2, () => {});
  const blob2 = controller.getPreloadedBlobUrl(t2);
  assert.ok(blob2 && blob2 !== blob1);
  assert.equal(env.revokedUrls.includes(blob1), false);

  // Detach blob1 from <audio>, swap to blob2, then stage t3 -> blob1 should now be revoked
  activeAudio.src = blob2;
  activeAudio.currentSrc = blob2;

  const t3 = { id: 't3', src: 'https://cdn.example.com/3.wav' };
  await controller.precacheCandidateAudio(t3, () => {});
  assert.equal(env.revokedUrls.includes(blob1), true);
  assert.equal(env.revokedUrls.includes(blob2), false);

  controller.clear();
  assert.equal(env.revokedUrls.includes(blob2), true);
});
