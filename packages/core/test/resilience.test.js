import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONLINE_URL_TTL_MS,
  isDefaultLocalStreamUrl,
  markTrackUrlResolved,
  isTrackUrlExpired,
  formatFallbackStreamUrl,
  withResolveTimeout,
  canRetryTrackStream,
  markTrackStreamRetried,
  clearTrackStreamRetry,
  classifyPlayRejection,
  bindAndPlayWithWatchdog,
  InterruptionRecoveryController
} from '../dist/index.js';

function createFakeAudio(initialPaused = false) {
  const listeners = new Map();
  return {
    src: '',
    paused: initialPaused,
    ended: false,
    currentTime: 0,
    duration: 120,
    readyState: 4,
    loop: false,
    playCalls: 0,
    nextPlayError: null,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    trigger(type) {
      for (const fn of [...(listeners.get(type) || [])]) {
        fn();
      }
    },
    play() {
      this.playCalls += 1;
      if (this.nextPlayError) {
        const err = this.nextPlayError;
        this.nextPlayError = null;
        return Promise.reject(err);
      }
      this.paused = false;
      return Promise.resolve();
    }
  };
}

test('URL TTL helpers track online streams and exempt local/blob URLs', () => {
  assert.equal(isDefaultLocalStreamUrl('blob:https://example.com/123'), true);
  assert.equal(isDefaultLocalStreamUrl('/stream?id=1'), true);
  assert.equal(isDefaultLocalStreamUrl('/v3/stream/online?url=x'), false);

  const remoteTrack = { id: 't1', src: 'https://cdn.example.com/song.mp3' };
  const t0 = 1_000_000;
  markTrackUrlResolved(remoteTrack, t0);
  assert.equal(isTrackUrlExpired(remoteTrack, t0 + 10_000), false);
  assert.equal(isTrackUrlExpired(remoteTrack, t0 + ONLINE_URL_TTL_MS + 1), true);

  const localTrack = { id: 't2', src: 'https://cdn.example.com/local.mp3', isLocal: true };
  markTrackUrlResolved(localTrack, t0);
  assert.equal(localTrack._resolvedAt, undefined);
  assert.equal(isTrackUrlExpired(localTrack, t0 + ONLINE_URL_TTL_MS * 2), false);
});

test('formatFallbackStreamUrl, withResolveTimeout, classifyPlayRejection, and retry tracking', async () => {
  const proxied = formatFallbackStreamUrl({
    url: 'https://media.example.com/a.mp3',
    headers: { Referer: 'https://ref.example.com', 'User-Agent': 'TestUA' }
  });
  assert.equal(
    proxied,
    '/v3/stream/online?url=https%3A%2F%2Fmedia.example.com%2Fa.mp3&referer=https%3A%2F%2Fref.example.com&ua=TestUA'
  );

  const fast = await withResolveTimeout(Promise.resolve('ok'), 100);
  assert.equal(fast, 'ok');

  await assert.rejects(
    withResolveTimeout(new Promise(() => {}), 20),
    /Resolve timeout after 20ms/
  );

  assert.equal(classifyPlayRejection({ name: 'AbortError' }), 'abort');
  assert.equal(classifyPlayRejection({ name: 'NotAllowedError' }), 'not_allowed');
  assert.equal(classifyPlayRejection({ name: 'NotSupportedError' }), 'stream_error');

  clearTrackStreamRetry();
  const track = { id: 'retry-1', src: 'https://cdn.example.com/1.mp3' };
  assert.equal(canRetryTrackStream(track), true);
  markTrackStreamRetried(track);
  assert.equal(canRetryTrackStream(track), false);
  clearTrackStreamRetry(track);
  assert.equal(canRetryTrackStream(track), true);
  assert.equal(canRetryTrackStream({ id: 'loc', src: '/stream', isLocal: true }), false);
});

