import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseColorRgb,
  toHex,
  getRelativeLuminance,
  blendColors,
  isWcoActive,
  getWcoGeometry,
  computeTitlebarHarmony,
  buildWcoCornerGradient,
  sampleTopColorFromPixels,
  createWcoTitlebarController
} from '../dist/index.js';

function createMockDom({ wcoVisible = false, isMac = true, width = 1280, rect = { x: 80, y: 0, width: 1062, height: 38 } } = {}) {
  const listeners = new Map();
  const wcoListeners = new Map();
  const mqListeners = new Map();
  const props = new Map();
  const headChildren = [];
  const bodyChildren = [];
  let createdCanvasCount = 0;

  const metaEl = {
    attrs: { name: 'theme-color', content: '#ffffff' },
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    getAttribute(k) {
      return this.attrs[k];
    }
  };

  function makeEl(tag) {
    return {
      tagName: tag.toUpperCase(),
      attrs: {},
      style: {},
      parentNode: null,
      setAttribute(k, v) {
        this.attrs[k] = v;
      },
      getAttribute(k) {
        return this.attrs[k];
      }
    };
  }

  const wcoMock = {
    visible: wcoVisible,
    getTitlebarAreaRect: () => ({ ...rect }),
    addEventListener: (evt, fn) => {
      if (!wcoListeners.has(evt)) wcoListeners.set(evt, new Set());
      wcoListeners.get(evt).add(fn);
    },
    removeEventListener: (evt, fn) => {
      wcoListeners.get(evt)?.delete(fn);
    },
    dispatchGeometryChange: () => {
      wcoListeners.get('geometrychange')?.forEach((fn) => fn());
    }
  };

  const mqMock = {
    matches: wcoVisible,
    addEventListener: (evt, fn) => {
      if (!mqListeners.has(evt)) mqListeners.set(evt, new Set());
      mqListeners.get(evt).add(fn);
    },
    removeEventListener: (evt, fn) => {
      mqListeners.get(evt)?.delete(fn);
    }
  };

  const docMock = {
    documentElement: {
      style: {
        setProperty(k, v) {
          props.set(k, v);
        },
        getPropertyValue(k) {
          return props.get(k) || '';
        }
      }
    },
    head: {
      appendChild(el) {
        headChildren.push(el);
      }
    },
    body: {
      appendChild(el) {
        el.parentNode = docMock.body;
        bodyChildren.push(el);
      },
      removeChild(el) {
        el.parentNode = null;
        const idx = bodyChildren.indexOf(el);
        if (idx >= 0) bodyChildren.splice(idx, 1);
      }
    },
    querySelector(sel) {
      if (sel === 'meta[name="theme-color"]') return metaEl;
      return null;
    },
    createElement(tag) {
      if (tag === 'canvas') createdCanvasCount++;
      return makeEl(tag);
    }
  };

  const navMock = {
    userAgent: isMac
      ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    platform: isMac ? 'MacIntel' : 'Win32',
    windowControlsOverlay: wcoMock
  };

  const winMock = {
    innerWidth: width,
    matchMedia: () => mqMock,
    addEventListener: (evt, fn) => {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
    },
    removeEventListener: (evt, fn) => {
      listeners.get(evt)?.delete(fn);
    }
  };

  globalThis.window = winMock;
  globalThis.document = docMock;
  Object.defineProperty(globalThis, 'navigator', {
    value: navMock,
    configurable: true,
    writable: true
  });

  return {
    wcoMock,
    mqMock,
    metaEl,
    props,
    bodyChildren,
    getCreatedCanvasCount: () => createdCanvasCount
  };
}

function clearMockDom() {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.navigator;
}

