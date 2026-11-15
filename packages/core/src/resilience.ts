export const ONLINE_URL_TTL_MS = 12 * 60 * 1000;

export const INTERRUPTION_PROBE_DELAYS_MS = [
  1000, 2200, 3800, 5800, 8500, 12000, 16000, 22000, 30000
];

function getTrackUrl(track: Record<string, any> | null | undefined): string {
  if (!track) return '';
  return String(track.url || track.src || '');
}

/**
 * Default local-stream detector covering blob URLs and relative app stream routes.
 */
export function isDefaultLocalStreamUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes('/stream/online')) return false;
  return (
    url.startsWith('blob:') ||
    url.startsWith('/v3/stream') ||
    url.startsWith('/v3/history/stream') ||
    url.startsWith('/stream')
  );
}

/**
 * Stamps resolution time on online tracks so stale CDN links can be proactively refreshed.
 */
export function markTrackUrlResolved(
  track: Record<string, any> | null | undefined,
  now = Date.now(),
  isLocalUrl: (url: string) => boolean = isDefaultLocalStreamUrl
): void {
  const url = getTrackUrl(track);
  if (!track || !url) return;
  if (track.isLocal || isLocalUrl(url)) {
    delete track._resolvedAt;
    return;
  }
  track._resolvedAt = now;
}

/**
 * Returns true when a track's resolved online stream URL has exceeded its TTL.
 */
export function isTrackUrlExpired(
  track: Record<string, any> | null | undefined,
  now = Date.now(),
  ttlMs = ONLINE_URL_TTL_MS,
  isLocalUrl: (url: string) => boolean = isDefaultLocalStreamUrl
): boolean {
  const url = getTrackUrl(track);
  if (!track || !url) return false;
  if (track.isLocal || isLocalUrl(url)) return false;
  if (typeof track._resolvedAt !== 'number') return false;
  return now - track._resolvedAt > ttlMs;
}

/**
 * Wraps an external HTTP(S) fallback stream URL through a Range-capable proxy endpoint.
 */
export function formatFallbackStreamUrl(
  source: { url: string; headers?: Record<string, string> },
  proxyPath = '/v3/stream/online'
): string {
  const rawUrl = source?.url || '';
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    const q = new URLSearchParams({ url: rawUrl });
    const ref = source.headers?.referer || source.headers?.Referer;
    const ua = source.headers?.['user-agent'] || source.headers?.['User-Agent'];
    if (ref) q.set('referer', ref);
    if (ua) q.set('ua', ua);
    return `${proxyPath}?${q.toString()}`;
  }
  return rawUrl;
}

/**
 * Guards async track-resolution promises against hung sockets during cellular handoffs.
 */
