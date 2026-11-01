/**
 * 🎨 Dynamic Cover Artwork Palette Extractor & Color Utilities
 *
 * Extracts dominant, accent, muted, and glow colors from album covers or raw pixels
 * using 4-bit color quantization histograms and adaptive theme luminance correction.
 */

export interface CoverPalette {
  dominant: string; // rgb(r, g, b)
  accent: string;   // rgb(r, g, b)
  muted: string;    // rgb(r, g, b)
  glow: string;     // rgba(r, g, b, a)
}

export const DEFAULT_PALETTE: CoverPalette = {
  dominant: 'rgb(30, 41, 59)',
  accent: 'rgb(239, 68, 68)',
  muted: 'rgb(148, 163, 184)',
  glow: 'rgba(239, 68, 68, 0.45)'
};

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

interface ColorBucket {
  count: number;
  totalR: number;
  totalG: number;
  totalB: number;
}

/**
 * Extracts a balanced theme palette from 32x32 raw pixel data (RGBA).
 * Pure mathematical implementation ideal for headless and unit test environments.
 */
export function extractPaletteFromPixels(
  pixels: Uint8ClampedArray | number[] | Uint8Array,
  isDarkTheme = true
): CoverPalette {
  if (!pixels || pixels.length < 4) {
    return { ...DEFAULT_PALETTE };
  }

  const buckets = new Map<number, ColorBucket>();
  const totalPixels = Math.floor(pixels.length / 4);

  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 128) continue; // ignore high transparency pixels

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // 4-bit quantization (0..15)
    const r4 = r >> 4;
    const g4 = g >> 4;
    const b4 = b >> 4;
    const key = (r4 << 8) | (g4 << 4) | b4;

    const bkt = buckets.get(key);
    if (bkt) {
      bkt.count++;
      bkt.totalR += r;
      bkt.totalG += g;
      bkt.totalB += b;
    } else {
      buckets.set(key, { count: 1, totalR: r, totalG: g, totalB: b });
    }
  }

  if (buckets.size === 0) {
    return { ...DEFAULT_PALETTE };
  }

  interface AnalyzedBucket {
    r: number;
    g: number;
    b: number;
    h: number;
    s: number;
    l: number;
    count: number;
  }

  const analyzed: AnalyzedBucket[] = [];
  for (const bkt of buckets.values()) {
    const r = Math.round(bkt.totalR / bkt.count);
    const g = Math.round(bkt.totalG / bkt.count);
    const b = Math.round(bkt.totalB / bkt.count);
    const [h, s, l] = rgbToHsl(r, g, b);
    analyzed.push({ r, g, b, h, s, l, count: bkt.count });
  }

  // 1. Dominant: most frequent color bucket
  analyzed.sort((a, b) => b.count - a.count);
  const domBkt = analyzed[0];

  // 2. Accent: highest saturation & vibrancy weighted bucket (avoids pure black/white/gray)
  let bestAccentBkt = domBkt;
  let bestAccentScore = -1;

  for (const bkt of analyzed) {
    // Filter out extreme black or white
    if (bkt.l < 0.1 || bkt.l > 0.95) continue;
    const vibrancy = bkt.s;
    const countWeight = Math.sqrt(bkt.count / totalPixels);
    const score = (vibrancy * 2 + (1 - Math.abs(bkt.l - 0.5))) * countWeight;
    if (score > bestAccentScore) {
      bestAccentScore = score;
      bestAccentBkt = bkt;
    }
  }

  // 3. Muted: soft, medium lightness, lower saturation
  let bestMutedBkt = domBkt;
  let bestMutedScore = -1;
  for (const bkt of analyzed) {
    if (bkt === bestAccentBkt) continue;
    const isMediumLight = 1 - Math.abs(bkt.l - 0.55);
    const isSoft = 1 - Math.abs(bkt.s - 0.3);
    const score = isMediumLight * 1.5 + isSoft;
    if (score > bestMutedScore) {
      bestMutedScore = score;
      bestMutedBkt = bkt;
    }
  }

  // Adaptive luminance and contrast correction
  let accentHsl = [bestAccentBkt.h, bestAccentBkt.s, bestAccentBkt.l];
  if (isDarkTheme) {
    // Under dark mode, brighten accent if too dark (< 0.45)
    if (accentHsl[2] < 0.45) accentHsl[2] = 0.55;
    // Boost saturation slightly if washed out
    if (accentHsl[1] < 0.25) accentHsl[1] = 0.4;
  } else {
    // Under light mode, dim accent if too bright (> 0.65)
    if (accentHsl[2] > 0.65) accentHsl[2] = 0.45;
  }

  const [accR, accG, accB] = hslToRgb(accentHsl[0], accentHsl[1], accentHsl[2]);

  return {
    dominant: `rgb(${domBkt.r}, ${domBkt.g}, ${domBkt.b})`,
    accent: `rgb(${accR}, ${accG}, ${accB})`,
    muted: `rgb(${bestMutedBkt.r}, ${bestMutedBkt.g}, ${bestMutedBkt.b})`,
    glow: `rgba(${accR}, ${accG}, ${accB}, 0.45)`
  };
}

/**
 * Asynchronously extracts palette from an image URL using in-memory 32x32 canvas.
 * Handles CORS anonymous attributes and gracefully falls back to DEFAULT_PALETTE on error or timeout.
 */
export async function extractCoverPalette(
  coverUrl?: string | null,
  isDarkTheme = true
): Promise<CoverPalette> {
  if (!coverUrl || typeof window === 'undefined') {
    return { ...DEFAULT_PALETTE };
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ ...DEFAULT_PALETTE });
      }
    }, 1500);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve({ ...DEFAULT_PALETTE });
          return;
        }
        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32);
        const palette = extractPaletteFromPixels(imgData.data, isDarkTheme);
        resolve(palette);
      } catch {
        resolve({ ...DEFAULT_PALETTE });
      }
    };

    img.onerror = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve({ ...DEFAULT_PALETTE });
    };

    img.src = coverUrl;
  });
}
