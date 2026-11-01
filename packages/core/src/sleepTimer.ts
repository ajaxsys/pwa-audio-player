import { formatTime } from './time';

export type SleepTimerOption = number | 'endOfTrack';

export interface SleepTimerState {
  option: SleepTimerOption | 0;
  isActive: boolean;
  remainingSeconds: number;
  formattedRemaining: string;
  targetTimestamp: number | null;
}

export type SleepTimerListener = (state: SleepTimerState) => void;

/**
 * Mobile Lockscreen & Background Resilient Sleep Timer Controller
 *
 * Core Mechanics:
 * 1. Absolute Timestamp Calibration (targetTimestamp): Avoids timer throttling when mobile OS
 *    reduces background setInterval frequency.
 * 2. Audio-Frame Driven Passive Clock Calibration (checkTick): Hooked into ontimeupdate (hardware PCM clock)
 *    to guarantee exact wall-clock trigger even under extreme iOS WebKit background suspension.
 * 3. End of Track Mode ('endOfTrack'): Seamlessly signals the audio player to stop immediately upon track end.
 * 4. Battery Safety: Signals consumer to tear down keepalive and perform hard pause.
 */
export class SleepTimerController {
  private option: SleepTimerOption | 0 = 0;
  private targetTimestamp: number | null = null;
  private remainingSeconds = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private triggerCallback: (() => void) | null = null;
  private listeners = new Set<SleepTimerListener>();

  constructor(onTriggerDefault?: () => void) {
    if (onTriggerDefault) {
      this.triggerCallback = onTriggerDefault;
    }
  }

  public isActive(): boolean {
    return this.option !== 0;
  }

  public isEndOfTrack(): boolean {
    return this.option === 'endOfTrack';
  }

  public getOption(): SleepTimerOption | 0 {
    return this.option;
  }

  public getRemainingSeconds(): number {
    return this.remainingSeconds;
  }

  public getTargetTimestamp(): number | null {
    return this.targetTimestamp;
  }

  public getState(): SleepTimerState {
    const formatted =
      this.option === 'endOfTrack'
        ? ''
        : this.remainingSeconds <= 0
        ? '00:00'
        : formatTime(this.remainingSeconds);

    return {
      option: this.option,
      isActive: this.option !== 0,
      remainingSeconds: this.remainingSeconds,
      formattedRemaining: formatted,
      targetTimestamp: this.targetTimestamp
    };
  }

  public subscribe(listener: SleepTimerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setTimer(opt: SleepTimerOption | 0, onTrigger?: () => void): void {
    this.cancelTimer();
    this.option = opt;
    if (onTrigger) {
      this.triggerCallback = onTrigger;
    }

    if (opt === 0) {
      this.notify();
      return;
    }

    if (typeof opt === 'number' && opt > 0) {
      this.targetTimestamp = Date.now() + opt * 60 * 1000;
      this.remainingSeconds = opt * 60;

      this.intervalId = setInterval(() => {
        this.updateRemaining();
      }, 1000);
      if (typeof (this.intervalId as any)?.unref === 'function') {
        (this.intervalId as any).unref();
      }
    } else if (opt === 'endOfTrack') {
      this.targetTimestamp = null;
      this.remainingSeconds = 0;
    }

    this.notify();
  }

  public cancelTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.option = 0;
    this.targetTimestamp = null;
    this.remainingSeconds = 0;
    this.notify();
  }

  /**
   * Called during audio timeupdate or periodic frames to bypass background timer throttling.
   * @returns true if sleep timer was triggered and completed.
   */
  public checkTick(onTrigger?: () => void): boolean {
    if (!this.targetTimestamp || typeof this.option !== 'number' || this.option <= 0) {
      return false;
    }

    const now = Date.now();
    if (now >= this.targetTimestamp) {
      this.executeTrigger(onTrigger || this.triggerCallback);
      return true;
    }

    const newRemaining = Math.max(0, Math.ceil((this.targetTimestamp - now) / 1000));
    if (newRemaining !== this.remainingSeconds) {
      this.remainingSeconds = newRemaining;
      this.notify();
    }
    return false;
  }

  public destroy(): void {
    this.cancelTimer();
    this.listeners.clear();
    this.triggerCallback = null;
  }

  private updateRemaining(): void {
    if (!this.targetTimestamp) return;
    const now = Date.now();
    if (now >= this.targetTimestamp) {
      this.executeTrigger(this.triggerCallback);
    } else {
      const newRemaining = Math.max(0, Math.ceil((this.targetTimestamp - now) / 1000));
      if (newRemaining !== this.remainingSeconds) {
        this.remainingSeconds = newRemaining;
        this.notify();
      }
    }
  }

  private executeTrigger(cb?: (() => void) | null): void {
    this.cancelTimer();
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('pwa-player:sleep-timer-trigger'));
      } catch {}
    }
    if (cb) {
      try {
        cb();
      } catch (e) {
        console.warn('[SleepTimer] Trigger callback error:', e);
      }
    }
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[SleepTimer] Listener error:', e);
      }
    }
  }
}
