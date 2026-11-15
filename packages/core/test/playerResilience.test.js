import test from 'node:test';
import assert from 'node:assert/strict';
import { createPwaPlayer } from '../dist/index.js';
import { setupMockDomEnv } from './mockEnv.js';

test('PwaPlayer auto-recovers from unexpected interruption and restores position', async (t) => {
  const { mockAudio } = setupMockDomEnv();

  const states = [];
  const player = createPwaPlayer({
    audioElement: mockAudio,
    initialQueue: [{ id: '1', title: 'Track 1', src: 'https://cdn.example.com/1.mp3', duration: 180 }],
    interruptionRecovery: { probeDelaysMs: [15, 50] },
    precacheNext: false
  });
  t.after(() => player.destroy());

  player.subscribe((s) => states.push(s));
  await player.play();
  assert.equal(player.getState().isPlaying, true);
  assert.equal(player.getState().isInterrupted, false);

  // Simulate OS navigation/call interruption pausing <audio> mid-track
  mockAudio.currentTime = 45;
  mockAudio.paused = true;
  mockAudio.trigger('pause');

  assert.equal(player.getState().isInterrupted, true);
  assert.equal(player.getState().isPlaying, false);

  // Wait for first recovery probe (15ms); simulate Safari resetting currentTime to 0
  mockAudio.currentTime = 0;
  await new Promise((r) => setTimeout(r, 35));

  assert.equal(player.getState().isInterrupted, false);
  assert.equal(player.getState().isPlaying, true);
  assert.equal(mockAudio.currentTime, 45);
});

test('PwaPlayer suppresses interruption recovery near natural track end and advances cleanly on ended', async (t) => {
  const { mockAudio } = setupMockDomEnv();

  const player = createPwaPlayer({
    audioElement: mockAudio,
    initialQueue: [
      { id: '1', title: 'Track 1', src: 'https://cdn.example.com/1.mp3', duration: 12 },
      { id: '2', title: 'Track 2', src: 'https://cdn.example.com/2.mp3', duration: 12 }
    ],
    interruptionRecovery: { probeDelaysMs: [15] },
    precacheNext: false
  });
  t.after(() => player.destroy());

  await player.play();
  mockAudio.duration = 12;
  mockAudio.currentTime = 11.6;
  mockAudio.paused = true;
  mockAudio.trigger('pause');

  assert.equal(player.getState().isInterrupted, false);

  mockAudio.ended = true;
  mockAudio.trigger('ended');
  await new Promise((r) => setTimeout(r, 15));

  assert.equal(player.getState().currentTrack?.id, '2');
  assert.equal(player.getState().isPlaying, true);
});

test('PwaPlayer performs single URL refresh retry and auto-skips unplayable streams cleanly', async (t) => {
  const { mockAudio } = setupMockDomEnv();

  let resolveCalls = 0;
  const track1 = { id: 'bad1', title: 'Flaky Track', src: 'https://cdn.example.com/stale-1.mp3' };
  const track2 = { id: 'good2', title: 'Healthy Track', src: 'https://cdn.example.com/good-2.mp3' };

  const player = createPwaPlayer({
    audioElement: mockAudio,
    initialQueue: [track1, track2],
    resolveTrackUrl: async (track) => {
      resolveCalls += 1;
      return `${track.src}?refreshed=${resolveCalls}`;
    },
    precacheNext: false
  });
  t.after(() => player.destroy());

  await player.play();
  assert.equal(player.getState().currentTrack?.id, 'bad1');

  // 1st error triggers single resolveTrackUrl retry
  mockAudio.trigger('error');
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(resolveCalls, 1);
  assert.equal(player.getState().currentTrack?.id, 'bad1');
  assert.match(mockAudio.src, /\?refreshed=1/);

  // 2nd error on same track marks it unplayable and auto-skips to track 2
  mockAudio.trigger('error');
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(resolveCalls, 1);
  assert.equal(track1.unplayable, true);
  assert.equal(player.getState().currentTrack?.id, 'good2');
  assert.equal(player.getState().isPlaying, true);
});

test('PwaPlayer pre-caches next playable track into blob URL and uses it seamlessly without resetting on play()', async (t) => {
  const { restore, mockAudio } = setupMockEnvWithCache();
  t.after(() => restore());

  const t1 = { id: '1', title: 'Now Playing', src: 'https://cdn.example.com/1.wav', duration: 12 };
  const t2Dead = { id: '2', title: 'Dead Track', src: 'https://cdn.example.com/404.wav', duration: 12 };
  const t3Good = { id: '3', title: 'Next Playable', src: 'https://cdn.example.com/3.wav', duration: 12 };

  const player = createPwaPlayer({
    audioElement: mockAudio,
    initialQueue: [t1, t2Dead, t3Good]
  });
  t.after(() => player.destroy());

  await player.play();
  // Let async precache complete (probes 404.wav -> skips -> fetches 3.wav)
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(t2Dead.unplayable, true);
  assert.equal(player.getState().isNextPrecached, true);

  // Track 1 ends -> player skips dead track 2 and loads track 3 from pre-cached blob: URL
  mockAudio.ended = true;
  mockAudio.trigger('ended');
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(player.getState().currentTrack?.id, '3');
  assert.ok(mockAudio.src.startsWith('blob:precache-'));
  const preloadedSrc = mockAudio.src;

  // Pausing and resuming a pre-cached blob: URL must keep the blob: src intact (not treat it as keepAlive silent WAV)
  player.pause();
  await player.play();
  assert.equal(mockAudio.src, preloadedSrc);
  assert.equal(player.getState().isPlaying, true);
});

function setupMockEnvWithCache() {
  const base = setupMockDomEnv();
  const prevCaches = globalThis.caches;
  const prevFetch = globalThis.fetch;
  const prevURL = globalThis.URL;

  const cacheMap = new Map();
  let seq = 0;

  const mockCaches = {
    async open() {
      return {
        async match(k) { return cacheMap.get(String(k)); },
        async put(k, resp) { cacheMap.set(String(k), resp); }
      };
    }
  };

  globalThis.caches = mockCaches;
  if (globalThis.window) {
    globalThis.window.caches = mockCaches;
    globalThis.window.dispatchEvent = () => {};
  }

  globalThis.URL = {
    createObjectURL() {
      return `blob:precache-${++seq}`;
    },
    revokeObjectURL() {}
  };

  globalThis.fetch = async (url) => {
    if (String(url).includes('404.wav')) {
      return new Response('', { status: 404 });
    }
    return new Response(new Uint8Array(260 * 1024), {
      status: 200,
      headers: { 'Content-Type': 'audio/wav' }
    });
  };

  return {
    mockAudio: base.mockAudio,
    restore() {
      globalThis.caches = prevCaches;
      globalThis.fetch = prevFetch;
      globalThis.URL = prevURL;
    }
  };
}
