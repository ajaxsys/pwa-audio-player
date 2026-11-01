import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  formatCacheDate,
  queryStorageQuota
} from '../dist/index.js';

test('cache - formatBytes handles various sizes and edge cases', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(-100), '0 B');
  assert.equal(formatBytes(NaN), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1024 * 1024 * 5.5), '5.5 MB');
  assert.equal(formatBytes(1024 * 1024 * 1024 * 2), '2 GB');
});

test('cache - formatCacheDate formats timestamp safely', () => {
  assert.equal(formatCacheDate(0), '');
  assert.equal(formatCacheDate(NaN), '');
  // A fixed timestamp: 2026-11-01 12:30:00 UTC/local
  const d = new Date(2026, 10, 1, 14, 25);
  const formatted = formatCacheDate(d.getTime());
  assert.equal(formatted, '11-01 14:25');
});

test('cache - queryStorageQuota safely returns fallback in mock or headless environment', async () => {
  const result = await queryStorageQuota();
  assert.equal(typeof result.usage, 'number');
  assert.equal(typeof result.quota, 'number');
  assert.equal(typeof result.percentage, 'number');
  assert.equal(typeof result.isAvailable, 'boolean');
});
