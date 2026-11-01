import type { LyricLine } from './types';

export interface ActiveLyricResult {
  index: number;
  currentLine?: string;
  nextLine?: string;
  currentText?: string;
  nextText?: string;
}

export function parseLrc(lrcText?: string | null): LyricLine[] {
  if (!lrcText || typeof lrcText !== 'string') return [];

  const lines = lrcText.split(/\r?\n/);
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const line of lines) {
    timeRegex.lastIndex = 0;
    const matches: number[] = [];
    let match;

    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const fraction = match[3] ? parseFloat('0.' + match[3]) : 0;
      matches.push(min * 60 + sec + fraction);
    }

    if (matches.length === 0) continue;

    const text = line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim();
    if (text) {
      for (const t of matches) {
        result.push({ time: t, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export function getActiveLyric(
  lyrics: LyricLine[],
  currentTime: number
): ActiveLyricResult {
  if (!lyrics || !lyrics.length) {
    return { index: -1, currentLine: '', nextLine: '', currentText: '', nextText: '' };
  }

  let low = 0;
  let high = lyrics.length - 1;
  let matchedIndex = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lyrics[mid].time <= currentTime) {
      matchedIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (matchedIndex === -1) {
    const next = lyrics[0]?.text || '';
    return {
      index: -1,
      currentLine: '',
      nextLine: next,
      currentText: '',
      nextText: next
    };
  }

  const cur = lyrics[matchedIndex]?.text || '';
  const next = lyrics[matchedIndex + 1]?.text || '';

  return {
    index: matchedIndex,
    currentLine: cur,
    nextLine: next,
    currentText: cur,
    nextText: next
  };
}