export function withResolveTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Resolve timeout after ${ms}ms`));
    }, ms);
    if (typeof (timer as any)?.unref === 'function') {
      (timer as any).unref();
    }
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function getTrackKey(track: Record<string, any>): string {
  if (track.id !== undefined && track.id !== null && track.id !== '') {
    return `id:${String(track.id)}`;
  }
  if (track.filePath) {
    return `path:${String(track.filePath)}`;
  }
  const title = track.title || track.name || '';
  return `meta:${title}-${track.artist || ''}`;
}

function isSameStreamUrl(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    const base = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
    const urlA = new URL(a, base);
    const urlB = new URL(b, base);
    if (urlA.href === urlB.href) return true;
    return urlA.pathname + urlA.search === urlB.pathname + urlB.search;
  } catch {
    return false;
  }
}

const retriedSessionTracks = new Set<string>();
let streamWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

export function canRetryTrackStream(track: Record<string, any> | null | undefined): boolean {
  if (!track || track.isLocal) return false;
  return !retriedSessionTracks.has(getTrackKey(track));
}

export function markTrackStreamRetried(track: Record<string, any> | null | undefined): void {
  if (!track) return;
  retriedSessionTracks.add(getTrackKey(track));
}

export function clearTrackStreamRetry(track?: Record<string, any> | null): void {
  if (!track) {
    retriedSessionTracks.clear();
    return;
  }
  retriedSessionTracks.delete(getTrackKey(track));
}

export function startStreamWatchdog(callback: () => void, timeoutMs = 12000): void {
  clearStreamWatchdog();
  streamWatchdogTimer = setTimeout(() => {
    streamWatchdogTimer = null;
    callback();
  }, timeoutMs);
  if (typeof (streamWatchdogTimer as any)?.unref === 'function') {
    (streamWatchdogTimer as any).unref();
  }
}

export function clearStreamWatchdog(): void {
  if (streamWatchdogTimer !== null) {
    clearTimeout(streamWatchdogTimer);
    streamWatchdogTimer = null;
  }
}

/**
 * Classifies an HTMLAudioElement.play() rejection into abort, autoplay/session block, or stream failure.
 */
export function classifyPlayRejection(err: any): 'abort' | 'not_allowed' | 'stream_error' {
  const name = err?.name || '';
  if (name === 'AbortError') return 'abort';
  if (name === 'NotAllowedError') return 'not_allowed';
  return 'stream_error';
}

export interface BindAndPlayOptions {
  audioEl: HTMLAudioElement;
  track: Record<string, any>;
  url: string;
  session: number;
  getCurrentSession: () => number;
  resetTime: boolean;
  onMetadataSync: () => void;
  onResetTimeApplied: () => void;
  onWatchdogTimeout: () => void;
  onPlaySuccess: () => void;
  onNotAllowed: () => void;
  onStreamError: () => void;
  watchdogTimeoutMs?: number;
}

/**
 * Binds an audio stream URL to HTMLAudioElement, protects startup with a buffering watchdog,
 * and routes play() rejections cleanly.
 */
export function bindAndPlayWithWatchdog(opts: BindAndPlayOptions): void {
  const {
    audioEl,
    track,
    url,
    session,
    getCurrentSession,
    resetTime,
    onMetadataSync,
    onResetTimeApplied,
    onWatchdogTimeout,
    onPlaySuccess,
    onNotAllowed,
    onStreamError,
    watchdogTimeoutMs = 12000
  } = opts;

  try {
    audioEl.loop = false;
  } catch {}

  if (!isSameStreamUrl(audioEl.src, url)) {
    onMetadataSync();
    audioEl.src = url;
    if (resetTime) {
      try {
        audioEl.currentTime = 0;
      } catch {}
    }
  }

  if (resetTime) {
    onResetTimeApplied();
    const onMeta = () => {
      try {
        audioEl.currentTime = 0;
      } catch {}
      audioEl.removeEventListener('loadedmetadata', onMeta);
    };
    audioEl.addEventListener('loadedmetadata', onMeta);
  }

  startStreamWatchdog(() => {
    if (session === getCurrentSession() && (audioEl.currentTime || 0) === 0 && audioEl.readyState < 3) {
      onWatchdogTimeout();
    }
  }, watchdogTimeoutMs);

  const p = audioEl.play();
  if (p !== undefined) {
    p.then(() => {
      if (session !== getCurrentSession()) return;
      clearStreamWatchdog();
      clearTrackStreamRetry(track);
      onPlaySuccess();
    }).catch((err: any) => {
      if (session !== getCurrentSession()) return;
      clearStreamWatchdog();
      const kind = classifyPlayRejection(err);
      if (kind === 'abort') return;
      if (kind === 'not_allowed') {
        onNotAllowed();
        return;
      }
      onStreamError();
    });
  }
}

export interface InterruptedState {
  active: boolean;
  resumeTime: number;
  trackId: string | number | null;
}

export interface InterruptionRecoveryOptions {
  probeDelaysMs?: number[];
  isLocalUrl?: (url: string) => boolean;
  ttlMs?: number;
}

/**
 * Recovers playback automatically after OS-level audio focus interruptions
 * (turn-by-turn navigation prompts, voice assistants, phone/FaceTime calls).
 */
export class InterruptionRecoveryController {
  private intentionalPause = false;
  private interruptedState: InterruptedState = {
    active: false,
    resumeTime: 0,
    trackId: null
  };
  private probeTimers: Array<ReturnType<typeof setTimeout>> = [];
  private foregroundResuming = false;
  private probeDelaysMs: number[];
  private isLocalUrl: (url: string) => boolean;
  private ttlMs: number;

  constructor(options: InterruptionRecoveryOptions = {}) {
    this.probeDelaysMs = options.probeDelaysMs?.length
      ? [...options.probeDelaysMs]
      : [...INTERRUPTION_PROBE_DELAYS_MS];
    this.isLocalUrl = options.isLocalUrl ?? isDefaultLocalStreamUrl;
    this.ttlMs = options.ttlMs ?? ONLINE_URL_TTL_MS;
  }

  public markIntentionalPause(): void {
    this.intentionalPause = true;
  }

  public clearIntentionalPause(): void {
    this.intentionalPause = false;
  }

  public consumeIntentionalPause(): boolean {
    const val = this.intentionalPause;
    this.intentionalPause = false;
    return val;
  }

  public isInterrupted(): boolean {
    return this.interruptedState.active;
  }

  public getResumeTime(): number {
    return this.interruptedState.resumeTime;
  }

  private clearProbeTimers(): void {
    for (const timer of this.probeTimers) {
      clearTimeout(timer);
    }
    this.probeTimers = [];
  }

  public cancelRecovery(): void {
    this.clearProbeTimers();
    this.foregroundResuming = false;
    this.interruptedState = {
      active: false,
      resumeTime: 0,
      trackId: null
    };
  }

  public consumePendingResumePosition(
    audioEl: HTMLAudioElement | null,
    activeTrackId: string | number | null | undefined
  ): void {
    if (!this.interruptedState.active || !audioEl) return;
    const sameTrack =
      this.interruptedState.trackId == null ||
      activeTrackId == null ||
      String(this.interruptedState.trackId) === String(activeTrackId);
    const saved = this.interruptedState.resumeTime;
    this.cancelRecovery();
    if (sameTrack && saved > 1 && (audioEl.currentTime || 0) < 1) {
      this.restorePositionIfNeeded(audioEl, saved);
    }
  }

  private restorePositionIfNeeded(audioEl: HTMLAudioElement, resumeTime: number): void {
    if (resumeTime <= 0) return;
    const cur = audioEl.currentTime || 0;
    if (Math.abs(cur - resumeTime) <= 1.5) return;
    try {
      const dur = audioEl.duration;
      if (!dur || isNaN(dur) || !isFinite(dur) || resumeTime < dur) {
        audioEl.currentTime = resumeTime;
      }
    } catch {}
  }

  public handleUnexpectedPause(
    audioEl: HTMLAudioElement | null,
    curTime: number,
    trackId: string | number | null | undefined,
    onRecovered: () => void,
    onGiveUp: () => void
  ): void {
    if (!audioEl) return;
    this.clearProbeTimers();
    this.foregroundResuming = false;
    this.interruptedState = {
      active: true,
      resumeTime: curTime > 0 ? curTime : audioEl.currentTime || 0,
      trackId: trackId ?? null
    };

    const capturedTrackId = this.interruptedState.trackId;
    const total = this.probeDelaysMs.length;

    this.probeDelaysMs.forEach((delay, idx) => {
      const timer = setTimeout(() => {
        if (!this.interruptedState.active || this.interruptedState.trackId !== capturedTrackId) {
          return;
        }
        if (!audioEl.paused) {
          const saved = this.interruptedState.resumeTime;
          this.cancelRecovery();
          this.restorePositionIfNeeded(audioEl, saved);
          onRecovered();
          return;
        }

        const finishSuccess = () => {
          if (!this.interruptedState.active || this.interruptedState.trackId !== capturedTrackId) {
            return;
          }
          const saved = this.interruptedState.resumeTime;
          this.cancelRecovery();
          this.restorePositionIfNeeded(audioEl, saved);
          onRecovered();
        };

        const finishFailure = () => {
          if (!this.interruptedState.active || this.interruptedState.trackId !== capturedTrackId) {
            return;
          }
          if (idx === total - 1) {
            this.clearProbeTimers();
            onGiveUp();
          }
        };

        try {
          const p = audioEl.play();
          if (p !== undefined) {
            p.then(finishSuccess, finishFailure);
          } else {
            finishSuccess();
          }
        } catch {
          finishFailure();
        }
      }, delay);

      if (typeof (timer as any)?.unref === 'function') {
        (timer as any).unref();
      }
      this.probeTimers.push(timer);
    });
  }

  public tryResumeOnForeground(
    audioEl: HTMLAudioElement | null,
    onRecovered: () => void,
    onFailed?: (err: any) => void
  ): boolean {
    if (!this.interruptedState.active || !audioEl || this.foregroundResuming) {
      return false;
    }

    const saved = this.interruptedState.resumeTime;
    const capturedTrackId = this.interruptedState.trackId;

    if (!audioEl.paused) {
      this.cancelRecovery();
      this.restorePositionIfNeeded(audioEl, saved);
      onRecovered();
      return true;
    }

    this.clearProbeTimers();
    this.foregroundResuming = true;

    try {
      const p = audioEl.play();
      if (p !== undefined) {
        p.then(() => {
          this.foregroundResuming = false;
          if (!this.interruptedState.active || this.interruptedState.trackId !== capturedTrackId) return;
          this.cancelRecovery();
          this.restorePositionIfNeeded(audioEl, saved);
          onRecovered();
        }).catch((err: any) => {
          this.foregroundResuming = false;
          onFailed?.(err);
        });
      } else {
        this.foregroundResuming = false;
        this.cancelRecovery();
        this.restorePositionIfNeeded(audioEl, saved);
        onRecovered();
      }
      return true;
    } catch (err) {
      this.foregroundResuming = false;
      onFailed?.(err);
      return false;
    }
  }

  public executeForegroundResume(options: {
    audioEl: HTMLAudioElement | null;
    track: Record<string, any> | null | undefined;
    curTime: number;
    needsReload: boolean;
    onPendingSeek: (t: number) => void;
    onClearedReload: () => void;
    onRecovered: () => void;
    onFallbackPlay: () => void;
  }): boolean {
    const {
      audioEl,
      track,
      curTime,
      needsReload,
      onPendingSeek,
      onClearedReload,
      onRecovered,
      onFallbackPlay
    } = options;
    if (!audioEl || !this.interruptedState.active || !audioEl.paused) return false;
    if (track && (audioEl.error || audioEl.readyState === 0 || needsReload)) {
      const resumeTime = this.interruptedState.resumeTime || audioEl.currentTime || curTime || 0;
      if (resumeTime > 0) onPendingSeek(resumeTime);
      const trackUrl = getTrackUrl(track);
      if (trackUrl && (track.isLocal || !isTrackUrlExpired(track, Date.now(), this.ttlMs, this.isLocalUrl))) {
        onClearedReload();
        audioEl.src = trackUrl;
      }
    }
    return this.tryResumeOnForeground(audioEl, onRecovered, (err) => {
      if (classifyPlayRejection(err) === 'stream_error') onFallbackPlay();
    });
  }

  public dispatchPauseEvent(options: {
    audioEl: HTMLAudioElement;
    wasPlaying: boolean;
    curTime: number;
    duration?: number;
    trackId: string | number | null | undefined;
    onSyncPaused: () => void;
    onRecovered: () => void;
    onGiveUp: () => void;
  }): void {
    const { audioEl, wasPlaying, curTime, duration, trackId, onSyncPaused, onRecovered, onGiveUp } = options;
    const effCur = audioEl.currentTime > 0 ? audioEl.currentTime : curTime;
    const effDur =
      audioEl.duration && !isNaN(audioEl.duration) && isFinite(audioEl.duration)
        ? audioEl.duration
        : (duration || 0);
    const nearEnd = Boolean(audioEl.ended || (effDur > 1 && effCur >= effDur - 0.8));

    if (this.consumeIntentionalPause() || !wasPlaying || nearEnd) {
      onSyncPaused();
      return;
    }
    this.handleUnexpectedPause(audioEl, effCur, trackId, onRecovered, onGiveUp);
  }
}

export const interruptionController = new InterruptionRecoveryController();
