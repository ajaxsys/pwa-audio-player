import type {
  Track,
  PlaybackState,
  PlayMode,
  PwaPlayerOptions,
  PwaPlayerState,
  PlayerListener,
  LyricLine
} from './types';
import { SilentHoldKeeper } from './keepAlive';
import { MediaSessionController } from './mediaSession';
import { PlaylistManager } from './playlist';
import { GestureGuardian } from './gesture';
import { parseLrc, getActiveLyric } from './lyric';

export class PwaPlayer {
  private audioEl: HTMLAudioElement;
  private playlist: PlaylistManager;
  private keepAlive: SilentHoldKeeper;
  private mediaSession: MediaSessionController;
  private gesture: GestureGuardian;

  private isPlaying = false;
  private currentTime = 0;
  private duration = 0;
  private volume = 1.0;
  private listeners = new Set<PlayerListener>();

  private parsedLyrics: LyricLine[] = [];
  private activeLyricIndex = -2;
  private activeLyricText = '';
  private enableLockscreenLyrics: boolean;
  private preloadAdjacent: boolean;
  private cachedState: PwaPlayerState | null = null;

  constructor(options: PwaPlayerOptions = {}) {
    // 1. Audio element initialization
    if (options.audioElement) {
      this.audioEl = options.audioElement;
    } else if (typeof document !== 'undefined') {
      this.audioEl = document.createElement('audio');
      this.audioEl.setAttribute('playsinline', 'true');
      this.audioEl.preload = 'auto';
    } else {
      this.audioEl = {} as HTMLAudioElement;
    }

    this.enableLockscreenLyrics = options.enableLockscreenLyrics ?? true;
    this.preloadAdjacent = options.preloadAdjacent ?? true;

    // 2. Subsystem instances
    this.playlist = new PlaylistManager(
      options.initialQueue ?? [],
      options.initialIndex ?? 0,
      options.initialMode ?? 'sequence'
    );

    this.gesture = new GestureGuardian();

    this.keepAlive = new SilentHoldKeeper(
      this.audioEl,
      options.keepAlive,
      {
        onKeepAliveEnter: () => {
          const track = this.playlist.getCurrentTrack();
          this.mediaSession.applyTripleInvisibleLock(
            track,
            this.duration,
            this.keepAlive.getSavedPauseTime()
          );
          this.notify();
        },
        onKeepAliveExit: () => {
          this.mediaSession.updatePlaybackState('playing');
          const track = this.playlist.getCurrentTrack();
          this.mediaSession.updateMetadata(track);
          this.notify();
        },
        onHardPauseTimeout: () => {
          this.isPlaying = false;
          this.mediaSession.updatePlaybackState('paused');
          this.notify();
        }
      }
    );

    this.mediaSession = new MediaSessionController(
      {
        onPlay: () => this.handleMediaSessionPlay(),
        onPause: () => this.pause(),
        onPrev: () => this.prev(),
        onNext: () => this.next()
      },
      options.enforceTrackNavigation ?? true
    );

    // 3. Register browser & DOM events
    this.bindAudioEvents();
    this.mediaSession.registerHandlers();

    // 4. Load initial track if provided
    const initialTrack = this.playlist.getCurrentTrack();
    if (initialTrack) {
      this.prepareTrack(initialTrack, false);
    }
  }

  // ================= Public Playback Controls =================

  public async play(): Promise<void> {
    if (this.keepAlive.isHolding()) {
      this.keepAlive.handleResume(() => {
        this.isPlaying = true;
        this.warmupAdjacent();
        this.notify();
      });
      return;
    }

    const currentTrack = this.playlist.getCurrentTrack();
    if (!currentTrack) return;

    if (!this.audioEl.src || this.audioEl.src === window.location.href || this.audioEl.src.startsWith('blob:')) {
      this.prepareTrack(currentTrack, true);
      return;
    }

    try {
      await this.audioEl.play();
      this.isPlaying = true;
      this.warmupAdjacent();
      this.notify();
    } catch (err) {
      console.warn('[PwaPlayer] play() rejected:', err);
      this.isPlaying = false;
      this.notify();
    }
  }

