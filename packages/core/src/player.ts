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
import { SleepTimerController } from './sleepTimer';
import {
  InterruptionRecoveryController,
  classifyPlayRejection,
  isTrackUrlExpired,
  markTrackUrlResolved,
  withResolveTimeout
} from './resilience';
import { NextTrackPrecacheController, getTrackPreloadKey } from './precache';

// Active player instances registry for mutual-exclusion audio playback
const activePlayers = new Set<PwaPlayer>();

export class PwaPlayer {
  private audioEl: HTMLAudioElement;
  private playlist: PlaylistManager;
  private keepAlive: SilentHoldKeeper;
  private mediaSession: MediaSessionController;
  private gesture: GestureGuardian;
  private sleepTimer: SleepTimerController;
  private interruption: InterruptionRecoveryController | null;
  private precache: NextTrackPrecacheController | null;

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
  private streamWatchdogMs: number;
  private resolveTrackUrl?: PwaPlayerOptions['resolveTrackUrl'];
  private autoSkipOnError: boolean;
  private cachedState: PwaPlayerState | null = null;

  private playbackSession = 0;
  private consecutiveErrorSkips = 0;
  private retriedTracks = new Set<string>();
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private needsReloadOnForeground = false;
  private pendingSeekAfterReload = 0;
  private destroyed = false;
  private onForegroundResume: (() => void) | null = null;
  private onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.attemptForegroundRecovery();
    }
  };

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
    this.streamWatchdogMs = options.streamWatchdogMs ?? 12000;
    this.resolveTrackUrl = options.resolveTrackUrl;
    this.autoSkipOnError = options.autoSkipOnError ?? true;

    this.interruption =
      options.interruptionRecovery === false
        ? null
        : new InterruptionRecoveryController(
            typeof options.interruptionRecovery === 'object' ? options.interruptionRecovery : undefined
          );
    this.precache =
      options.precacheNext === false
        ? null
        : new NextTrackPrecacheController(
            typeof options.precacheNext === 'object' ? options.precacheNext : undefined
          );

    // 2. Subsystem instances
    this.playlist = new PlaylistManager(
      options.initialQueue ?? [],
      options.initialIndex ?? 0,
      options.initialMode ?? 'sequence'
    );

    this.gesture = new GestureGuardian();
    this.sleepTimer = new SleepTimerController(() => this.pause());

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
    this.bindLifecycleEvents();
    this.mediaSession.registerHandlers();

    // 4. Load initial track if provided
    const initialTrack = this.playlist.getCurrentTrack();
    if (initialTrack) {
      this.prepareTrack(initialTrack, false);
    }

    activePlayers.add(this);
  }

  // ================= Public Playback Controls =================

  public async play(): Promise<void> {
    if (this.destroyed) return;

    // Enforce strict single-audio mutual exclusion across all instances
    for (const other of activePlayers) {
      if (other !== this && other.isPlaying) {
        other.pause();
      }
    }

    this.interruption?.clearIntentionalPause();

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

    const currentSrc = this.audioEl.src;
    const isPreloadedBlob = Boolean(this.precache?.isPreloadedBlobUrlForTrack(currentSrc, currentTrack));
    const isStaleBlob = Boolean(currentSrc?.startsWith('blob:')) && !isPreloadedBlob;
    const isExpired = !isPreloadedBlob && Boolean(this.resolveTrackUrl) && isTrackUrlExpired(currentTrack);

    if (!currentSrc || currentSrc === window.location.href || isStaleBlob || isExpired) {
      this.prepareTrack(currentTrack, true);
      return;
    }

    await this.attemptPlayCurrentAudio(currentTrack, this.playbackSession);
  }

  public pause(): void {
    if (!this.audioEl) return;
    this.currentTime = this.audioEl.currentTime || this.currentTime;
    this.clearWatchdog();
    this.interruption?.cancelRecovery();
    this.needsReloadOnForeground = false;

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

    if (!this.audioEl.paused || this.isPlaying) {
      this.interruption?.markIntentionalPause();
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
    this.consecutiveErrorSkips = 0;
    this.interruption?.cancelRecovery();
    this.interruption?.clearIntentionalPause();
    this.keepAlive.reset();
    this.mediaSession.clearPosition();

    const track = this.playlist.stepNextPlayable();
    if (!track) {
      this.pause();
      return;
    }

    this.prepareTrack(track, true);
  }

  public async prev(): Promise<void> {
    this.consecutiveErrorSkips = 0;
    this.interruption?.cancelRecovery();
    this.interruption?.clearIntentionalPause();
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
    this.consecutiveErrorSkips = 0;
    this.retriedTracks.clear();
    this.interruption?.cancelRecovery();
    this.interruption?.clearIntentionalPause();
    this.precache?.clear();
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
      this.consecutiveErrorSkips = 0;
      this.interruption?.cancelRecovery();
      this.interruption?.clearIntentionalPause();
      this.keepAlive.reset();
      this.mediaSession.clearPosition();
      const track = this.playlist.getCurrentTrack();
      if (track) {
        delete (track as any).unplayable;
        this.retriedTracks.delete(getTrackPreloadKey(track));
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
    const nextPlayable = this.getNextPlayableCandidate();
    const isNextPrecached = Boolean(nextPlayable && this.precache?.getPreloadedBlobUrl(nextPlayable));
    this.cachedState = {
      currentTrack: this.playlist.getCurrentTrack(),
      playbackState: this.getPlaybackState(),
      isPlaying: this.isPlaying,
      isHolding: isHold,
      currentTime: this.currentTime,
      duration: this.duration,
      queue: this.playlist.getQueue(),
      queueIndex: this.playlist.getCurrentIndex(),
      playMode: this.playlist.getPlayMode(),
      volume: this.volume,
      activeLyricIndex: this.activeLyricIndex,
      activeLyricText: this.activeLyricText,
      isInterrupted: this.interruption?.isInterrupted() ?? false,
      isNextPrecached
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
    this.destroyed = true;
    this.playbackSession += 1;
    activePlayers.delete(this);
    this.clearWatchdog();
    this.interruption?.cancelRecovery();
    this.precache?.clear();
    this.sleepTimer.destroy();
    this.keepAlive.reset();
    this.gesture.clear();
    this.listeners.clear();
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function' && this.onForegroundResume) {
      window.removeEventListener('focus', this.onForegroundResume);
    }
    try {
      this.audioEl.pause();
      this.audioEl.src = '';
    } catch {}
  }

  public getSleepTimer(): SleepTimerController {
    return this.sleepTimer;
  }

  // ================= Internal Mechanics =================

  private getPlaybackState(): PlaybackState {
    if (this.keepAlive.isHolding()) return 'holding';
    if (this.isPlaying) return 'playing';
    return this.currentTime > 0 ? 'paused' : 'idle';
  }

  private notify(): void {
    if (this.destroyed) return;
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

  private enforceMutualExclusion(): void {
    for (const other of activePlayers) {
      if (other !== this && other.isPlaying) {
        other.pause();
      }
    }
  }

  private prepareTrack(track: Track, autoPlay: boolean): void {
    if (this.destroyed) return;
    this.clearWatchdog();
    this.interruption?.cancelRecovery();
    this.needsReloadOnForeground = false;
    this.pendingSeekAfterReload = 0;

    const session = ++this.playbackSession;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = track.duration || 0;
    this.parsedLyrics = parseLrc(track.lrc);
    this.activeLyricIndex = -2;
    this.activeLyricText = '';

    this.mediaSession.updateMetadata(track);
    this.mediaSession.clearPosition();

    const preloadedBlobUrl = this.precache?.getPreloadedBlobUrl(track);
    if (!preloadedBlobUrl && this.resolveTrackUrl && isTrackUrlExpired(track)) {
      this.notify();
      void this.refreshExpiredAndPrepare(track, session, autoPlay);
      return;
    }

    const targetUrl = preloadedBlobUrl || track.src;
    if (!targetUrl) {
      if (autoPlay && this.autoSkipOnError) {
        void this.handleStreamFailure(track, session, 'error');
      } else {
        this.notify();
      }
      return;
    }

    if (!preloadedBlobUrl) {
      markTrackUrlResolved(track);
    }

    if (this.audioEl) {
      this.audioEl.src = targetUrl;
      try {
        this.audioEl.currentTime = 0;
      } catch {}
    }

    if (autoPlay) {
      this.enforceMutualExclusion();
      void this.attemptPlayCurrentAudio(track, session);
    } else {
      this.notify();
    }
  }

  private async refreshExpiredAndPrepare(track: Track, session: number, autoPlay: boolean): Promise<void> {
    if (!this.resolveTrackUrl) return;
    try {
      const freshUrl = await withResolveTimeout(this.resolveTrackUrl(track, 'expired'), 10000);
      if (this.destroyed || session !== this.playbackSession) return;
      if (freshUrl) {
        track.src = freshUrl;
        markTrackUrlResolved(track);
      }
    } catch (err) {
      if (this.destroyed || session !== this.playbackSession) return;
      console.warn('[PwaPlayer] Expired URL refresh failed:', err);
    }

    if (!track.src) {
      if (autoPlay && this.autoSkipOnError) {
        await this.handleStreamFailure(track, session, 'error');
      } else {
        this.notify();
      }
      return;
    }

    if (this.audioEl) {
      this.audioEl.src = track.src;
      try {
        this.audioEl.currentTime = 0;
      } catch {}
    }

    if (autoPlay) {
      this.enforceMutualExclusion();
      await this.attemptPlayCurrentAudio(track, session);
    } else {
      this.notify();
    }
  }

  private startWatchdog(track: Track, session: number): void {
    this.clearWatchdog();
    if (this.streamWatchdogMs <= 0) return;
    this.watchdogTimer = setTimeout(() => {
      this.watchdogTimer = null;
      if (this.destroyed || session !== this.playbackSession) return;
      if ((this.audioEl.currentTime || 0) === 0 && (this.audioEl.readyState || 0) < 3) {
        void this.handleStreamFailure(track, session, 'watchdog');
      }
    }, this.streamWatchdogMs);
    if (typeof (this.watchdogTimer as any)?.unref === 'function') {
      (this.watchdogTimer as any).unref();
    }
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer !== null) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private async attemptPlayCurrentAudio(track: Track, session: number): Promise<void> {
    if (this.destroyed || session !== this.playbackSession) return;
    this.startWatchdog(track, session);

    try {
      const playPromise = this.audioEl.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      if (this.destroyed || session !== this.playbackSession) return;
      this.clearWatchdog();
      this.needsReloadOnForeground = false;
      this.interruption?.cancelRecovery();
      this.isPlaying = true;
      this.warmupAdjacent();
      this.notify();
    } catch (err) {
      if (this.destroyed || session !== this.playbackSession) return;
      this.clearWatchdog();
      const kind = classifyPlayRejection(err);
      if (kind === 'abort') return;
      if (kind === 'not_allowed') {
        console.warn('[PwaPlayer] play() rejected (NotAllowedError):', err);
        this.isPlaying = false;
        this.mediaSession.updatePlaybackState('paused');
        this.notify();
        return;
      }
      console.warn('[PwaPlayer] play() rejected:', err);
      if (this.autoSkipOnError) {
        await this.handleStreamFailure(track, session, 'error');
      } else {
        this.isPlaying = false;
        this.notify();
      }
    }
  }

  private async handleStreamFailure(
    track: Track,
    session: number,
    reason: 'error' | 'watchdog'
  ): Promise<void> {
    if (this.destroyed || session !== this.playbackSession) return;
    this.clearWatchdog();

    const curSrc = this.audioEl?.src || '';
    if (this.precache?.isPreloadedBlobUrlForTrack(curSrc, track) && track.src && !track.src.startsWith('blob:')) {
      this.precache.clear();
      this.prepareTrack(track, true);
      return;
    }

    const retryKey = getTrackPreloadKey(track);
    if (this.resolveTrackUrl && !this.retriedTracks.has(retryKey)) {
      this.retriedTracks.add(retryKey);
      try {
        const refreshedUrl = await withResolveTimeout(this.resolveTrackUrl(track, reason), 10000);
        if (this.destroyed || session !== this.playbackSession) return;
        if (refreshedUrl) {
          track.src = refreshedUrl;
          markTrackUrlResolved(track);
          this.prepareTrack(track, true);
          return;
        }
      } catch (err) {
        if (this.destroyed || session !== this.playbackSession) return;
        console.warn('[PwaPlayer] resolveTrackUrl retry failed:', err);
      }
    }

    (track as any).unplayable = true;

    const queueLen = this.playlist.getQueue().length;
    if (!this.autoSkipOnError || queueLen === 0 || this.consecutiveErrorSkips >= queueLen) {
      this.isPlaying = false;
      this.mediaSession.updatePlaybackState('paused');
      this.notify();
      return;
    }

    this.consecutiveErrorSkips += 1;
    const nextTrack = this.playlist.stepNextPlayable();
    if (!nextTrack) {
      this.isPlaying = false;
      this.mediaSession.updatePlaybackState('paused');
      this.notify();
      return;
    }

    this.keepAlive.reset();
    this.mediaSession.clearPosition();
    this.prepareTrack(nextTrack, true);
  }

  private getNextPlayableCandidate(): Track | null {
    const queue = this.playlist.getQueue();
    const indices = this.playlist.peekNextIndices(4);
    for (const idx of indices) {
      const cand = queue[idx];
      if (cand && !(cand as any).unplayable) {
        return cand;
      }
    }
    return null;
  }

  private async precacheUpcomingTrack(): Promise<void> {
    if (!this.precache || this.destroyed) return;
    const session = this.playbackSession;
    const queue = this.playlist.getQueue();
    const indices = this.playlist.peekNextIndices(4);

    for (const idx of indices) {
      const candidate = queue[idx];
      if (!candidate || (candidate as any).unplayable) continue;

      if (this.resolveTrackUrl && isTrackUrlExpired(candidate)) {
        try {
          const refreshed = await withResolveTimeout(this.resolveTrackUrl(candidate, 'expired'), 10000);
          if (this.destroyed || session !== this.playbackSession) return;
          if (refreshed) {
            candidate.src = refreshed;
            markTrackUrlResolved(candidate);
          }
        } catch {
          if (this.destroyed || session !== this.playbackSession) return;
        }
      }

      const ok = await this.precache.precacheCandidateAudio(candidate, () => {});
      if (this.destroyed || session !== this.playbackSession) return;
      if (ok) {
        if (this.precache.getPreloadedBlobUrl(candidate)) {
          this.notify();
        }
        return;
      }
    }
  }

  private resetSource(): void {
    this.clearWatchdog();
    this.interruption?.cancelRecovery();
    this.playbackSession += 1;
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
      void this.precacheUpcomingTrack();
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

  private bindLifecycleEvents(): void {
    const onForeground = () => this.attemptForegroundRecovery();
    this.onForegroundResume = onForeground;
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', onForeground);
    }
  }

  private attemptForegroundRecovery(): void {
    if (this.destroyed || !this.interruption?.isInterrupted()) return;
    const track = this.playlist.getCurrentTrack();
    const session = this.playbackSession;
    this.interruption.executeForegroundResume({
      audioEl: this.audioEl,
      track,
      curTime: this.currentTime,
      needsReload: this.needsReloadOnForeground,
      onPendingSeek: (t) => {
        this.pendingSeekAfterReload = t;
      },
      onClearedReload: () => {
        this.needsReloadOnForeground = false;
      },
      onRecovered: () => {
        if (this.destroyed || session !== this.playbackSession) return;
        this.needsReloadOnForeground = false;
        this.isPlaying = true;
        this.mediaSession.updatePlaybackState('playing');
        this.warmupAdjacent();
        this.notify();
      },
      onFallbackPlay: () => {
        if (this.destroyed || session !== this.playbackSession || !track) return;
        void this.handleStreamFailure(track, session, 'error');
      }
    });
  }

  private bindAudioEvents(): void {
    if (!this.audioEl || typeof this.audioEl.addEventListener !== 'function') return;

    this.audioEl.addEventListener('play', () => {
      if (this.destroyed || this.keepAlive.isHolding()) return;
      this.clearWatchdog();
      const track = this.playlist.getCurrentTrack();
      this.interruption?.consumePendingResumePosition(this.audioEl, track?.id ?? null);
      this.needsReloadOnForeground = false;
      this.isPlaying = true;
      this.mediaSession.registerHandlers();
      this.mediaSession.updatePlaybackState('playing');

      if (track) {
        this.mediaSession.updateMetadata(track);
      }
      this.mediaSession.updatePosition(this.currentTime, this.duration);
      this.warmupAdjacent();
      this.notify();
    });

    this.audioEl.addEventListener('pause', () => {
      if (this.destroyed || this.keepAlive.isHolding()) return;

      const track = this.playlist.getCurrentTrack();
      const curTime = this.audioEl.currentTime || this.currentTime || 0;
      const dur =
        this.audioEl.duration && !isNaN(this.audioEl.duration) && isFinite(this.audioEl.duration)
          ? this.audioEl.duration
          : this.duration;

      if (!this.interruption) {
        this.isPlaying = false;
        this.mediaSession.updatePlaybackState('paused');
        this.mediaSession.updatePosition(curTime, dur);
        this.notify();
        return;
      }

      const wasPlaying = this.isPlaying;
      this.interruption.dispatchPauseEvent({
        audioEl: this.audioEl,
        wasPlaying,
        curTime,
        duration: dur,
        trackId: track?.id ?? null,
        onSyncPaused: () => {
          this.isPlaying = false;
          this.mediaSession.updatePlaybackState('paused');
          this.mediaSession.updatePosition(this.audioEl.currentTime || this.currentTime, this.duration);
          this.notify();
        },
        onRecovered: () => {
          this.needsReloadOnForeground = false;
          this.isPlaying = true;
          this.mediaSession.updatePlaybackState('playing');
          this.warmupAdjacent();
          this.notify();
        },
        onGiveUp: () => {
          this.needsReloadOnForeground = true;
          this.isPlaying = false;
          this.mediaSession.updatePlaybackState('paused');
          this.notify();
        }
      });

      if (this.interruption.isInterrupted()) {
        this.isPlaying = false;
        this.mediaSession.updatePlaybackState('paused');
        this.notify();
      }
    });

    this.audioEl.addEventListener('timeupdate', () => {
      if (this.destroyed || this.keepAlive.isHolding()) return;
      if (this.sleepTimer.checkTick(() => this.pause())) return;

      this.currentTime = this.audioEl.currentTime;
      if (this.currentTime > 0) {
        this.consecutiveErrorSkips = 0;
        const active = this.playlist.getCurrentTrack();
        if (active) {
          this.retriedTracks.delete(getTrackPreloadKey(active));
        }
        this.clearWatchdog();
      }
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
      if (this.destroyed || this.keepAlive.isHolding()) return;
      if (this.audioEl.duration && !isNaN(this.audioEl.duration) && isFinite(this.audioEl.duration)) {
        this.duration = this.audioEl.duration;
      }
      if (this.pendingSeekAfterReload > 0) {
        const target = this.pendingSeekAfterReload;
        this.pendingSeekAfterReload = 0;
        try {
          if (!this.duration || target < this.duration) {
            this.audioEl.currentTime = target;
            this.currentTime = target;
          }
        } catch {}
      }
      this.mediaSession.updatePosition(this.currentTime, this.duration);
      this.notify();
    });

    this.audioEl.addEventListener('seeked', () => {
      if (this.destroyed || this.keepAlive.isHolding()) return;
      this.currentTime = this.audioEl.currentTime;
      this.mediaSession.updatePosition(this.currentTime, this.duration);
      this.notify();
    });

    this.audioEl.addEventListener('ended', () => {
      if (this.destroyed || this.keepAlive.isHolding()) return;
      this.clearWatchdog();
      this.interruption?.cancelRecovery();
      this.needsReloadOnForeground = false;
      this.consecutiveErrorSkips = 0;
      if (this.sleepTimer.isEndOfTrack()) {
        this.sleepTimer.cancelTimer();
        this.pause();
        return;
      }
      // Seamless chain advance to next playable track
      void this.next();
    });

    this.audioEl.addEventListener('error', () => {
      if (this.destroyed || this.keepAlive.isHolding()) return;
      const track = this.playlist.getCurrentTrack();
      if (!track || !this.autoSkipOnError) {
        console.warn('[PwaPlayer] Audio element error encountered:', this.audioEl.error);
        this.isPlaying = false;
        this.notify();
        return;
      }
      void this.handleStreamFailure(track, this.playbackSession, 'error');
    });
  }
}

/**
 * Factory helper for instantiation
 */
export function createPwaPlayer(options?: PwaPlayerOptions): PwaPlayer {
  return new PwaPlayer(options);
}
