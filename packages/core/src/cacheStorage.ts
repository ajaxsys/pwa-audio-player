/**
 * 💾 PWA CacheStorage Offline Audio Stream Manager
 *
 * Provides complete offline audio caching, storage scanning,
 * play count tracking and metadata persistence.
 */

export interface AudioCacheItem {
  key: string;
  id: string | null;
  urls: string[];
  relUrl?: string;
  name: string;
  artist: string;
  cover?: string;
  size: number;
  time: number;
  playCount: number;
  [key: string]: any;
}

export interface AudioCacheOptions {
  cacheName?: string;
  metaStorageKey?: string;
  playCountsStorageKey?: string;
  isAudioUrl?: (url: string) => boolean;
}

const DEFAULT_CACHE_NAME = 'pwa-audio-cache-v1';
const DEFAULT_META_KEY = 'pwa_cached_audio_meta_v1';
const DEFAULT_PLAY_COUNTS_KEY = 'pwa_audio_play_counts_v1';

export class AudioCacheStorage {
  private cacheName: string;
  private metaKey: string;
  private playCountsKey: string;
  private isAudioUrlChecker: (url: string) => boolean;

  constructor(options: AudioCacheOptions = {}) {
    this.cacheName = options.cacheName ?? DEFAULT_CACHE_NAME;
    this.metaKey = options.metaStorageKey ?? DEFAULT_META_KEY;
    this.playCountsKey = options.playCountsStorageKey ?? DEFAULT_PLAY_COUNTS_KEY;
    this.isAudioUrlChecker =
      options.isAudioUrl ??
      ((url: string) =>
        Boolean(
          url.includes('/stream') ||
            url.match(/\.(mp3|flac|wav|m4a|aac|ogg|webm)(\?.*)?$/i)
        ));
  }

  public isStorageAvailable(): boolean {
    return typeof localStorage !== 'undefined';
  }

  public isCacheApiAvailable(): boolean {
    return typeof window !== 'undefined' && typeof caches !== 'undefined';
  }

  public isAvailable(): boolean {
    return this.isStorageAvailable() && this.isCacheApiAvailable();
  }

  /**
   * Get play count for a track ID or key
   */
  public getPlayCount(idOrKey: string | number): number {
    if (!idOrKey || typeof localStorage === 'undefined') return 0;
    try {
      const counts = JSON.parse(localStorage.getItem(this.playCountsKey) || '{}');
      return counts[String(idOrKey)] || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Record and increment play count for a track ID or key
   */
  public recordPlayCount(idOrKey: string | number): number {
    if (!idOrKey || typeof localStorage === 'undefined') return 0;
    const key = String(idOrKey);
    try {
      const counts = JSON.parse(localStorage.getItem(this.playCountsKey) || '{}');
      counts[key] = (counts[key] || 0) + 1;
      localStorage.setItem(this.playCountsKey, JSON.stringify(counts));

      // Synchronize play count into metadata
      const metaMap = this.readMeta();
      let metaChanged = false;
      for (const url of Object.keys(metaMap)) {
        const item = metaMap[url];
        if (item?.id === key || url.includes(`id=${key}`) || url === key) {
          item.playCount = counts[key];
          metaChanged = true;
        }
      }
      if (metaChanged) {
        this.writeMeta(metaMap);
      }

      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(
            new CustomEvent('pwa-player:song-play-updated', {
              detail: { id: key, playCount: counts[key] }
            })
          );
        } catch {}
      }
      return counts[key];
    } catch {
      return 0;
    }
  }

