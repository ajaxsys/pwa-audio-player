export const MIN_VALID_AUDIO_BYTES = 200 * 1024;
export const MIN_FULL_TRACK_BYTES = 1_250_000;
export const MIN_CACHED_BLOB_BYTES = 250_000;

export interface NextTrackPrecacheOptions {
  cacheName?: string;
  eventName?: string;
  minValidBytes?: number;
  minFullTrackBytes?: number;
  minCachedBlobBytes?: number;
  skipTrial?: boolean;
  isLocalUrl?: (url: string) => boolean;
  buildProxyUrl?: (rawUrl: string) => string | null | undefined;
  cacheKeyForTrack?: (track: Record<string, any>, sourceUrl: string) => string;
}

interface PreloadedBlobEntry {
  key: string;
  sourceUrl: string;
  canonicalKey: string;
  blobUrl: string;
}

function getSourceUrl(track: Record<string, any> | null | undefined): string {
  if (!track) return '';
  return String(track.url || track.src || '');
}

function defaultIsLocalUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes('/stream/online')) return false;
  return (
    url.startsWith('blob:') ||
    url.startsWith('/v3/stream') ||
    url.startsWith('/v3/history/stream') ||
    url.startsWith('/stream')
  );
}

function isBlobUrlStillBoundToAudio(blobUrl: string): boolean {
  if (!blobUrl || typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') {
    return false;
  }
  try {
    const audios = document.querySelectorAll('audio');
    for (const a of audios) {
      if (a.src === blobUrl || a.currentSrc === blobUrl) return true;
    }
  } catch {}
  return false;
}

function revokeBlobUrlSafely(blobUrl: string | null | undefined): void {
  if (!blobUrl) return;
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {}
  }
}

export function getTrackPreloadKey(track: Record<string, any> | null | undefined): string {
  if (!track) return '';
  if (track.id !== undefined && track.id !== null && track.id !== '') {
    return `id:${String(track.id)}`;
  }
  if (track.filePath) {
    return `path:${String(track.filePath)}`;
  }
  const title = track.title || track.name || '';
  return `meta:${title}-${track.artist || ''}`;
}

/**
 * Downloads, validates by byte threshold, caches into CacheStorage, and stages
 * an in-memory blob: URL for the upcoming track with two-slot active audio protection.
 */
export class NextTrackPrecacheController {
  private defaults: Required<
    Pick<
      NextTrackPrecacheOptions,
      'cacheName' | 'eventName' | 'minValidBytes' | 'minFullTrackBytes' | 'minCachedBlobBytes' | 'skipTrial'
    >
  > &
    Omit<
      NextTrackPrecacheOptions,
      'cacheName' | 'eventName' | 'minValidBytes' | 'minFullTrackBytes' | 'minCachedBlobBytes' | 'skipTrial'
    >;
  private preloadedBlobEntry: PreloadedBlobEntry | null = null;
  private retiredPlayingBlobUrl: string | null = null;
  private abortController: AbortController | null = null;

  constructor(options: NextTrackPrecacheOptions = {}) {
    this.defaults = {
      cacheName: options.cacheName ?? 'pwa-audio-cache-v1',
      eventName: options.eventName ?? 'pwa-audio-player:cache-updated',
      minValidBytes: options.minValidBytes ?? MIN_VALID_AUDIO_BYTES,
      minFullTrackBytes: options.minFullTrackBytes ?? MIN_FULL_TRACK_BYTES,
      minCachedBlobBytes: options.minCachedBlobBytes ?? MIN_CACHED_BLOB_BYTES,
      skipTrial: options.skipTrial ?? false,
      isLocalUrl: options.isLocalUrl ?? defaultIsLocalUrl,
      buildProxyUrl: options.buildProxyUrl,
      cacheKeyForTrack: options.cacheKeyForTrack
    };
  }

  private resolveOptions(overrides?: NextTrackPrecacheOptions) {
    return {
      ...this.defaults,
      ...overrides
    };
  }

