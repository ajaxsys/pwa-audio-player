import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_BANDS,
  BUILTIN_PRESETS,
  calculatePeqCurve
} from '../dist/index.js';

test('peq - INITIAL_BANDS and BUILTIN_PRESETS are properly structured', () => {
  assert.equal(INITIAL_BANDS.length, 5);
  assert.equal(INITIAL_BANDS[0].freq, 60);
  assert.equal(INITIAL_BANDS[4].freq, 14000);

  assert.ok(BUILTIN_PRESETS.flat);
  assert.ok(BUILTIN_PRESETS.macbook);
  assert.ok(BUILTIN_PRESETS.vocal);
  assert.ok(BUILTIN_PRESETS.bass);
  assert.ok(BUILTIN_PRESETS.air);

  assert.equal(BUILTIN_PRESETS.bass.bands[0].gain, 5.0);
});

test('peq - calculatePeqCurve produces expected interpolation curve points', () => {
  const points = calculatePeqCurve(INITIAL_BANDS, 20);
  assert.equal(points.length, 21);
  assert.equal(points[0].freq, 60);
  assert.equal(points[20].freq, 14000);

  // Flat preset should produce ~0 dB offset across all points
  for (const p of points) {
    assert.ok(Math.abs(p.gainOffset) < 0.001);
  }

  // Bass boost preset
  const bassPoints = calculatePeqCurve(BUILTIN_PRESETS.bass.bands, 20);
  assert.ok(bassPoints[0].gainOffset > 3.0); // Sub-bass is boosted
});
