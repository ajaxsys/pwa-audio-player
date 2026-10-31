import type { Track, KeepAliveOptions } from './types';
import { platform } from './platform';
import { getSilentWavUrl } from './silentWav';

export interface KeepAliveEvents {
  onKeepAliveEnter?: () => void;
  onKeepAliveExit?: () => void;
  onHardPauseTimeout?: () => void;
  onRequestResume?: () => void;
}

export class ModeF3Controller {
  private audioEl: HTMLAudioElement;
  private options: Required<KeepAliveOptions>;
  private events: KeepAliveEvents;

  private isHolding = false;
  private savedPauseTime = 0;
  private savedDuration = 0;
  private savedSongSrc = '';
  private savedTrack: Track | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    audioEl: HTMLAudioElement,
    options: KeepAliveOptions = {},
    events: KeepAliveEvents = {}
  ) {
    this.audioEl = audioEl;
    this.options = {
      strategy: options.strategy ?? 'auto',
      hardPauseTimeoutMs: options.hardPauseTimeoutMs ?? 5 * 60 * 1000
    };
    this.events = events;
  }

  public shouldActivateF3(): boolean {
    if (this.options.strategy === 'f3') return true;
    if (this.options.strategy === 'native') return false;
    // 'auto' strategy: activate specifically on iOS Safari & Standalone PWA
    return platform.isIOS;
  }

  public isF3Holding(): boolean {
    return this.isHolding;
  }

  public getSavedPauseTime(): number {
    return this.savedPauseTime;
  }

  public updateSavedPauseTime(time: number): void {
    if (!this.isHolding) return;
    this.savedPauseTime = Math.max(0, this.savedDuration > 0 ? Math.min(time, this.savedDuration) : time);
  }

  /**
   * Intercept pause action.
   * @returns true if handled by Mode F3 (caller MUST NOT call audio.pause())
   */
  public handlePause(
    track: Track | null,
    currentTime: number,
    duration: number,
    currentSrc: string
  ): boolean {
    if (!this.shouldActivateF3()) {
      return false;
    }

    // AirPods Flip-Flop Toggle:
    // If user presses AirPods stem while silent WAV is playing, iOS sends "pause" action.
    // Invert it into resume immediately!
    if (this.isHolding) {
      console.info('[PwaPlayer:F3] Flip-flop triggered: Inverting pause action to resume.');
      this.handleResume();
      return true;
    }

    const songUrl = currentSrc || this.audioEl.src;
    if (!songUrl || songUrl === window.location.href || songUrl.startsWith('blob:')) {
      return false;
    }

    this.savedPauseTime = currentTime || this.audioEl.currentTime || 0;
    this.savedDuration = (duration > 0 && isFinite(duration)) ? duration : (this.audioEl.duration || 0);
    this.savedSongSrc = songUrl;
    this.savedTrack = track;
    this.isHolding = true;

    this.clearTimeoutTimer();

    // Swap source to 2s silent WAV loop without calling audio.pause()
    const silentUrl = getSilentWavUrl();
    this.audioEl.loop = true;
    this.audioEl.src = silentUrl;

    this.audioEl.play().then(() => {
      this.events.onKeepAliveEnter?.();
    }).catch((err) => {
      console.warn('[PwaPlayer:F3] Silent WAV play failed, falling back to native pause:', err);
      this.reset();
      try { this.audioEl.pause(); } catch {}
    });

    // Schedule battery conservation hard timeout
    if (this.options.hardPauseTimeoutMs > 0) {
      this.timeoutTimer = setTimeout(() => {
        if (this.isHolding) {
          console.info('[PwaPlayer:F3] Inactivity timeout reached. Executing hard pause to conserve power.');
          this.reset();
          try { this.audioEl.pause(); } catch {}
          this.events.onHardPauseTimeout?.();
        }
      }, this.options.hardPauseTimeoutMs);
      if (typeof (this.timeoutTimer as any)?.unref === 'function') {
        (this.timeoutTimer as any).unref();
      }
    }

    return true;
  }

  /**
   * Intercept resume action.
   * @returns true if handled by Mode F3 recovery
   */
  public handleResume(onPlaySuccess?: () => void): boolean {
    if (!this.isHolding) {
      return false;
    }

    this.clearTimeoutTimer();

    const targetTime = this.savedPauseTime;
    const songSrc = this.savedSongSrc;
    const track = this.savedTrack;

    this.isHolding = false;
    this.audioEl.loop = false;

    if (!songSrc || songSrc === window.location.href) {
      return false;
    }

    // Restore original track source
    this.audioEl.src = songSrc;

    this.audioEl.play().then(() => {
      const doSeek = () => {
        try {
          if (targetTime > 0) {
            this.audioEl.currentTime = targetTime;
          }
        } catch (e) {
          console.warn('[PwaPlayer:F3] Breakpoint seek failed:', e);
        }
        this.events.onKeepAliveExit?.();
        onPlaySuccess?.();
      };

      if (this.audioEl.readyState >= 1 && this.audioEl.duration > 0) {
        setTimeout(doSeek, 50);
      } else {
        const onMetadata = () => {
          this.audioEl.removeEventListener('loadedmetadata', onMetadata);
          setTimeout(doSeek, 50);
        };
        this.audioEl.addEventListener('loadedmetadata', onMetadata);
      }
    }).catch((err) => {
      console.error('[PwaPlayer:F3] Track resume failed:', err);
      this.isHolding = false;
      this.audioEl.loop = false;
    });

    return true;
  }

  public reset(): void {
    this.clearTimeoutTimer();
    this.isHolding = false;
    this.savedPauseTime = 0;
    this.savedDuration = 0;
    this.savedSongSrc = '';
    this.savedTrack = null;
    try {
      this.audioEl.loop = false;
    } catch {}
  }

  private clearTimeoutTimer(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}