  private resolveCacheKey(
    track: Record<string, any>,
    sourceUrl: string,
    opts: ReturnType<NextTrackPrecacheController['resolveOptions']>
  ): string {
    if (opts.cacheKeyForTrack) return opts.cacheKeyForTrack(track, sourceUrl);
    return sourceUrl || (track.id != null && track.id !== '' ? `/stream?id=${String(track.id)}` : '');
  }

  private stageEntry(key: string, sourceUrl: string, canonicalKey: string, blob: Blob): boolean {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
    const newBlobUrl = URL.createObjectURL(blob);
    const oldEntry = this.preloadedBlobEntry;
    if (oldEntry && oldEntry.blobUrl !== newBlobUrl) {
      if (isBlobUrlStillBoundToAudio(oldEntry.blobUrl)) {
        if (
          this.retiredPlayingBlobUrl &&
          this.retiredPlayingBlobUrl !== oldEntry.blobUrl &&
          !isBlobUrlStillBoundToAudio(this.retiredPlayingBlobUrl)
        ) {
          revokeBlobUrlSafely(this.retiredPlayingBlobUrl);
        }
        this.retiredPlayingBlobUrl = oldEntry.blobUrl;
      } else {
        revokeBlobUrlSafely(oldEntry.blobUrl);
      }
    }
    this.preloadedBlobEntry = { key, sourceUrl, canonicalKey, blobUrl: newBlobUrl };
    return true;
  }

  public getPreloadedBlobUrl(track: Record<string, any> | null | undefined): string | null {
    if (!track || !this.preloadedBlobEntry) return null;
    if (this.preloadedBlobEntry.key !== getTrackPreloadKey(track)) return null;
    const currentUrl = getSourceUrl(track);
    if (
      currentUrl &&
      this.preloadedBlobEntry.sourceUrl !== currentUrl &&
      this.preloadedBlobEntry.canonicalKey !== currentUrl
    ) {
      return null;
    }
    return this.preloadedBlobEntry.blobUrl;
  }

  public isPreloadedBlobUrlForTrack(audioSrc: string, track: Record<string, any> | null | undefined): boolean {
    if (!audioSrc || !audioSrc.startsWith('blob:') || !this.preloadedBlobEntry) return false;
    return this.preloadedBlobEntry.blobUrl === audioSrc && this.preloadedBlobEntry.key === getTrackPreloadKey(track);
  }