  public pause(): void {
    if (!this.audioEl) return;
    this.currentTime = this.audioEl.currentTime || this.currentTime;

    // Delegate to silent-hold keeper if iOS background keep-alive is active
    const handledByKeepAlive = this.keepAlive.handlePause(
      this.playlist.getCurrentTrack(),
      this.currentTime,
      this.duration,
      this.audioEl.src
    );

    if (handledByKeepAlive) {
      this.isPlaying = false;
      this.notify();
      return;
    }

    try {
      this.audioEl.pause();
    } catch {}
    this.isPlaying = false;
    this.mediaSession.updatePlaybackState('paused');
    this.notify();
  }

  public toggle(): void {
    if (this.keepAlive.isHolding()) {
      this.play();
      return;
    }

    if (this.isPlaying || (!this.audioEl.paused && this.audioEl.currentTime > 0)) {
      this.pause();
    } else {
      this.play();
    }
  }

  public async next(): Promise<void> {
    this.keepAlive.reset();
    this.mediaSession.clearPosition();

    const track = this.playlist.stepNext();
    if (!track) {
      this.pause();
      return;
    }

    this.prepareTrack(track, true);
  }

  public async prev(): Promise<void> {
    this.keepAlive.reset();
    this.mediaSession.clearPosition();

    const track = this.playlist.stepPrev();
    if (!track) {
      this.pause();
      return;
    }

    this.prepareTrack(track, true);
  }

  public seek(seconds: number): void {
    const target = Math.max(0, this.duration > 0 ? Math.min(seconds, this.duration) : seconds);
    this.currentTime = target;

    if (this.keepAlive.isHolding()) {
      this.keepAlive.updateSavedPauseTime(target);
      this.mediaSession.applyTripleInvisibleLock(this.playlist.getCurrentTrack(), this.duration, target);
      this.notify();
      return;
    }

    try {
      this.audioEl.currentTime = target;
    } catch {}
    this.mediaSession.updatePosition(target, this.duration);
    this.notify();
  }

  public setQueue(tracks: Track[], startIndex = 0, autoPlay = true): void {
    this.keepAlive.reset();
    this.mediaSession.clearPosition();
    this.playlist.setQueue(tracks, startIndex);

    const track = this.playlist.getCurrentTrack();
    if (track) {
      this.prepareTrack(track, autoPlay);
    } else {
      this.resetSource();
    }
  }

  public playTrackByIndex(index: number): void {
    if (this.playlist.setIndex(index)) {
      this.keepAlive.reset();
      this.mediaSession.clearPosition();
      const track = this.playlist.getCurrentTrack();
      if (track) {
        this.prepareTrack(track, true);
      }
    }
  }

