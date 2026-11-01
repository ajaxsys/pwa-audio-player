import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRangeHeader,
  createPartialResponseFromBlob,
  createPartialResponse,
  isAudioRequest,
  shuffleArray
} from '../dist/index.js';

test('sw - parseRangeHeader parses valid ranges correctly', () => {
  // Full range
  const r1 = parseRangeHeader('bytes=0-1023', 5000);
  assert.deepEqual(r1, { start: 0, end: 1023 });

  // Prefix range
  const r2 = parseRangeHeader('bytes=100-', 1000);
  assert.deepEqual(r2, { start: 100, end: 999 });

  // Suffix range
  const r3 = parseRangeHeader('bytes=-300', 1000);
  assert.deepEqual(r3, { start: 700, end: 999 });

  // Clamped range
  const r4 = parseRangeHeader('bytes=500-2000', 1000);
  assert.deepEqual(r4, { start: 500, end: 999 });
});

test('sw - parseRangeHeader returns null for invalid or unsatisfiable ranges', () => {
  assert.equal(parseRangeHeader(null, 1000), null);
  assert.equal(parseRangeHeader('', 1000), null);
  assert.equal(parseRangeHeader('invalid-header', 1000), null);
  // start >= totalSize
  assert.equal(parseRangeHeader('bytes=1500-2000', 1000), null);
  // negative suffix
  assert.equal(parseRangeHeader('bytes=-0', 1000), null);
});

test('sw - createPartialResponseFromBlob creates 206 Partial Content Response', async () => {
  const bytes = new Uint8Array(1000);
  for (let i = 0; i < 1000; i++) bytes[i] = i % 256;
  const blob = new Blob([bytes], { type: 'audio/mpeg' });

  const res = createPartialResponseFromBlob(blob, 'bytes=100-499');
  assert.equal(res.status, 206);
  assert.equal(res.statusText, 'Partial Content');
  assert.equal(res.headers.get('Content-Range'), 'bytes 100-499/1000');
  assert.equal(res.headers.get('Content-Length'), '400');
  assert.equal(res.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(res.headers.get('Content-Type'), 'audio/mpeg');

  const sliceBlob = await res.blob();
  assert.equal(sliceBlob.size, 400);
});

test('sw - createPartialResponseFromBlob returns 200 OK when range is absent', async () => {
  const bytes = new Uint8Array(500);
  const blob = new Blob([bytes], { type: 'audio/flac' });

  const res = createPartialResponseFromBlob(blob, null);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(res.headers.get('Content-Length'), '500');
});

test('sw - createPartialResponse wraps full Response into 206 Partial Content', async () => {
  const bytes = new Uint8Array(800);
  const fullBlob = new Blob([bytes], { type: 'audio/ogg' });
  const fullResponse = new Response(fullBlob, {
    status: 200,
    headers: { 'Content-Type': 'audio/ogg', 'X-Custom-Header': 'foobar' }
  });

  const partialRes = await createPartialResponse(fullResponse, 'bytes=200-399');
  assert.equal(partialRes.status, 206);
  assert.equal(partialRes.headers.get('Content-Range'), 'bytes 200-399/800');
  assert.equal(partialRes.headers.get('Content-Length'), '200');
  assert.equal(partialRes.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(partialRes.headers.get('X-Custom-Header'), 'foobar');
});

test('sw - isAudioRequest identifies audio streams and file extensions', () => {
  assert.equal(isAudioRequest('/v3/stream?id=123'), true);
  assert.equal(isAudioRequest('https://api.example.com/v3/history/stream?path=abc'), true);
  assert.equal(isAudioRequest('/assets/music.mp3'), true);
  assert.equal(isAudioRequest('/tracks/song.flac?t=123'), true);
  assert.equal(isAudioRequest('/manifest.json'), false);
  assert.equal(isAudioRequest('/api/song/detail'), false);
  assert.equal(isAudioRequest(''), false);
});

test('playlist - shuffleArray returns shuffled copy without modifying original', () => {
  const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const shuffled = shuffleArray(original);

  assert.equal(shuffled.length, original.length);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), original);
  // Original is unmodified
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
