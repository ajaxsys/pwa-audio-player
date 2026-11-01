import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc, getActiveLyric } from '../dist/index.js';

test('parseLrc - parses standard, single-decimal, colon-separated and multi-timestamp lyrics', () => {
  const lrc = `
[00:00.00]作曲 : 周杰伦
[00:01.50]作词 : 方文山
[00:10.00]雨下整夜 我的爱溢出就像雨水
[00:15.5]院子落叶 跟我的思念厚厚一叠
[00:22:50]几句是非 也无法将我的热情冷却
[01:00.00][01:30.00]副歌重复两遍
  `.trim();

  const lines = parseLrc(lrc);
  assert.equal(lines.length, 7);
  assert.deepEqual(lines[0], { time: 0, text: '作曲 : 周杰伦' });
  assert.deepEqual(lines[1], { time: 1.5, text: '作词 : 方文山' });
  assert.deepEqual(lines[2], { time: 10, text: '雨下整夜 我的爱溢出就像雨水' });
  assert.deepEqual(lines[3], { time: 15.5, text: '院子落叶 跟我的思念厚厚一叠' });
  assert.deepEqual(lines[4], { time: 22.5, text: '几句是非 也无法将我的热情冷却' });
  assert.equal(lines[5].time, 60);
  assert.equal(lines[6].time, 90);
});

test('getActiveLyric - resolves current and next line with text aliases', () => {
  const lines = [
    { time: 0, text: '第一句' },
    { time: 10, text: '第二句' },
    { time: 20, text: '第三句' }
  ];

  const before = getActiveLyric(lines, -1);
  assert.equal(before.index, -1);
  assert.equal(before.nextLine, '第一句');
  assert.equal(before.nextText, '第一句');

  const active = getActiveLyric(lines, 12);
  assert.equal(active.index, 1);
  assert.equal(active.currentLine, '第二句');
  assert.equal(active.currentText, '第二句');
  assert.equal(active.nextLine, '第三句');
  assert.equal(active.nextText, '第三句');
});
