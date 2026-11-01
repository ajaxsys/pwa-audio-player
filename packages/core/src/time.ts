/**
 * Time formatting and parsing utility functions
 */

/**
 * Format seconds into mm:ss or hh:mm:ss string
 * @param seconds Floating or integer seconds
 * @returns Formatted time string (e.g. "03:45", "01:23:45")
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds <= 0) {
    return '00:00';
  }

  const totalSec = Math.floor(seconds);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const remainingSec = totalSec % 60;

  const mm = minutes.toString().padStart(2, '0');
  const ss = remainingSec.toString().padStart(2, '0');

  if (hours > 0) {
    const hh = hours.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

/**
 * Parse time string (mm:ss or hh:mm:ss) into seconds
 * @param timeStr e.g. "03:45", "01:23:45"
 * @returns Seconds as a number
 */
export function parseTime(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;

  const parts = timeStr.trim().split(':').map((p) => parseFloat(p));
  if (parts.some((p) => isNaN(p))) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }

  return 0;
}
