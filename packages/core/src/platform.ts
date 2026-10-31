export interface PlatformDetection {
  isIOS: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  supportsMediaSession: boolean;
  supportsAudioSession: boolean;
}

export function detectPlatform(): PlatformDetection {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isSafari: false,
      isStandalone: false,
      supportsMediaSession: false,
      supportsAudioSession: false
    };
  }

  const ua = navigator.userAgent;
  // Detect iOS including iPadOS (which often pretends to be Mac with touch)
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isSafari =
    /^((?!chrome|android).)*safari/i.test(ua) ||
    (/AppleWebKit/i.test(ua) && !/Chrome|CriOS|FxiOS/i.test(ua));

  const isStandalone =
    ('standalone' in window.navigator && Boolean((window.navigator as any).standalone)) ||
    window.matchMedia('(display-mode: standalone)').matches;

  const supportsMediaSession = 'mediaSession' in navigator;
  const supportsAudioSession = 'audioSession' in navigator;

  return {
    isIOS,
    isSafari,
    isStandalone,
    supportsMediaSession,
    supportsAudioSession
  };
}

export const platform = detectPlatform();
