import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureGuardian } from '../dist/index.js';

test('GestureGuardian - preloads surrounding tracks without duplicate fetches', () => {
  const appendedLinks = [];
  globalThis.document = {
    createElement: (tag) => {
      return { tag, rel: '', as: '', href: '', crossOrigin: '', parentNode: null };
    },
    head: {
      appendChild: (el) => {
        appendedLinks.push(el);
      }
    }
  };

  const gesture = new GestureGuardian();
  const queue = [
    { id: 1, title: 'Track 1', src: 'https://example.com/1.mp3' },
    { id: 2, title: 'Track 2', src: 'https://example.com/2.mp3' },
    { id: 3, title: 'Track 3', src: 'https://example.com/3.mp3' }
  ];

  // While playing Track 2 (index 1), should preload Track 3 (next) and Track 1 (prev)
  gesture.preloadSurroundingTracks(queue, 1);

  assert.equal(appendedLinks.length, 2);
  const hrefs = appendedLinks.map(l => l.href);
  assert.ok(hrefs.includes('https://example.com/3.mp3'));
  assert.ok(hrefs.includes('https://example.com/1.mp3'));

  // Calling again should not duplicate preloads (deduplication cache)
  gesture.preloadSurroundingTracks(queue, 1);
  assert.equal(appendedLinks.length, 2);
});
