import type { LyricLine } from './types';

export function parseLrc(lrcText?: string): LyricLine[] {
  if (!lrcText || typeof lrcText !== 'string') return [];

  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    timeRegex.lastIndex = 0;
    const matches: number[] = [];
    let match;

    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      matches.push(min * 60 + sec + ms / 1000);
    }

    const text = line.replace(/\[\d{1,2}:\d{1,2}(?:\.\d{1,3})?\]/g, '').trim();
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
): { index: number; currentLine?: string; nextLine?: string } {
  if (!lyrics.length) {
    return { index: -1 };
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
    return {
      index: -1,
      nextLine: lyrics[0]?.text
    };
  }

  return {
    index: matchedIndex,
    currentLine: lyrics[matchedIndex]?.text,
    nextLine: lyrics[matchedIndex + 1]?.text
  };
}