test('wco - parseColorRgb, toHex, luminance, and blendColors', () => {
  assert.deepEqual(parseColorRgb('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseColorRgb('#123456'), { r: 18, g: 52, b: 86 });
  assert.deepEqual(parseColorRgb('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30 });
  assert.deepEqual(parseColorRgb('rgba(10, 20, 30, 0.5)'), { r: 10, g: 20, b: 30 });
  assert.equal(toHex(255, 0, 15), '#ff000f');
  assert.equal(getRelativeLuminance('#000000'), 0);
  assert.equal(getRelativeLuminance('#ffffff'), 1);
  assert.equal(blendColors('#ffffff', '#000000', 0.5), '#808080');
});

test('wco - computeTitlebarHarmony handles normal, modal, and immersive customBg states', () => {
  const normal = computeTitlebarHarmony({ baseColor: '#fffdf0', isModalOpen: false });
  assert.equal(normal.harmonizedColor, '#fffdf0');
  assert.equal(normal.isDisharmonious, false);

  const modal = computeTitlebarHarmony({
    baseColor: '#ffffff',
    isModalOpen: true,
    modalOverlayColor: '#000000',
    modalOverlayAlpha: 0.6
  });
  assert.equal(modal.harmonizedColor, '#666666');
  assert.equal(modal.isDisharmonious, true);

  const immersive = computeTitlebarHarmony({
    baseColor: '#0a0e1a',
    isImmersive: true,
    customBgColor: '#c8aa8c'
  });
  assert.equal(immersive.harmonizedColor, '#c8aa8c');

  // Modal opened on top of an immersive custom background blends smoothly with the scrim
  const immersiveWithModal = computeTitlebarHarmony({
    baseColor: '#0a0e1a',
    isImmersive: true,
    isModalOpen: true,
    customBgColor: '#c8aa8c',
    modalOverlayColor: '#000000',
    modalOverlayAlpha: 0.5
  });
  assert.equal(immersiveWithModal.harmonizedColor, '#645546');
});

test('wco - buildWcoCornerGradient adapts dynamically to OS bounds', () => {
  assert.equal(buildWcoCornerGradient({ left: 0, right: 0, height: 38 }), 'none');

  // Windows: left = 0, right = 138 -> only right corner gradient generated
  const winCss = buildWcoCornerGradient({ color: '#ffeedd', left: 0, right: 138, height: 38 });
  assert.equal(winCss.includes('at calc(100% -'), true);
  assert.equal(winCss.includes('at 24px'), false);

  // macOS: both left (80px) and right (138px) corners with 100% solid stops covering edges
  const macCss = buildWcoCornerGradient({ color: 'var(--wco-titlebar-bg)', left: 80, right: 138, height: 38 });
  assert.equal(macCss.includes('at 24px 14px'), true);
  assert.equal(macCss.includes('at calc(100% - 57px) 14px'), true);
  assert.equal(macCss.includes('color-mix(in srgb'), true);
});

test('wco - sampleTopColorFromPixels weights corners and skips transparent pixels', () => {
  const width = 10;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let x = 0; x < width; x++) {
    const idx = x * 4;
    const isCorner = x < 3 || x >= 7;
    data[idx] = isCorner ? 200 : 100;
    data[idx + 1] = isCorner ? 160 : 80;
    data[idx + 2] = isCorner ? 120 : 60;
    data[idx + 3] = 255;
  }
  assert.equal(sampleTopColorFromPixels(data, width, height, { topRatio: 0.25 }), '#af8c69');
  assert.equal(sampleTopColorFromPixels(new Uint8ClampedArray(width * height * 4), width, height), null);
});

test('wco - WcoTitlebarController incurs zero overhead outside WCO and activates dynamically on geometrychange', () => {
  const env = createMockDom({ wcoVisible: false, isMac: true, width: 1280 });

  try {
    const ctrl = createWcoTitlebarController({
      baseColor: '#fffdf0',
      overlayElement: true
    });

    // Outside WCO mode: zero overlay work, overlay hidden, zero canvas allocation on media sampling
    assert.equal(isWcoActive(), false);
    assert.equal(getWcoGeometry().visible, false);
    const idleState = ctrl.getState();
    assert.equal(idleState.effectiveActive, false);
    assert.equal(idleState.cornerGradient, 'none');
    assert.equal(env.props.get('--wco-height'), '0px');
    assert.equal(env.bodyChildren[0].style.display, 'none');
    assert.equal(env.metaEl.getAttribute('content'), '#fffdf0');

    // Sampling is bypassed when WCO is off
    const sampledIdle = ctrl.sampleMediaElement({});
    assert.equal(sampledIdle, null);
    assert.equal(env.getCreatedCanvasCount(), 0);

    // Simulate user clicking Chrome's WCO chevron to turn WCO ON
    env.wcoMock.visible = true;
    env.mqMock.matches = true;
    env.wcoMock.dispatchGeometryChange();

    const activeState = ctrl.getState();
    assert.equal(activeState.effectiveActive, true);
    assert.equal(activeState.geometry.left, 80);
    assert.equal(activeState.geometry.right, 138);
    assert.equal(env.props.get('--wco-left'), '80px');
    assert.equal(env.props.get('--wco-right'), '138px');
    assert.equal(env.bodyChildren[0].style.display, 'block');
    assert.notEqual(activeState.cornerGradient, 'none');

    // Nested modal backdrop reference counting
    const releaseOuter = ctrl.pushBackdrop();
    const darkHex = ctrl.getState().harmonizedColor;
    assert.notEqual(darkHex, '#fffdf0');
    assert.equal(env.metaEl.getAttribute('content'), darkHex);

    const releaseInner = ctrl.pushBackdrop();
    assert.equal(ctrl.getState().backdropCount, 2);
    releaseInner();
    assert.equal(ctrl.getState().backdropCount, 1);
    assert.equal(env.metaEl.getAttribute('content'), darkHex);

    releaseOuter();
    assert.equal(ctrl.getState().backdropCount, 0);
    assert.equal(env.metaEl.getAttribute('content'), '#fffdf0');

    // Clean teardown removes owned overlay element
    ctrl.destroy();
    assert.equal(env.bodyChildren.length, 0);
  } finally {
    clearMockDom();
  }
});
