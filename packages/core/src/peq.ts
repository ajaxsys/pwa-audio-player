/**
 * 🎛️ 5-Band Parametric Equalizer (PEQ) Data Models, Presets & Frequency Curve Engine
 */

export interface Band {
  freq: number;
  gain: number;
  q: number;
  label: string;
  desc: string;
}

export interface PeqPreset {
  name: string;
  desc: string;
  bands: { freq: number; gain: number; q?: number }[];
}

export const INITIAL_BANDS: Band[] = [
  { freq: 60, gain: 0, q: 1.4, label: 'Sub-bass', desc: '60Hz' },
  { freq: 230, gain: 0, q: 1.4, label: 'De-box', desc: '230Hz' },
  { freq: 910, gain: 0, q: 2.0, label: 'Vocal body', desc: '910Hz' },
  { freq: 3600, gain: 0, q: 2.5, label: 'Clarity', desc: '3.6kHz' },
  { freq: 14000, gain: 0, q: 0.7, label: 'Air', desc: '14kHz' }
];

export const BUILTIN_PRESETS: Record<string, PeqPreset> = {
  flat: {
    name: 'Flat',
    desc: 'Pure and neutral',
    bands: [
      { freq: 60, gain: 0, q: 1.4 },
      { freq: 230, gain: 0, q: 1.4 },
      { freq: 910, gain: 0, q: 2.0 },
      { freq: 3600, gain: 0, q: 2.5 },
      { freq: 14000, gain: 0, q: 0.7 }
    ]
  },
  macbook: {
    name: 'MacBook Calibration',
    desc: 'Reduce 130Hz resonance, boost 60Hz and 14kHz air',
    bands: [
      { freq: 60, gain: 2.5, q: 1.4 },
      { freq: 230, gain: -3.5, q: 2.0 },
      { freq: 910, gain: 0, q: 2.0 },
      { freq: 3600, gain: 1.5, q: 2.2 },
      { freq: 14000, gain: 2.0, q: 0.7 }
    ]
  },
  vocal: {
    name: 'Vocal Warmth',
    desc: 'Clean 230Hz, boost 3.6kHz vocal details and smooth sibilance',
    bands: [
      { freq: 60, gain: -0.5, q: 1.4 },
      { freq: 230, gain: -2.0, q: 1.8 },
      { freq: 910, gain: 1.5, q: 1.8 },
      { freq: 3600, gain: 2.5, q: 2.2 },
      { freq: 14000, gain: -1.5, q: 1.2 }
    ]
  },
  bass: {
    name: 'Bass Boost',
    desc: 'Deep sub-bass impact with controlled low-mids',
    bands: [
      { freq: 60, gain: 5.0, q: 1.2 },
      { freq: 230, gain: -1.0, q: 1.4 },
      { freq: 910, gain: 0, q: 2.0 },
      { freq: 3600, gain: 1.0, q: 2.0 },
      { freq: 14000, gain: 1.0, q: 0.7 }
    ]
  },
  air: {
    name: 'Headphone Air',
    desc: 'Slightly reduce sub-bass, enhance ultra-high overtones and air',
    bands: [
      { freq: 60, gain: -1.0, q: 1.4 },
      { freq: 230, gain: 0, q: 1.4 },
      { freq: 910, gain: 0.5, q: 2.0 },
      { freq: 3600, gain: 2.0, q: 2.5 },
      { freq: 14000, gain: 3.5, q: 0.7 }
    ]
  }
};

export interface PeqCurvePoint {
  index: number;
  freq: number;
  gainOffset: number; // Combined dB offset at this frequency point
}

/**
 * Calculates a log2-distributed frequency response curve for Canvas or SVG graph rendering.
 * @param bands Array of bands with freq and gain
 * @param pointsCount Total interpolation sample points (default 40)
 * @param minFreq Starting frequency in Hz (default 60)
 * @param maxFreq Ending frequency in Hz (default 14000)
 */
export function calculatePeqCurve(
  bands: { freq: number; gain: number; q?: number }[],
  pointsCount = 40,
  minFreq = 60,
  maxFreq = 14000
): PeqCurvePoint[] {
  const points: PeqCurvePoint[] = [];
  const logMin = Math.log2(minFreq);
  const logMax = Math.log2(maxFreq);
  const logSpan = logMax - logMin;

  for (let i = 0; i <= pointsCount; i++) {
    const fraction = i / pointsCount;
    const currentFreq = Math.pow(2, logMin + fraction * logSpan);

    let totalOffset = 0;
    for (const b of bands) {
      const bandIndex = ((Math.log2(b.freq) - logMin) / logSpan) * pointsCount;
      const dist = Math.abs(i - bandIndex);
      const qFactor = b.q ? Math.max(0.5, b.q) : 1.4;
      // Gaussian distribution envelope weighted by Q factor
      const variance = 20 / (qFactor * 0.7);
      totalOffset += b.gain * Math.exp((-dist * dist) / variance);
    }

    points.push({
      index: i,
      freq: Math.round(currentFreq),
      gainOffset: totalOffset
    });
  }

  return points;
}
