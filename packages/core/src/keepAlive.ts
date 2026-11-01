import type { Track, KeepAliveOptions } from './types';
import { platform } from './platform';
import { getSilentWavUrl } from './silentWav';

export interface KeepAliveEvents {
  onKeepAliveEnter?: () => void;
  onKeepAliveExit?: () => void;
  onHardPauseTimeout?: () => void;
  onRequestResume?: () => void;
}

/**
 * Hardware Audio Session Keeper (Silent-Hold Architecture)
 *
 * Background:
 * On iOS Safari / PWA, if an HTMLMediaElement calls native `audio.pause()` while in the
 * background (or screen locked), WebKit releases the element's CoreAudio hardware PCM decoding slot
 * within 3-5 seconds. When the user later hits "play" from the lockscreen, the JS promise resolves
 * and the lockscreen scrubber advances ("fake progress"), but the audio hardware clock is frozen
 * and the device remains completely silent.
 *
 * Solution (Single-Track Silent Hold):
 * 1. Never call `audio.pause()` on the active HTMLMediaElement while on iOS.
 * 2. Seamlessly swap `src` to an in-memory 2s zero-amplitude PCM WAV (loop=true) to keep CoreAudio active.
 * 3. Apply Triple-Lock UI Masking:
 *    - Force MediaSession playbackState to 'paused' (displays ▶️ icon on lockscreen, stops fake ticking)
 *    - Retain original track's title, artist, and album artwork (avoids metadata wipe)
 *    - Pin MediaSession setPositionState at exact breakpoint
 * 4. AirPods Smart Flip-Flop:
 *    When audio is actively outputting silent WAV, pressing AirPods stem dispatches a "pause" action.
 *    The keeper automatically inverts this "pause" into a "resume" command to wake up the real track.
 * 5. Breakpoint Seek Tolerance:
 *    Restores real track stream and safely seeks back once metadata is available.
 * 6. Inactivity Timeout:
 *    Safely falls back to native pause after a configurable duration (default 5 min) to prevent indefinite battery drain.
 */
export class SilentHoldKeeper {
  private audioEl: HTMLAudioElement;
  private options: Required<KeepAliveOptions>;
  private events: KeepAliveEvents;

  private holding = false;
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

  public shouldActivateSilentHold(): boolean {
    const strat = this.options.strategy;
    if (strat === 'silent-hold' || strat === 'f3') return true;
    if (strat === 'native') return false;
    // 'auto' strategy: activate specifically on iOS Safari & Standalone PWA
    return platform.isIOS;
  }

  public isHolding(): boolean {
    return this.holding;
  }

  /** Backward-compatible alias for isHolding */
  public isF3Holding(): boolean {
    return this.isHolding();
  }

  public getSavedPauseTime(): number {
    return this.savedPauseTime;
  }

  public updateSavedPauseTime(time: number): void {
    if (!this.holding) return;
    this.savedPauseTime = Math.max(0, this.savedDuration > 0 ? Math.min(time, this.savedDuration) : time);
  }

  /**
   * Intercept pause action.
   * @returns true if handled by silent-hold keeper (caller MUST NOT call audio.pause())
   */
  public handlePause(
    track: Track | null,
    currentTime: number,
    duration: number,
    currentSrc: string
  ): boolean {
    if (!this.shouldActivateSilentHold()) {
      return false;
    }

    // AirPods Flip-Flop Inversion:
    // If user clicks AirPods stem while silent WAV is playing, iOS mediaremoted sends a "pause" action.
    // Invert it into resume immediately to restart the actual track!
    if (this.holding) {
      console.info('[PwaPlayer:KeepAlive] AirPods Flip-Flop: Inverting pause action to resume.');
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
    this.holding = true;

    this.clearTimeoutTimer();

    // Swap source to 2s silent WAV loop without calling audio.pause()
    const silentUrl = getSilentWavUrl();
    this.audioEl.loop = true;
    this.audioEl.src = silentUrl;

    this.audioEl.play().then(() => {
      this.events.onKeepAliveEnter?.();
    }).catch((err) => {
      console.warn('[PwaPlayer:KeepAlive] Silent WAV play failed, falling back to native pause:', err);
      this.reset();
      try { this.audioEl.pause(); } catch {}
    });

    // Schedule battery conservation hard timeout
    if (this.options.hardPauseTimeoutMs > 0) {
      this.timeoutTimer = setTimeout(() => {
        if (this.holding) {
          console.info('[PwaPlayer:KeepAlive] Inactivity timeout reached. Executing hard pause to conserve power.');
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
   * @returns true if handled by silent-hold recovery
   */
  public handleResume(onPlaySuccess?: () => void): boolean {
    if (!this.holding) {
      return false;
    }

    this.clearTimeoutTimer();

    const targetTime = this.savedPauseTime;
    const songSrc = this.savedSongSrc;

    this.holding = false;
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
          console.warn('[PwaPlayer:KeepAlive] Breakpoint seek failed:', e);
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
      console.error('[PwaPlayer:KeepAlive] Track resume failed:', err);
      this.holding = false;
      this.audioEl.loop = false;
    });

    return true;
  }

  public reset(): void {
    this.clearTimeoutTimer();
    this.holding = false;
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

/** Backward-compatible export alias */
export const ModeF3Controller = SilentHoldKeeper;
