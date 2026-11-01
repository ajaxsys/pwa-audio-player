import test from 'node:test';
import assert from 'node:assert/strict';
import { PwaPlayer } from '../dist/index.js';
import { setupMockDomEnv } from './mockEnv.js';

test('PwaPlayer - initial state and subscription contract', () => {
  const { mockAudio } = setupMockDomEnv();
  const player = new PwaPlayer({
    audioElement: mockAudio,
    initialQueue: [
      { id: 1, title: 'Track 1', src: '1.mp3', duration: 180 },
      { id: 2, title: 'Track 2', src: '2.mp3', duration: 200 }
    ],
    initialIndex: 0
  });

  let stateReceived = null;
  const unsub = player.subscribe((state) => {
    stateReceived = state;
  });

  assert.ok(stateReceived);
  assert.equal(stateReceived.currentTrack?.title, 'Track 1');
  assert.equal(stateReceived.queue.length, 2);
  assert.equal(stateReceived.isPlaying, false);

  unsub();
  player.destroy();
});

test('PwaPlayer - advances automatically on ended event (auto-chaining)', async () => {
  const { mockAudio } = setupMockDomEnv();
  const player = new PwaPlayer({
    audioElement: mockAudio,
    initialQueue: [
      { id: 1, title: 'Song 1', src: '1.mp3', duration: 10 },
      { id: 2, title: 'Song 2', src: '2.mp3', duration: 12 }
    ],
    initialIndex: 0,
    initialMode: 'loop'
  });

  await player.play();
  assert.equal(player.getState().currentTrack?.title, 'Song 1');
  assert.equal(player.getState().isPlaying, true);

  // Trigger ended event (simulating 10s song finishing naturally)
  mockAudio.trigger('ended');
  await new Promise(r => setTimeout(r, 20));

  assert.equal(player.getState().currentTrack?.title, 'Song 2', 'MUST automatically step to next track on ended');
  assert.equal(player.getState().queueIndex, 1);
  player.destroy();
});

test('PwaPlayer - isolates ended and timeupdate events while in silent hold', async () => {
  const { mockAudio } = setupMockDomEnv();
  const player = new PwaPlayer({
    audioElement: mockAudio,
    keepAlive: { strategy: 'silent-hold', hardPauseTimeoutMs: 0 },
    initialQueue: [
      { id: 1, title: 'Song 1', src: '1.mp3', duration: 180 },
      { id: 2, title: 'Song 2', src: '2.mp3', duration: 200 }
    ],
    initialIndex: 0
  });

  await player.play();
  mockAudio.currentTime = 50;

  // Pause under silent-hold strategy -> enters silent hold
  player.pause();
  assert.equal(player.getState().isHolding, true);
  assert.equal(player.getState().isF3Holding, true);
  assert.equal(player.getState().playbackState, 'holding');
  assert.equal(mockAudio.loop, true);

  // Simulate 2s silent WAV firing ended event in background
  mockAudio.currentTime = 2;
  mockAudio.duration = 2;
  mockAudio.trigger('ended');
  mockAudio.trigger('timeupdate');

  // Should NOT advance track, should NOT overwrite song duration
  assert.equal(player.getState().currentTrack?.title, 'Song 1', 'Queue MUST NOT advance when silent WAV ends');
  assert.equal(player.getState().queueIndex, 0);
  assert.equal(player.getState().isHolding, true);

  // Resuming
  await player.play();
  assert.equal(player.getState().isHolding, false);
  player.destroy();
});
