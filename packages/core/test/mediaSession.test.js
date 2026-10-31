import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaSessionController } from '../dist/index.js';
import { setupMockDomEnv } from './mockEnv.js';

test('MediaSessionController - registers native music controls and disables 15s seek skip', () => {
  const { actions } = setupMockDomEnv();

  let playFired = false;
  let pauseFired = false;
  let prevFired = false;
  let nextFired = false;

  const ctrl = new MediaSessionController({
    onPlay: () => { playFired = true; },
    onPause: () => { pauseFired = true; },
    onPrev: () => { prevFired = true; },
    onNext: () => { nextFired = true; }
  }, true);

  ctrl.registerHandlers();

  assert.ok(typeof actions['play'] === 'function');
  assert.ok(typeof actions['pause'] === 'function');
  assert.ok(typeof actions['previoustrack'] === 'function');
  assert.ok(typeof actions['nexttrack'] === 'function');

  // Critical: seek backward/forward/to MUST be null to suppress 15s jump buttons
  assert.equal(actions['seekbackward'], null);
  assert.equal(actions['seekforward'], null);
  assert.equal(actions['seekto'], null);

  actions['play']();
  actions['pause']();
  actions['previoustrack']();
  actions['nexttrack']();

  assert.equal(playFired, true);
  assert.equal(pauseFired, true);
  assert.equal(prevFired, true);
  assert.equal(nextFired, true);
});

test('MediaSessionController - formats dynamic lockscreen lyric layout and performs incremental diff', () => {
  const { mediaSessionMock } = setupMockDomEnv();
  const ctrl = new MediaSessionController({
    onPlay: () => {}, onPause: () => {}, onPrev: () => {}, onNext: () => {}
  });

  const track = {
    id: 1,
    title: '晴天',
    artist: '周杰伦',
    album: '叶惠美',
    src: '1.mp3',
    artwork: 'https://example.com/cover.jpg'
  };

  // 1. Initial metadata without lyrics
  ctrl.updateMetadata(track);
  assert.equal(mediaSessionMock.metadata.title, '晴天');
  assert.equal(mediaSessionMock.metadata.artist, '周杰伦');
  assert.equal(mediaSessionMock.metadata.album, '叶惠美');
  assert.equal(mediaSessionMock.metadata.artwork.length, 6, 'Should generate 6 sizes for lockscreen & Apple Watch');

  // 2. Dynamic lyric line 1
  ctrl.updateMetadata(track, { currentLine: '故事的小黄花', nextLine: '从出生那年就飘着' });
  assert.equal(mediaSessionMock.metadata.title, '故事的小黄花', 'Title shows large center lyric');
  assert.equal(mediaSessionMock.metadata.artist, '晴天 · 周杰伦', 'Artist shows Song · Artist');
  assert.equal(mediaSessionMock.metadata.album, '⏭ 从出生那年就飘着', 'Album shows next line preview');

  // 3. Redundant update should be throttled (no re-creation)
  const metaRef = mediaSessionMock.metadata;
  ctrl.updateMetadata(track, { currentLine: '故事的小黄花', nextLine: '从出生那年就飘着' });
  assert.equal(mediaSessionMock.metadata, metaRef, 'Same lyric MUST not re-instantiate MediaMetadata to avoid IPC spam');
});

test('MediaSessionController - updates position and clamps values safely', () => {
  const { mediaSessionMock } = setupMockDomEnv();
  const ctrl = new MediaSessionController({
    onPlay: () => {}, onPause: () => {}, onPrev: () => {}, onNext: () => {}
  });

  ctrl.updatePosition(45, 180, 1.0);
  assert.deepEqual(mediaSessionMock.lastPositionState, {
    duration: 180,
    playbackRate: 1.0,
    position: 45
  });

  // Clamping
  ctrl.updatePosition(200, 180, 1.0);
  assert.equal(mediaSessionMock.lastPositionState.position, 180);

  ctrl.updatePosition(-10, 180, 1.0);
  assert.equal(mediaSessionMock.lastPositionState.position, 0);
});