  public clear(): void {
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }
    if (this.preloadedBlobEntry) {
      revokeBlobUrlSafely(this.preloadedBlobEntry.blobUrl);
      this.preloadedBlobEntry = null;
    }
    if (this.retiredPlayingBlobUrl) {
      revokeBlobUrlSafely(this.retiredPlayingBlobUrl);
      this.retiredPlayingBlobUrl = null;
    }
  }

  private async tryStageFromCache(
    candidate: Record<string, any>,
    key: string,
    targetUrl: string,
    cacheKey: string,
    opts: ReturnType<NextTrackPrecacheController['resolveOptions']>
  ): Promise<boolean> {
    try {
      const cache = await caches.open(opts.cacheName);
      const match =
        (cacheKey ? await cache.match(cacheKey) : undefined) ||
        (cacheKey !== targetUrl ? await cache.match(targetUrl) : undefined);
      if (!match) return false;
      const blob = await match.blob();
      if (blob && blob.size >= opts.minCachedBlobBytes) {
        return this.stageEntry(key, targetUrl, cacheKey, blob);
      }
    } catch {}
    return false;
  }

  public async precacheCandidateAudio(
    candidate: Record<string, any> | null | undefined,
    onInvalidOrFailed: (reason: 'trial' | 'unplayable') => void,
    options?: NextTrackPrecacheOptions
  ): Promise<boolean> {
    const targetUrl = getSourceUrl(candidate);
    if (!candidate || !targetUrl) return false;

    const hasCaches =
      (typeof window !== 'undefined' && 'caches' in window) ||
      (typeof globalThis !== 'undefined' && 'caches' in globalThis);
    if (!hasCaches || typeof fetch !== 'function') {
      return true;
    }
    if (targetUrl.startsWith('blob:')) return true;
    if (this.getPreloadedBlobUrl(candidate)) return true;

    const opts = this.resolveOptions(options);
    const key = getTrackPreloadKey(candidate);
    const cacheKey = this.resolveCacheKey(candidate, targetUrl, opts);
    const isLocal = Boolean(candidate.isLocal || opts.isLocalUrl?.(targetUrl));

    if (await this.tryStageFromCache(candidate, key, targetUrl, cacheKey, opts)) {
      return true;
    }

    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
    }
    const controller = new AbortController();
    this.abortController = controller;

    try {
      let resp: Response;
      try {
        resp = await fetch(targetUrl, { signal: controller.signal });
        if (!resp.ok && !isLocal) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } catch (directErr: any) {
        if (directErr?.name === 'AbortError' || controller.signal.aborted) return false;
        const proxyUrl = !isLocal ? opts.buildProxyUrl?.(targetUrl) : null;
        if (!proxyUrl) {
          if (!isLocal) {
            candidate.unplayable = true;
            onInvalidOrFailed('unplayable');
          }
          return false;
        }
        resp = await fetch(proxyUrl, { signal: controller.signal });
      }

      if (controller.signal.aborted) return false;
      if (!resp.ok) {
        candidate.unplayable = true;
        onInvalidOrFailed('unplayable');
        return false;
      }

      const blob = await resp.blob();
      if (controller.signal.aborted) return false;

      if (blob.size === 0 || (!isLocal && blob.size < opts.minValidBytes)) {
        candidate.unplayable = true;
        onInvalidOrFailed('unplayable');
        return false;
      }

      if (!isLocal && opts.skipTrial && !candidate.allowTrial && blob.size < opts.minFullTrackBytes) {
        candidate.freeTrial = true;
        onInvalidOrFailed('trial');
        return false;
      }

      try {
        const cache = await caches.open(opts.cacheName);
        const headers = typeof Headers !== 'undefined' ? new Headers(resp.headers || undefined) : undefined;
        if (headers && !headers.get('Content-Type')) {
          headers.set('Content-Type', blob.type || 'audio/mpeg');
        }
        await cache.put(cacheKey, new Response(blob, { status: 200, ...(headers ? { headers } : {}) }));
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && candidate.id != null) {
          window.dispatchEvent(new CustomEvent(opts.eventName, { detail: { id: String(candidate.id) } }));
        }
      } catch {}

      this.stageEntry(key, targetUrl, cacheKey, blob);
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return false;
      if (!isLocal) {
        candidate.unplayable = true;
        onInvalidOrFailed('unplayable');
      }
      return false;
    } finally {
      if (this.abortController === controller) {
        this.abortController = null;
      }
    }
  }
}

export const nextTrackPrecacheController = new NextTrackPrecacheController();

export function getPreloadedTrackBlobUrl(track: Record<string, any> | null | undefined): string | null {
  return nextTrackPrecacheController.getPreloadedBlobUrl(track);
}

export function isPreloadedBlobUrlForTrack(
  audioSrc: string,
  track: Record<string, any> | null | undefined
): boolean {
  return nextTrackPrecacheController.isPreloadedBlobUrlForTrack(audioSrc, track);
}

export function clearPreloadedTrackBlob(): void {
  nextTrackPrecacheController.clear();
}

export function precacheCandidateAudio(
  candidate: Record<string, any> | null | undefined,
  onInvalidOrFailed: (reason: 'trial' | 'unplayable') => void,
  options?: NextTrackPrecacheOptions
): Promise<boolean> {
  return nextTrackPrecacheController.precacheCandidateAudio(candidate, onInvalidOrFailed, options);
}
