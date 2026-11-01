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
  currentText?: string;
  nextText?: string;
}

export class MediaSessionController {
  private callbacks: MediaSessionCallbacks;
  private enforceNavigation: boolean;
  private lastSyncedTrackId: string | number | null = null;
  private lastSyncedLyricText: string | null = null;
  private lastSyncedCoverUrl: string | null = null;

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
      this.lastSyncedCoverUrl = null;
      return;
    }

    if (!navigator.mediaSession.metadata) {
      this.lastSyncedTrackId = null;
      this.lastSyncedLyricText = null;
      this.lastSyncedCoverUrl = null;
    }

    const curLine = (lyricInfo?.currentText ?? lyricInfo?.currentLine)?.trim();
    const nxtLine = (lyricInfo?.nextText ?? lyricInfo?.nextLine)?.trim();

    const trackTitle = track.title || (track as any).name || '';
    const trackArtist = track.artist || '';
    const trackAlbum = track.album || '网易云音乐';

    // Lockscreen lyric display layout:
    // Title (Center large): Current Lyric or Song Name
    // Artist (Subtitle): Song · Artist
    // Album (3rd line): Next lyric preview or Album Name
    const title = curLine || trackTitle;
    const artist = curLine
      ? (trackArtist ? `${trackTitle} · ${trackArtist}` : trackTitle)
      : (trackArtist || '未知歌手');
    const album = nxtLine ? `⏭ ${nxtLine}` : (curLine ? trackTitle : trackAlbum);

    const coverUrl = this.getCoverUrl(track.artwork || (track as any).cover);
    const trackId = track.id ?? track.src ?? (track as any).url ?? trackTitle;

    // Incremental diff optimization: Avoid redundant cross-process IPC calls
    if (
      navigator.mediaSession.metadata &&
      this.lastSyncedTrackId === trackId &&
      this.lastSyncedLyricText === curLine &&
      this.lastSyncedCoverUrl === coverUrl
    ) {
      return;
    }

    // In-place mutation if same track ID to avoid interrupting Bluetooth AVRCP / Apple Watch artwork
    if (
      navigator.mediaSession.metadata &&
      this.lastSyncedTrackId === trackId &&
      this.lastSyncedCoverUrl === coverUrl
    ) {
      this.lastSyncedLyricText = curLine ?? null;
      try {
        navigator.mediaSession.metadata.title = title;
        navigator.mediaSession.metadata.artist = artist;
        navigator.mediaSession.metadata.album = album;
        return;
      } catch (err) {
        console.warn('[PwaPlayer:MediaSession] Failed to mutate in-place MediaMetadata:', err);
      }
    }

    this.lastSyncedTrackId = trackId;
    this.lastSyncedLyricText = curLine ?? null;
    this.lastSyncedCoverUrl = coverUrl;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: this.normalizeArtwork(coverUrl)
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

  private getCoverUrl(artwork?: string | MediaImage[]): string {
    if (Array.isArray(artwork)) {
      return artwork[0]?.src || '';
    }
    let url = artwork || '';
    if (!url || url.startsWith('data:image/svg+xml') || url.includes('default-vinyl')) {
      try {
        return new URL('/favicon.png', window.location.href).href;
      } catch {
        return '/favicon.png';
      }
    }
    if (url.startsWith('http://')) {
      url = url.replace(/^http:\/\//, 'https://');
    }
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return url;
    }
  }

  private normalizeArtwork(artwork?: string | MediaImage[]): MediaImage[] {
    if (Array.isArray(artwork)) {
      return artwork;
    }
    const resolvedUrl = this.getCoverUrl(artwork);
    const type = resolvedUrl.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

    return [
      { src: resolvedUrl, sizes: '96x96', type },
      { src: resolvedUrl, sizes: '128x128', type },
      { src: resolvedUrl, sizes: '192x192', type },
      { src: resolvedUrl, sizes: '256x256', type },
      { src: resolvedUrl, sizes: '384x384', type },
      { src: resolvedUrl, sizes: '512x512', type }
    ];
  }
}