test('InterruptionRecoveryController ignores intentional pauses and recovers unexpected interruptions', async () => {
  const controller = new InterruptionRecoveryController({ probeDelaysMs: [15, 45] });
  const audioEl = createFakeAudio(true);

  let syncPausedCount = 0;
  let recoveredCount = 0;

  controller.markIntentionalPause();
  controller.dispatchPauseEvent({
    audioEl,
    wasPlaying: true,
    curTime: 18,
    trackId: 'track-1',
    onSyncPaused: () => { syncPausedCount += 1; },
    onRecovered: () => { recoveredCount += 1; },
    onGiveUp: () => {}
  });

  assert.equal(syncPausedCount, 1);
  assert.equal(controller.isInterrupted(), false);

  // Unexpected OS focus interruption at t=42s
  controller.dispatchPauseEvent({
    audioEl,
    wasPlaying: true,
    curTime: 42,
    trackId: 'track-1',
    onSyncPaused: () => {},
    onRecovered: () => { recoveredCount += 1; },
    onGiveUp: () => {}
  });

  assert.equal(controller.isInterrupted(), true);
  assert.equal(controller.getResumeTime(), 42);

  // Safari sometimes resets currentTime to 0 before probe succeeds
  audioEl.currentTime = 0;
  await new Promise((r) => setTimeout(r, 35));

  assert.equal(recoveredCount, 1);
  assert.equal(controller.isInterrupted(), false);
  assert.equal(audioEl.currentTime, 42);
  controller.cancelRecovery();
});

test('InterruptionRecoveryController gives up after probe exhaustion and resumes on foreground reload', async () => {
  const controller = new InterruptionRecoveryController({ probeDelaysMs: [10, 20] });
  const audioEl = createFakeAudio(true);
  audioEl.readyState = 0;
  audioEl.nextPlayError = Object.assign(new Error('Audio focus busy'), { name: 'NotAllowedError' });

  let gaveUp = false;
  let recovered = false;
  let pendingSeek = 0;
  let clearedReload = false;

  controller.handleUnexpectedPause(
    audioEl,
    55,
    'track-fg',
    () => { recovered = true; },
    () => { gaveUp = true; }
  );

  // Make both probe attempts reject with NotAllowedError
  audioEl.play = () => Promise.reject(Object.assign(new Error('Focus held'), { name: 'NotAllowedError' }));
  await new Promise((r) => setTimeout(r, 45));

  assert.equal(gaveUp, true);
  assert.equal(recovered, false);
  assert.equal(controller.isInterrupted(), true);

  // Restore healthy play() and trigger foreground reload recovery
  audioEl.play = function () {
    this.paused = false;
    return Promise.resolve();
  };

  const track = { id: 'track-fg', src: 'https://cdn.example.com/fg.mp3' };
  const started = controller.executeForegroundResume({
    audioEl,
    track,
    curTime: 55,
    needsReload: true,
    onPendingSeek: (t) => { pendingSeek = t; },
    onClearedReload: () => { clearedReload = true; },
    onRecovered: () => { recovered = true; },
    onFallbackPlay: () => {}
  });

  assert.equal(started, true);
  assert.equal(pendingSeek, 55);
  assert.equal(clearedReload, true);
  assert.equal(audioEl.src, track.src);

  await new Promise((r) => setTimeout(r, 10));
  assert.equal(recovered, true);
  assert.equal(controller.isInterrupted(), false);
  controller.cancelRecovery();
});

test('bindAndPlayWithWatchdog handles watchdog timeout and routes play rejections', async () => {
  const audioEl = createFakeAudio(true);
  audioEl.readyState = 1;
  audioEl.currentTime = 0;
  audioEl.play = () => new Promise(() => {}); // Hung network socket

  let timedOut = false;
  bindAndPlayWithWatchdog({
    audioEl,
    track: { id: 'slow', src: 'https://cdn.example.com/slow.mp3' },
    url: 'https://cdn.example.com/slow.mp3',
    session: 1,
    getCurrentSession: () => 1,
    resetTime: true,
    onMetadataSync: () => {},
    onResetTimeApplied: () => {},
    onWatchdogTimeout: () => { timedOut = true; },
    onPlaySuccess: () => {},
    onNotAllowed: () => {},
    onStreamError: () => {},
    watchdogTimeoutMs: 25
  });

  await new Promise((r) => setTimeout(r, 45));
  assert.equal(timedOut, true);
});

test('dispatchPauseEvent suppresses interruption recovery near end of track', () => {
  const controller = new InterruptionRecoveryController({ probeDelaysMs: [20] });
  const audioEl = createFakeAudio(true);
  audioEl.duration = 200;
  audioEl.currentTime = 199.5;

  let syncedPaused = false;
  controller.dispatchPauseEvent({
    audioEl,
    wasPlaying: true,
    curTime: 199.5,
    duration: 200,
    trackId: 'ending-track',
    onSyncPaused: () => { syncedPaused = true; },
    onRecovered: () => {},
    onGiveUp: () => {}
  });

  assert.equal(syncedPaused, true);
  assert.equal(controller.isInterrupted(), false);
});
