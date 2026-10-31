import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaylistManager } from '../dist/index.js';

test('PlaylistManager - handles sequential mode', () => {
  const tracks = [
    { id: 1, title: 'Track 1', src: '1.mp3' },
    { id: 2, title: 'Track 2', src: '2.mp3' }
  ];
  const pm = new PlaylistManager(tracks, 0, 'sequence');

  assert.equal(pm.getCurrentTrack()?.title, 'Track 1');
  assert.equal(pm.stepNext()?.title, 'Track 2');
  // Reached end, next should be null
  assert.equal(pm.stepNext(), null);
  assert.equal(pm.getCurrentIndex(), 1);

  // Prev
  assert.equal(pm.stepPrev()?.title, 'Track 1');
  assert.equal(pm.stepPrev(), null);
});

test('PlaylistManager - handles loop mode', () => {
  const tracks = [
    { id: 1, title: 'Track 1', src: '1.mp3' },
    { id: 2, title: 'Track 2', src: '2.mp3' },
    { id: 3, title: 'Track 3', src: '3.mp3' }
  ];
  const pm = new PlaylistManager(tracks, 2, 'loop');

  assert.equal(pm.getCurrentIndex(), 2);
  // Loop wraps to 0
  assert.equal(pm.stepNext()?.title, 'Track 1');
  assert.equal(pm.stepPrev()?.title, 'Track 3');
});

test('PlaylistManager - handles single mode', () => {
  const tracks = [
    { id: 1, title: 'Track 1', src: '1.mp3' },
    { id: 2, title: 'Track 2', src: '2.mp3' }
  ];
  const pm = new PlaylistManager(tracks, 0, 'single');

  assert.equal(pm.getNextIndex(), 0);
  assert.equal(pm.getPrevIndex(), 0);
  assert.equal(pm.stepNext()?.title, 'Track 1');
});

test('PlaylistManager - handles shuffle mode with Fisher-Yates', () => {
  const tracks = [
    { id: 1, title: 'Track 1', src: '1.mp3' },
    { id: 2, title: 'Track 2', src: '2.mp3' },
    { id: 3, title: 'Track 3', src: '3.mp3' },
    { id: 4, title: 'Track 4', src: '4.mp3' }
  ];
  const pm = new PlaylistManager(tracks, 0, 'shuffle');

  const visitedIndices = new Set([pm.getCurrentIndex()]);
  for (let i = 0; i < tracks.length - 1; i++) {
    const nextTrack = pm.stepNext();
    assert.ok(nextTrack);
    visitedIndices.add(pm.getCurrentIndex());
  }

  // All 4 tracks should be visited
  assert.equal(visitedIndices.size, 4);
});

test('PlaylistManager - handles empty queue gracefully', () => {
  const pm = new PlaylistManager([], 0, 'loop');
  assert.equal(pm.getCurrentTrack(), null);
  assert.equal(pm.stepNext(), null);
  assert.equal(pm.stepPrev(), null);
  assert.equal(pm.getNextIndex(), -1);
  assert.equal(pm.getPrevIndex(), -1);
});