  /**
   * Read all cached track metadata from localStorage
   */
  public readMeta(): Record<string, any> {
    if (typeof localStorage === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(this.metaKey) || '{}');
    } catch {
      return {};
    }
  }

  /**
   * Write track metadata to localStorage
   */
  public writeMeta(meta: Record<string, any>): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.metaKey, JSON.stringify(meta));
    } catch {}
  }

  /**
   * Load set of all cached song IDs from metadata
   */
  public getCachedIds(): Set<number | string> {
    const metaMap = this.readMeta();
    const set = new Set<number | string>();
    for (const key of Object.keys(metaMap)) {
      const item = metaMap[key];
      if (item?.id !== undefined && item?.id !== null && item?.id !== '') {
        set.add(item.id);
      }
      const match = key.match(/[?&]id=(\d+)/);
      if (match && match[1]) {
        set.add(Number(match[1]));
      }
    }
    return set;
  }

  /**
   * Check whether a song ID or URL is cached in CacheStorage
   */
  public async isCached(idOrUrl: string | number): Promise<boolean> {
    if (!idOrUrl) return false;
    const str = String(idOrUrl);

    if (this.isStorageAvailable()) {
      const metaMap = this.readMeta();
      for (const k of Object.keys(metaMap)) {
        if (k === str || metaMap[k]?.id === str || k.includes(`id=${str}`)) {
          return true;
        }
      }
    }

    if (this.isCacheApiAvailable()) {
      try {
        const cache = await caches.open(this.cacheName);
        const match = await cache.match(str);
        return Boolean(match);
      } catch {}
    }

    return false;
  }

  /**
   * Fetch and cache an audio track stream with its metadata
   */
  public async cacheTrack(
    url: string,
    meta: {
      id?: string | number;
      name?: string;
      artist?: string;
      cover?: string;
      [key: string]: any;
    } = {}
  ): Promise<boolean> {
    if (!this.isAvailable() || !url) return false;

    try {
      const res = await fetch(url);
      if (!res.ok) return false;

      const cache = await caches.open(this.cacheName);
      await cache.put(url, res.clone());

      const metaMap = this.readMeta();
      metaMap[url] = {
        ...meta,
        time: Date.now(),
        playCount: meta.id ? this.getPlayCount(meta.id) : 0
      };
      this.writeMeta(metaMap);

      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(
            new CustomEvent('pwa-player:browser-cache-updated', {
              detail: { id: meta.id, url }
            })
          );
        } catch {}
      }
      return true;
    } catch (e) {
      console.warn('[AudioCacheStorage] Cache track failed:', e);
      return false;
    }
  }

  /**
   * Scan CacheStorage for all cached audio files with metadata and composite sorting
   */
  public async scan(options: {
    sortBy?: 'playCount' | 'time' | 'size';
    sortOrder?: 'desc' | 'asc';
  } = {}): Promise<{ list: AudioCacheItem[]; totalBytes: number }> {
    if (!this.isAvailable()) {
      return { list: [], totalBytes: 0 };
    }

    const sortBy = options.sortBy ?? 'playCount';
    const sortOrder = options.sortOrder ?? 'desc';
    const metaMap = this.readMeta();
    const byKey = new Map<string, AudioCacheItem>();

    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name !== this.cacheName && !name.includes('audio')) continue;
        const cache = await caches.open(name);
        const requests = await cache.keys();

        for (const req of requests) {
          const url = req.url;
          if (!this.isAudioUrlChecker(url)) continue;

          let relUrl = url;
          try {
            const u = new URL(url);
            relUrl = u.pathname + u.search;
          } catch {}

          const meta = metaMap[url] || metaMap[relUrl] || {};
          const id = meta.id ? String(meta.id) : this.extractIdFromUrl(url);
          const key = id ? `id:${id}` : relUrl;

          let size = 0;
          try {
            const match = await cache.match(req);
            if (match) {
              const blob = await match.blob();
              size = blob.size;
            }
          } catch {}

          const existing = byKey.get(key);
          if (existing) {
            if (!existing.urls.includes(url)) existing.urls.push(url);
            existing.size = Math.max(existing.size, size);
          } else {
            byKey.set(key, {
              key,
              id,
              urls: [url],
              relUrl,
              name: meta.name || (id ? `Track #${id}` : 'Audio Track'),
              artist: meta.artist || 'Unknown Artist',
              cover: meta.cover,
              size,
              time: meta.time || 0,
              playCount: meta.playCount || (id ? this.getPlayCount(id) : 0)
            });
          }
        }
      }

      const list = Array.from(byKey.values());
      const totalBytes = list.reduce((sum, item) => sum + item.size, 0);

      list.sort((a, b) => {
        let diff = 0;
        if (sortBy === 'playCount') {
          diff = b.playCount - a.playCount;
          if (diff === 0) diff = b.time - a.time;
        } else if (sortBy === 'time') {
          diff = b.time - a.time;
        } else if (sortBy === 'size') {
          diff = b.size - a.size;
        }
        return sortOrder === 'desc' ? diff : -diff;
      });

      return { list, totalBytes };
    } catch (e) {
      console.warn('[AudioCacheStorage] Scan cache failed:', e);
      return { list: [], totalBytes: 0 };
    }
  }

  /**
   * Delete one or multiple cached audio items by URL or Key
   */
  public async delete(urlsOrKeys: string | string[]): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const targets = Array.isArray(urlsOrKeys) ? urlsOrKeys : [urlsOrKeys];
    if (!targets.length) return false;

    try {
      const cacheNames = await caches.keys();
      const metaMap = this.readMeta();

      for (const name of cacheNames) {
        if (name !== this.cacheName && !name.includes('audio')) continue;
        const cache = await caches.open(name);
        const requests = await cache.keys();

        for (const req of requests) {
          const url = req.url;
          const matchTarget = targets.some(
            (t) => t === url || url.includes(t) || (t.startsWith('id:') && url.includes(`id=${t.slice(3)}`))
          );
          if (matchTarget) {
            await cache.delete(req);
            delete metaMap[url];
            try {
              const u = new URL(url);
              delete metaMap[u.pathname + u.search];
            } catch {}
          }
        }
      }

      this.writeMeta(metaMap);
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('pwa-player:browser-cache-updated'));
        } catch {}
      }
      return true;
    } catch (e) {
      console.warn('[AudioCacheStorage] Delete cache failed:', e);
      return false;
    }
  }

  /**
   * Delete all cached items in the audio cache
   */
  public async clear(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await caches.delete(this.cacheName);
      this.writeMeta({});
      return true;
    } catch {
      return false;
    }
  }

  private extractIdFromUrl(url: string): string | null {
    const match = url.match(/[?&]id=(\d+)/);
    return match ? match[1] : null;
  }
}
