import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, parseTime } from '../dist/index.js';

test('formatTime - handles standard, zero, negative, and hour durations', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(-10), '00:00');
  assert.equal(formatTime(NaN), '00:00');
  assert.equal(formatTime(5), '00:05');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(215.8), '03:35');
  assert.equal(formatTime(3600), '01:00:00');
  assert.equal(formatTime(3665), '01:01:05');
});

test('parseTime - parses mm:ss and hh:mm:ss strings to seconds', () => {
  assert.equal(parseTime(''), 0);
  assert.equal(parseTime('invalid'), 0);
  assert.equal(parseTime('00:05'), 5);
  assert.equal(parseTime('03:35'), 215);
  assert.equal(parseTime('01:01:05'), 3665);
});
