import test from 'node:test';
import assert from 'node:assert/strict';
import { SilentHoldKeeper } from '../dist/index.js';
import { setupMockDomEnv } from './mockEnv.js';

test('SilentHoldKeeper - bypasses keep-alive in non-iOS or strategy=native', () => {
  const { mockAudio } = setupMockDomEnv();
  const keeper = new SilentHoldKeeper(mockAudio, { strategy: 'native' });

  const handled = keeper.handlePause(
    { id: 1, title: 'Test Track', src: 'https://example.com/song1.mp3' },
    42.5,
    180,
    mockAudio.src
  );

  assert.equal(handled, false);
  assert.equal(keeper.isHolding(), false);
  keeper.reset();
});

test('SilentHoldKeeper - activates silent hold with 2s WAV loop and triple-lock contract', async () => {
  const { mockAudio } = setupMockDomEnv();
  let keepAliveEntered = false;

  const keeper = new SilentHoldKeeper(
    mockAudio,
    { strategy: 'silent-hold', hardPauseTimeoutMs: 0 },
    {
      onKeepAliveEnter: () => {
        keepAliveEntered = true;
      }
    }
  );

  let playCalled = false;
  let pauseCalled = false;
  mockAudio.play = async () => { playCalled = true; };
  mockAudio.pause = () => { pauseCalled = true; };

  const track = { id: 101, title: '七里香', artist: '周杰伦', src: 'https://example.com/song1.mp3' };
  const handled = keeper.handlePause(track, 42.5, 180, mockAudio.src);

  assert.equal(handled, true);
  assert.equal(keeper.isHolding(), true);
  assert.equal(mockAudio.loop, true);
  assert.match(mockAudio.src, /^blob:/);
  assert.equal(playCalled, true);
  assert.equal(pauseCalled, false, 'audio.pause() MUST NOT be called in silent hold');

  await new Promise(r => setTimeout(r, 10));
  assert.equal(keepAliveEntered, true);
  keeper.reset();
});

test('SilentHoldKeeper - triggers Flip-Flop Toggle when pause received while holding (AirPods compatibility)', () => {
  const { mockAudio } = setupMockDomEnv();
  const keeper = new SilentHoldKeeper(mockAudio, { strategy: 'silent-hold', hardPauseTimeoutMs: 0 });

  const track = { id: 101, title: 'Song', src: 'https://example.com/song1.mp3' };
  keeper.handlePause(track, 42.5, 180, mockAudio.src);
  assert.equal(keeper.isHolding(), true);

  // User presses AirPods stem which dispatches "pause" while silent WAV loop is outputting audio
  const handledAgain = keeper.handlePause(track, 0.5, 2, mockAudio.src);
  assert.equal(handledAgain, true);
  assert.equal(keeper.isHolding(), false, 'Flip-Flop MUST invert pause into resume');
  assert.equal(mockAudio.loop, false);
  assert.equal(mockAudio.src, 'https://example.com/song1.mp3');
  keeper.reset();
});

test('SilentHoldKeeper - handles slow network resume via loadedmetadata seek tolerance', async () => {
  const { mockAudio, listeners } = setupMockDomEnv();
  const keeper = new SilentHoldKeeper(mockAudio, { strategy: 'silent-hold', hardPauseTimeoutMs: 0 });

  const track = { id: 101, title: 'Song', src: 'https://example.com/song.mp3' };
  keeper.handlePause(track, 88.5, 240, mockAudio.src);

  // Simulate unbuffered state
  mockAudio.readyState = 0;
  mockAudio.duration = 0;
  mockAudio.currentTime = 0;

  let resumedCallbackFired = false;
  keeper.handleResume(() => {
    resumedCallbackFired = true;
  });

  await new Promise(r => setTimeout(r, 10));
  assert.equal(listeners['loadedmetadata']?.length, 1);
  assert.equal(mockAudio.currentTime, 0);

  // Trigger loadedmetadata event
  mockAudio.readyState = 1;
  mockAudio.duration = 240;
  listeners['loadedmetadata'][0]();

  await new Promise(r => setTimeout(r, 70));
  assert.equal(mockAudio.currentTime, 88.5, 'Audio currentTime MUST seek back to saved breakpoint');
  assert.equal(resumedCallbackFired, true);
  keeper.reset();
});

test('SilentHoldKeeper - battery preservation timeout triggers hard-pause', async () => {
  const { mockAudio } = setupMockDomEnv();
  let hardPauseTimedOut = false;

  // Set timeout to 30ms for testing
  const keeper = new SilentHoldKeeper(
    mockAudio,
    { strategy: 'silent-hold', hardPauseTimeoutMs: 30 },
    {
      onHardPauseTimeout: () => {
        hardPauseTimedOut = true;
      }
    }
  );

  let pauseCalled = false;
  mockAudio.pause = () => { pauseCalled = true; };

  keeper.handlePause(
    { id: 1, title: 'Song', src: 'https://example.com/song.mp3' },
    10,
    100,
    mockAudio.src
  );
  assert.equal(keeper.isHolding(), true);

  await new Promise(r => setTimeout(r, 60));
  assert.equal(hardPauseTimedOut, true);
  assert.equal(keeper.isHolding(), false);
  assert.equal(pauseCalled, true);
  keeper.reset();
});

test('SilentHoldKeeper - updates saved pause time during drag while in holding state', () => {
  const { mockAudio } = setupMockDomEnv();
  const keeper = new SilentHoldKeeper(mockAudio, { strategy: 'silent-hold', hardPauseTimeoutMs: 0 });

  keeper.handlePause(
    { id: 1, title: 'Song', src: 'https://example.com/song.mp3' },
    20,
    100,
    mockAudio.src
  );
  assert.equal(keeper.getSavedPauseTime(), 20);

  keeper.updateSavedPauseTime(75);
  assert.equal(keeper.getSavedPauseTime(), 75);

  // Clamping test
  keeper.updateSavedPauseTime(150);
  assert.equal(keeper.getSavedPauseTime(), 100);
  keeper.reset();
});
