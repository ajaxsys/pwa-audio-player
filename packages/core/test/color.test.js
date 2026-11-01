import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PALETTE,
  rgbToHsl,
  hslToRgb,
  extractPaletteFromPixels,
  extractCoverPalette
} from '../dist/index.js';

test('color - rgbToHsl and hslToRgb round-trip accuracy', () => {
  const [r, g, b] = [220, 38, 38]; // Red
  const [h, s, l] = rgbToHsl(r, g, b);
  assert.ok(h >= 0 && h <= 1);
  assert.ok(s > 0.5);
  assert.ok(l > 0.3 && l < 0.7);

  const [rr, gg, bb] = hslToRgb(h, s, l);
  assert.equal(Math.abs(rr - r) <= 2, true);
  assert.equal(Math.abs(gg - g) <= 2, true);
  assert.equal(Math.abs(bb - b) <= 2, true);
});

test('color - extractPaletteFromPixels returns DEFAULT_PALETTE for empty or transparent data', () => {
  const empty = extractPaletteFromPixels(new Uint8ClampedArray(0));
  assert.deepEqual(empty, DEFAULT_PALETTE);

  const transparent = extractPaletteFromPixels(new Uint8ClampedArray([0, 0, 0, 0]));
  assert.deepEqual(transparent, DEFAULT_PALETTE);
});

test('color - extractPaletteFromPixels extracts dominant and accent correctly', () => {
  // 32x32 pixels, 70% dark [30, 30, 30, 255] and 30% vibrant cyan [6, 182, 212, 255]
  const pixels = new Uint8ClampedArray(1000 * 4);
  for (let i = 0; i < 700 * 4; i += 4) {
    pixels[i] = 30;
    pixels[i + 1] = 30;
    pixels[i + 2] = 30;
    pixels[i + 3] = 255;
  }
  for (let i = 700 * 4; i < 1000 * 4; i += 4) {
    pixels[i] = 6;
    pixels[i + 1] = 182;
    pixels[i + 2] = 212;
    pixels[i + 3] = 255;
  }

  const palette = extractPaletteFromPixels(pixels, true);
  assert.equal(palette.dominant, 'rgb(30, 30, 30)');
  assert.notEqual(palette.accent, 'rgb(30, 30, 30)');
  assert.ok(palette.glow.startsWith('rgba('));
});

test('color - extractCoverPalette falls back to DEFAULT_PALETTE when url is empty or fails', async () => {
  const resEmpty = await extractCoverPalette('');
  assert.deepEqual(resEmpty, DEFAULT_PALETTE);

  const resNull = await extractCoverPalette(null);
  assert.deepEqual(resNull, DEFAULT_PALETTE);
});
