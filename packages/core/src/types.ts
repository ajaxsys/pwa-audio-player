export interface MediaImage {
  src: string;
  sizes?: string;
  type?: string;
}

export interface Track {
  id: string | number;
  title: string;
  artist?: string;
  album?: string;
  src: string;
  artwork?: string | MediaImage[];
  duration?: number;
  lrc?: string;
  [key: string]: any;
}

/**
 * Playback state of the player:
 * - 'idle': Not initialized or track cleared
 * - 'playing': Audio is actively playing
 * - 'paused': Audio is natively paused
 * - 'buffering': Loading / awaiting audio buffer
 * - 'holding': In iOS silent-stream keep-alive hold (hardware PCM slot maintained, UI masked as paused)
 */
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'buffering' | 'holding';

export type PlayMode = 'sequence' | 'loop' | 'single' | 'shuffle';

export interface KeepAliveOptions {
  /**
   * Keep-alive strategy for maintaining hardware audio decoding on iOS background/lockscreen:
   * - 'auto': Automatically activate silent-hold stream on iOS Safari / Standalone PWA, use native pause on other platforms.
   * - 'silent-hold': Force silent-hold keep-alive across all platforms.
   * - 'native': Always use native audio.pause() without keep-alive.
   * Default: 'auto'.
   */
  strategy?: 'auto' | 'silent-hold' | 'native';

  /**
   * Inactivity timeout in milliseconds before transitioning from silent hold
   * to hard native pause to conserve battery. Set to 0 to disable timeout.
   * Default: 5 * 60 * 1000 (5 minutes).
   */
  hardPauseTimeoutMs?: number;
}

export interface PwaPlayerOptions {
  /**
   * Custom HTMLAudioElement. If omitted, an internal audio element will be instantiated.
   */
  audioElement?: HTMLAudioElement;

  /**
   * Keep-alive configuration for lockscreen and background audio.
   */
  keepAlive?: KeepAliveOptions;

  /**
   * Preload adjacent tracks (prev/next) in advance to prevent iOS User Gesture expiration.
   * Default: true.
   */
  preloadAdjacent?: boolean;

  /**
   * Strictly clear seekbackward/seekforward/seekto actions to enforce native music
   * track navigation layout (⏮ ⏯ ⏭) on iOS lockscreen and Control Center.
   * Default: true.
   */
  enforceTrackNavigation?: boolean;

  /**
   * Enable real-time dynamic lyric rendering on iOS lockscreen MediaSession.
   * Default: true.
   */
  enableLockscreenLyrics?: boolean;

  /**
   * Initial playlist queue.
   */
  initialQueue?: Track[];

  /**
   * Initial track index. Default: 0.
   */
  initialIndex?: number;

  /**
   * Initial play mode. Default: 'sequence'.
   */
  initialMode?: PlayMode;
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface PwaPlayerState {
  currentTrack: Track | null;
  playbackState: PlaybackState;
  isPlaying: boolean;
  /** True when audio element is maintaining hardware playback pipeline via silent loop */
  isHolding: boolean;
  currentTime: number;
  duration: number;
  queue: Track[];
  queueIndex: number;
  playMode: PlayMode;
  volume: number;
  activeLyricIndex: number;
  activeLyricText: string;
}

export type PlayerListener = (state: PwaPlayerState) => void;
