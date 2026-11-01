import type { Track, MediaImage } from './types';

export interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export interface LyricUpdateInfo {
  currentLine?: string;
  nextLine?: string;
}

export class MediaSessionController {
  private callbacks: MediaSessionCallbacks;
  private enforceNavigation: boolean;
  private lastSyncedTrackId: string | number | null = null;
  private lastSyncedLyricText: string | null = null;

  constructor(callbacks: MediaSessionCallbacks, enforceNavigation = true) {
    this.callbacks = callbacks;
    this.enforceNavigation = enforceNavigation;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'mediaSession' in navigator;
  }

  public registerHandlers(): void {
    if (!this.isSupported()) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => this.callbacks.onPlay());
      navigator.mediaSession.setActionHandler('pause', () => this.callbacks.onPause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.callbacks.onPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.callbacks.onNext());

      if (this.enforceNavigation) {
        // Clear seek actions to enforce native music navigation layout (⏮ ⏯ ⏭)
        try { navigator.mediaSession.setActionHandler('seekbackward', null); } catch {}
        try { navigator.mediaSession.setActionHandler('seekforward', null); } catch {}
        try { navigator.mediaSession.setActionHandler('seekto', null); } catch {}
      }
    } catch (e) {
      console.warn('[PwaPlayer:MediaSession] Failed to register action handlers:', e);
    }
  }

  public updatePlaybackState(state: 'playing' | 'paused' | 'none'): void {
    if (!this.isSupported()) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch {}
  }

  public updateMetadata(track: Track | null, lyricInfo?: LyricUpdateInfo): void {
    if (!this.isSupported()) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      this.lastSyncedTrackId = null;
      this.lastSyncedLyricText = null;
      return;
    }

    const currentLine = lyricInfo?.currentLine?.trim();
    const nextLine = lyricInfo?.nextLine?.trim();

    // Lockscreen lyric display layout:
    // Title (Center large): Current Lyric or Song Name
    // Artist (Subtitle): Song · Artist
    // Album (3rd line): Next lyric preview or Album Name
    const title = currentLine || track.title;
    const artist = currentLine
      ? `${track.title}${track.artist ? ` · ${track.artist}` : ''}`
      : (track.artist || 'Unknown Artist');
    const album = nextLine ? `⏭ ${nextLine}` : (track.album || track.title);

    // Incremental diff optimization: Avoid redundant cross-process IPC calls
    if (
      navigator.mediaSession.metadata &&
      this.lastSyncedTrackId === track.id &&
      this.lastSyncedLyricText === currentLine
    ) {
      return;
    }

    this.lastSyncedTrackId = track.id;
    this.lastSyncedLyricText = currentLine ?? null;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: this.normalizeArtwork(track.artwork)
      });
    } catch (err) {
      console.warn('[PwaPlayer:MediaSession] Failed to update MediaMetadata:', err);
    }
  }

  public updatePosition(
    position: number,
    duration: number,
    playbackRate = 1.0
  ): void {
    if (!this.isSupported() || !('setPositionState' in navigator.mediaSession)) return;

    if (duration > 0 && isFinite(duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position: Math.min(Math.max(0, position), duration)
        });
      } catch (err) {
        console.warn('[PwaPlayer:MediaSession] setPositionState failed:', err);
      }
    }
  }

  public clearPosition(): void {
    if (!this.isSupported() || !('setPositionState' in navigator.mediaSession)) return;
    try {
      navigator.mediaSession.setPositionState();
    } catch {
      try {
        (navigator.mediaSession.setPositionState as any)(null);
      } catch {}
    }
  }

  /**
   * Apply Triple-Lock UI Masking during silent-hold keep-alive:
   * 1. Mask playbackState as 'paused' so the OS displays ▶️ and stops fake progress calculation
   * 2. Retain current track metadata (title, artist, artwork) so lockscreen card remains intact
   * 3. Freeze setPositionState at exact breakpoint position
   */
  public applyTripleInvisibleLock(track: Track | null, duration: number, position: number): void {
    if (!this.isSupported()) return;

    // 1. Force playbackState to 'paused'
    this.updatePlaybackState('paused');

    // 2. Lock track metadata
    if (track) {
      this.updateMetadata(track);
    }

    // 3. Freeze lockscreen progress indicator at exact breakpoint
    this.updatePosition(position, duration, 1.0);
  }

  private normalizeArtwork(artwork?: string | MediaImage[]): MediaImage[] {
    if (Array.isArray(artwork)) {
      return artwork;
    }
    const defaultUrl = artwork || '';
    if (!defaultUrl) return [];

    let resolvedUrl = defaultUrl;
    try {
      resolvedUrl = new URL(defaultUrl, window.location.href).href;
    } catch {}

    return [
      { src: resolvedUrl, sizes: '96x96' },
      { src: resolvedUrl, sizes: '128x128' },
      { src: resolvedUrl, sizes: '192x192' },
      { src: resolvedUrl, sizes: '256x256' },
      { src: resolvedUrl, sizes: '384x384' },
      { src: resolvedUrl, sizes: '512x512' }
    ];
  }
}
