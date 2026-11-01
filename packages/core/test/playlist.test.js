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

test('PlaylistManager - insertNext inserts immediately following current cursor', () => {
  const pm = new PlaylistManager([
    { id: 1, title: 'Track 1' },
    { id: 3, title: 'Track 3' }
  ], 0, 'sequence');

  pm.insertNext({ id: 2, title: 'Track 2' });
  const queue = pm.getQueue();
  assert.equal(queue.length, 3);
  assert.equal(queue[0].title, 'Track 1');
  assert.equal(queue[1].title, 'Track 2');
  assert.equal(queue[2].title, 'Track 3');
  assert.equal(pm.getCurrentIndex(), 0);
});

test('PlaylistManager - remove, move and clear operations with cursor protection', () => {
  const pm = new PlaylistManager([
    { id: 1, title: 'Track 1' },
    { id: 2, title: 'Track 2' },
    { id: 3, title: 'Track 3' }
  ], 1, 'sequence'); // current = Track 2

  // Move Track 1 to index 2: [Track 2, Track 3, Track 1]
  const moved = pm.move(0, 2);
  assert.equal(moved, true);
  assert.equal(pm.getCurrentTrack().title, 'Track 2');
  assert.equal(pm.getCurrentIndex(), 0);

  // Remove Track 3 (at index 1)
  const removed = pm.remove(1);
  assert.equal(removed.title, 'Track 3');
  assert.equal(pm.getQueue().length, 2);
  assert.equal(pm.getCurrentTrack().title, 'Track 2');

  pm.clear();
  assert.equal(pm.getQueue().length, 0);
  assert.equal(pm.getCurrentIndex(), 0);
});
