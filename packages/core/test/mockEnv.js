export class MockMediaMetadata {
  constructor(init) {
    this.title = init?.title || '';
    this.artist = init?.artist || '';
    this.album = init?.album || '';
    this.artwork = init?.artwork || [];
  }
}

export function setupMockDomEnv() {
  globalThis.MediaMetadata = MockMediaMetadata;

  const listeners = {};
  const mockAudio = {
    src: 'https://example.com/song1.mp3',
    currentTime: 42.5,
    duration: 180,
    readyState: 4,
    paused: true,
    loop: false,
    playbackRate: 1,
    play: async () => {
      mockAudio.paused = false;
      if (listeners['play']) listeners['play'].forEach(fn => fn());
    },
    pause: () => {
      mockAudio.paused = true;
      if (listeners['pause']) listeners['pause'].forEach(fn => fn());
    },
    addEventListener: (evt, fn) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    removeEventListener: (evt, fn) => {
      if (listeners[evt]) {
        listeners[evt] = listeners[evt].filter(f => f !== fn);
      }
    },
    trigger: (evt) => {
      if (listeners[evt]) {
        listeners[evt].forEach(fn => fn({ currentTarget: mockAudio }));
      }
    }
  };

  const actions = {};
  const mediaSessionMock = {
    playbackState: 'none',
    metadata: null,
    setPositionState: (args) => {
      mediaSessionMock.lastPositionState = args;
    },
    setActionHandler: (name, handler) => {
      actions[name] = handler;
    },
    lastPositionState: null
  };

  const mockNavigator = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
    platform: 'iPhone',
    maxTouchPoints: 5,
    mediaSession: mediaSessionMock
  };

  Object.defineProperty(globalThis, 'navigator', {
    value: mockNavigator,
    configurable: true,
    writable: true
  });

  const mockWindow = {
    location: { href: 'http://localhost/' },
    navigator: mockNavigator
  };

  Object.defineProperty(globalThis, 'window', {
    value: mockWindow,
    configurable: true,
    writable: true
  });

  return { mockAudio, mediaSessionMock, actions, listeners };
}