  public setPlayMode(mode: PlayMode): void {
    this.playlist.setPlayMode(mode);
    this.warmupAdjacent();
    this.notify();
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.audioEl) {
      try {
        this.audioEl.volume = this.volume;
      } catch {}
    }
    this.notify();
  }

  // ================= State & Subscription =================

  public getState(): PwaPlayerState {
    if (!this.cachedState) {
      this.rebuildCachedState();
    }
    return this.cachedState!;
  }

  private rebuildCachedState(): void {
    const isHold = this.keepAlive.isHolding();
    this.cachedState = {
      currentTrack: this.playlist.getCurrentTrack(),
      playbackState: this.getPlaybackState(),
      isPlaying: this.isPlaying,
      isHolding: isHold,
      isF3Holding: isHold,
      currentTime: this.currentTime,
      duration: this.duration,
      queue: this.playlist.getQueue(),
      queueIndex: this.playlist.getCurrentIndex(),
      playMode: this.playlist.getPlayMode(),
      volume: this.volume,
      activeLyricIndex: this.activeLyricIndex,
      activeLyricText: this.activeLyricText
    };
  }

  public subscribe(listener: PlayerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public destroy(): void {
    this.keepAlive.reset();
    this.gesture.clear();
    this.listeners.clear();
    try {
      this.audioEl.pause();
      this.audioEl.src = '';
    } catch {}
  }

  // ================= Internal Mechanics =================

  private getPlaybackState(): PlaybackState {
    if (this.keepAlive.isHolding()) return 'holding';
    if (this.isPlaying) return 'playing';
    return this.currentTime > 0 ? 'paused' : 'idle';
  }

  private notify(): void {
    this.rebuildCachedState();
    const state = this.cachedState!;
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[PwaPlayer] Listener error:', e);
      }
    }
  }

  private prepareTrack(track: Track, autoPlay: boolean): void {
    this.currentTime = 0;
    this.duration = track.duration || 0;
    this.parsedLyrics = parseLrc(track.lrc);
    this.activeLyricIndex = -2;
    this.activeLyricText = '';

    this.mediaSession.updateMetadata(track);
    this.mediaSession.clearPosition();

    if (this.audioEl) {
      this.audioEl.src = track.src;
      try {
        this.audioEl.currentTime = 0;
      } catch {}
    }

    if (autoPlay) {
      this.play();
    } else {
      this.notify();
    }
  }

  private resetSource(): void {
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    try {
      this.audioEl.pause();
      this.audioEl.src = '';
    } catch {}
    this.mediaSession.updateMetadata(null);
    this.notify();
  }

  private warmupAdjacent(): void {
    if (this.preloadAdjacent) {
      this.gesture.preloadSurroundingTracks(
        this.playlist.getQueue(),
        this.playlist.getCurrentIndex()
      );
    }
  }

  private handleMediaSessionPlay(): void {
    if (this.keepAlive.isHolding()) {
      this.toggle();
      return;
    }
    if (this.audioEl.paused) {
      this.play();
    }
  }

  private bindAudioEvents(): void {
    if (!this.audioEl || typeof this.audioEl.addEventListener !== 'function') return;

    this.audioEl.addEventListener('play', () => {
      if (this.keepAlive.isHolding()) return;
      this.isPlaying = true;
      this.mediaSession.registerHandlers();
      this.mediaSession.updatePlaybackState('playing');

      const track = this.playlist.getCurrentTrack();
      if (track) {
        this.mediaSession.updateMetadata(track);
      }
      this.mediaSession.updatePosition(this.currentTime, this.duration);
      this.warmupAdjacent();
      this.notify();
    });

    this.audioEl.addEventListener('pause', () => {
      if (this.keepAlive.isHolding()) return;
      this.isPlaying = false;
      this.mediaSession.updatePlaybackState('paused');
      this.mediaSession.updatePosition(this.currentTime, this.duration);
      this.notify();
    });

    this.audioEl.addEventListener('timeupdate', () => {
      if (this.keepAlive.isHolding()) return;

      this.currentTime = this.audioEl.currentTime;
      if (this.audioEl.duration && !isNaN(this.audioEl.duration) && isFinite(this.audioEl.duration)) {
        this.duration = this.audioEl.duration;
      }

      // Synchronize lockscreen dynamic lyric (diff-throttled)
      if (this.enableLockscreenLyrics && this.parsedLyrics.length > 0) {
        const lyric = getActiveLyric(this.parsedLyrics, this.currentTime);
        if (lyric.index !== this.activeLyricIndex) {
          this.activeLyricIndex = lyric.index;
          this.activeLyricText = lyric.currentLine || '';
          this.mediaSession.updateMetadata(this.playlist.getCurrentTrack(), {
            currentLine: lyric.currentLine,
            nextLine: lyric.nextLine
          });
        }
      }

      this.notify();
    });

    this.audioEl.addEventListener('loadedmetadata', () => {
      if (this.keepAlive.isHolding()) return;
      if (this.audioEl.duration && !isNaN(this.audioEl.duration) && isFinite(this.audioEl.duration)) {
        this.duration = this.audioEl.duration;
      }
      this.mediaSession.updatePosition(this.currentTime, this.duration);
      this.notify();
    });

    this.audioEl.addEventListener('seeked', () => {
      if (this.keepAlive.isHolding()) return;
      this.currentTime = this.audioEl.currentTime;
      this.mediaSession.updatePosition(this.currentTime, this.duration);
      this.notify();
    });

    this.audioEl.addEventListener('ended', () => {
      if (this.keepAlive.isHolding()) return;
      // Seamless chain advance to next track
      this.next();
    });

    this.audioEl.addEventListener('error', () => {
      if (this.keepAlive.isHolding()) return;
      console.warn('[PwaPlayer] Audio element error encountered:', this.audioEl.error);
      this.isPlaying = false;
      this.notify();
    });
  }
}

/**
 * Factory helper for instantiation
 */
export function createPwaPlayer(options?: PwaPlayerOptions): PwaPlayer {
  return new PwaPlayer(options);
}
