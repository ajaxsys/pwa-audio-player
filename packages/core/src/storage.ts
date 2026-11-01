import type { Track, PlayMode } from './types';

export interface PlayerPersistedState<T = Track> {
  queue: T[];
  queueIndex: number;
  playMode: PlayMode | string;
  currentTime: number;
  volume: number;
  [key: string]: any;
}

export interface SanitizeTrackOptions<T = any> {
  fallbackUrl?: (id: string | number, track: T) => string;
}

export interface StorageAdapterOptions<T = any> {
  prefix?: string;
  sanitizeBlobUrls?: boolean;
  fallbackUrl?: (id: string | number, track: T) => string;
}

const DEFAULT_PREFIX = 'pwa_player_';

/**
 * Cleanse transient and session-only URLs (such as blob: URLs which become invalid upon page refresh)
 */
export function sanitizeTrackForStorage<T extends Record<string, any> = Track>(
  track: T,
  options?: SanitizeTrackOptions<T>
): T {
  if (!track) return track;
  const src = track.src || track.url || '';
  if (typeof src === 'string' && src.startsWith('blob:')) {
    const copy = { ...track };
    const hasUrlProp = 'url' in track;
    const fallback =
      options?.fallbackUrl && track.id !== undefined && track.id !== ''
        ? options.fallbackUrl(track.id, track)
        : hasUrlProp
        ? ''
        : undefined;
    if (fallback !== undefined) {
      if (hasUrlProp) (copy as any).url = fallback;
      if ('src' in track) (copy as any).src = fallback;
    } else {
      delete (copy as any).src;
      delete (copy as any).url;
    }
    return copy;
  }
  return track;
}

/**
 * Universal safe persistent storage adapter for audio player state
 */
export class PlayerStorageAdapter<T extends Record<string, any> = Track> {
  private prefix: string;
  private sanitizeBlob: boolean;
  private fallbackUrl?: (id: string | number, track: T) => string;

  constructor(options: StorageAdapterOptions<T> = {}) {
    this.prefix = options.prefix ?? DEFAULT_PREFIX;
    this.sanitizeBlob = options.sanitizeBlobUrls ?? true;
    this.fallbackUrl = options.fallbackUrl;
  }

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  public save(state: Partial<PlayerPersistedState<T>>): void {
    if (!this.isAvailable()) return;

    try {
      if (state.queue !== undefined) {
        const cleanQueue = this.sanitizeBlob
          ? state.queue.map((t) => sanitizeTrackForStorage(t, { fallbackUrl: this.fallbackUrl }))
          : state.queue;
        localStorage.setItem(`${this.prefix}queue`, JSON.stringify(cleanQueue));
      }

      if (state.queueIndex !== undefined) {
        localStorage.setItem(`${this.prefix}index`, String(state.queueIndex));
      }

      if (state.playMode !== undefined) {
        localStorage.setItem(`${this.prefix}mode`, state.playMode);
      }

      if (state.currentTime !== undefined && state.currentTime > 0) {
        localStorage.setItem(`${this.prefix}time`, String(state.currentTime));
      }

      if (state.volume !== undefined) {
        localStorage.setItem(`${this.prefix}volume`, String(state.volume));
      }

      // Any additional custom metadata
      for (const [key, val] of Object.entries(state)) {
        if (!['queue', 'queueIndex', 'playMode', 'currentTime', 'volume'].includes(key)) {
          if (val === undefined || val === null) {
            localStorage.removeItem(`${this.prefix}${key}`);
          } else if (typeof val === 'object') {
            localStorage.setItem(`${this.prefix}${key}`, JSON.stringify(val));
          } else {
            localStorage.setItem(`${this.prefix}${key}`, String(val));
          }
        }
      }
    } catch (e) {
      console.warn('[PlayerStorageAdapter] Save failed:', e);
    }
  }

  public load(): Partial<PlayerPersistedState<T>> {
    if (!this.isAvailable()) return {};

    const result: Partial<PlayerPersistedState<T>> = {};

    try {
      const qStr = localStorage.getItem(`${this.prefix}queue`);
      const idxStr = localStorage.getItem(`${this.prefix}index`);
      const modeStr = localStorage.getItem(`${this.prefix}mode`);
      const timeStr = localStorage.getItem(`${this.prefix}time`);
      const volStr = localStorage.getItem(`${this.prefix}volume`);

      if (qStr) {
        const parsed = JSON.parse(qStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          result.queue = this.sanitizeBlob
            ? parsed.map((t: T) => sanitizeTrackForStorage(t, { fallbackUrl: this.fallbackUrl }))
            : parsed;
          let idx = parseInt(idxStr || '0', 10);
          if (isNaN(idx) || idx < 0 || idx >= parsed.length) idx = 0;
          result.queueIndex = idx;
        }
      }

      if (modeStr) {
        result.playMode = modeStr as PlayMode;
      }

      if (timeStr) {
        const t = parseFloat(timeStr);
        if (!isNaN(t) && t > 0) result.currentTime = t;
      }

      if (volStr) {
        const v = parseFloat(volStr);
        if (!isNaN(v) && v >= 0 && v <= 1) result.volume = v;
      }

      // Load additional custom keys prefixed with this.prefix
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          const subKey = k.slice(this.prefix.length);
          if (!['queue', 'index', 'mode', 'time', 'volume'].includes(subKey)) {
            const raw = localStorage.getItem(k);
            if (raw !== null) {
              try {
                result[subKey] = JSON.parse(raw);
              } catch {
                result[subKey] = raw;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[PlayerStorageAdapter] Load failed:', e);
    }

    return result;
  }

  public clear(): void {
    if (!this.isAvailable()) return;

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {}
  }
}
