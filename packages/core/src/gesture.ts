import type { Track } from './types';

export class GestureGuardian {
  private preloadedUrls = new Set<string>();

  /**
   * Preload adjacent tracks (both next and previous) concurrently
   * while the current track is actively playing.
   */
  public preloadSurroundingTracks(queue: Track[], currentIndex: number): void {
    if (typeof document === 'undefined' || !queue.length) return;

    const targets: Track[] = [];

    // Next track
    const nextIdx = (currentIndex + 1) % queue.length;
    if (nextIdx !== currentIndex && queue[nextIdx]) {
      targets.push(queue[nextIdx]);
    }

    // Previous track
    const prevIdx = (currentIndex - 1 + queue.length) % queue.length;
    if (prevIdx !== currentIndex && prevIdx !== nextIdx && queue[prevIdx]) {
      targets.push(queue[prevIdx]);
    }

    for (const track of targets) {
      if (!track.src || this.preloadedUrls.has(track.src)) continue;
      this.warmupAudioUrl(track.src);
    }
  }

  private warmupAudioUrl(url: string): void {
    if (!url || url.startsWith('blob:')) return;
    this.preloadedUrls.add(url);

    try {
      // 1. Try link rel="preload"
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'fetch';
      link.href = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);

      // Clean up tag after 30 seconds
      const timer = setTimeout(() => {
        try {
          if (link.parentNode) link.parentNode.removeChild(link);
        } catch {}
      }, 30000);
      if (typeof (timer as any)?.unref === 'function') {
        (timer as any).unref();
      }
    } catch {
      // Fallback: silent pre-fetch
      try {
        fetch(url, { headers: { Range: 'bytes=0-32767' } }).catch(() => {});
      } catch {}
    }
  }

  public clear(): void {
    this.preloadedUrls.clear();
  }
}
