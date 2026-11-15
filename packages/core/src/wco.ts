/**
 * WCO (Window Controls Overlay) Titlebar Harmony & Corner Feathering Engine
 *
 * Solves the macOS/Windows desktop Chrome PWA WCO "cutout" problem where OS native
 * non-client titlebar zones (traffic lights on the left, window/extension controls on
 * the right) are filled opaquely with <meta name="theme-color"> and cannot be penetrated
 * by web backdrop-filter or background imagery.
 *
 * Key guarantees:
 * - Zero runtime/DOM/canvas overhead when not running in WCO display mode (unless forcePreview is set).
 * - Mathematically covers the exact physical WCO control bounds with a 100% opaque core
 *   before feathering smoothly into page/media content.
 * - Framework-agnostic (Vanilla, React, Vue, Svelte).
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface WcoGeometry {
  visible: boolean;
  height: number;
  left: number;
  right: number;
  titlebarWidth: number;
  isMac: boolean;
}

export interface WcoCornerGradientOptions {
  /** Base corner color (hex, rgb(), or CSS variable such as 'var(--wco-titlebar-bg)') */
  color?: string;
  /** Native left control width in px (0 when none, e.g. Windows) */
  left?: number;
  /** Native right control width in px */
  right?: number;
  /** Native titlebar height in px */
  height?: number;
  /** Optional override for ellipse horizontal semi-axis (px) */
  radiusX?: number;
  /** Optional override for ellipse vertical semi-axis (px) */
  radiusY?: number;
}

export interface TitlebarHarmonyInput {
  baseColor: string;
  isLight?: boolean;
  isModalOpen?: boolean;
  isImmersive?: boolean;
  customBgColor?: string | null;
  /** Backdrop scrim color blended over baseColor when a modal/drawer is open (default '#000000') */
  modalOverlayColor?: string;
  /** Backdrop scrim alpha when a modal is open (default 0.65) */
  modalOverlayAlpha?: number;
  /** Optional explicit override color for dark mode modals */
  darkModalColor?: string;
}

export interface TitlebarHarmonyOutput {
  harmonizedColor: string;
  isDisharmonious: boolean;
  contrastDelta: number;
}

export interface TopEdgeSampleOptions {
  /** Fraction of top height to inspect (default 0.25) */
  topRatio?: number;
  /** Weight multiplier for left/right top corners (default 2) */
  cornerWeight?: number;
  /** Minimum pixel alpha 0..255 (default 16) */
  minAlpha?: number;
}

export interface WcoTitlebarState {
  geometry: WcoGeometry;
  effectiveActive: boolean;
  forcePreview: boolean;
  harmonizedColor: string;
  cornerGradient: string;
  baseColor: string;
  isLight: boolean;
  backdropCount: number;
  isImmersive: boolean;
  customBgTopColor: string | null;
  customBgDimOpacity: number;
}

export interface WcoTitlebarOptions {
  baseColor?: string;
  isLight?: boolean;
  isImmersive?: boolean;
  customBgTopColor?: string | null;
  customBgDimOpacity?: number;
  modalOverlayColor?: string;
  modalOverlayAlpha?: number;
  darkModalColor?: string;
  /** Force corner gradient & geometry preview even outside WCO mode (default false) */
  forcePreview?: boolean;
  /**
   * Managed corner overlay element:
   * - true: auto-create & append a fixed pointer-events-none overlay div on document.body
   * - HTMLElement: drive an existing overlay element
   * - false/undefined: CSS variables only (no DOM element created)
   */
  overlayElement?: HTMLElement | boolean;
  overlayZIndex?: number;
  /** Root element receiving CSS custom properties (default document.documentElement) */
  rootElement?: HTMLElement;
  /** Sync <meta name="theme-color"> automatically (default true) */
  syncMetaThemeColor?: boolean;
}

/**
 * Parse hex (#rgb, #rrggbb, #rrggbbaa) or rgb()/rgba() strings into RGB components.
 */
export function parseColorRgb(
  color: string,
  fallback: RgbColor = { r: 255, g: 255, b: 255 }
): RgbColor {
  if (!color || typeof color !== 'string') return fallback;
  const trimmed = color.trim();

  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  if (rgbMatch) {
    return {
      r: Math.max(0, Math.min(255, Math.round(Number(rgbMatch[1])))),
      g: Math.max(0, Math.min(255, Math.round(Number(rgbMatch[2])))),
      b: Math.max(0, Math.min(255, Math.round(Number(rgbMatch[3]))))
    };
  }

  let clean = trimmed.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  } else if (clean.length === 8) {
    clean = clean.slice(0, 6);
  }
  if (clean.length !== 6) return fallback;

  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return fallback;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const hexByte = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

/**
 * Compute WCAG relative luminance (0.0 .. 1.0).
 */
export function getRelativeLuminance(color: string): number {
  const { r, g, b } = parseColorRgb(color);
  const [sr, sg, sb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
}

/**
 * Physically blend baseColor with overlayColor at alpha (0..1).
 */
export function blendColors(baseColor: string, overlayColor: string, alpha: number): string {
  const base = parseColorRgb(baseColor);
  const overlay = parseColorRgb(overlayColor);
  const a = Math.max(0, Math.min(1, alpha));
  return toHex(
    base.r * (1 - a) + overlay.r * a,
    base.g * (1 - a) + overlay.g * a,
    base.b * (1 - a) + overlay.b * a
  );
}

/**
 * Detect whether the app is currently running in desktop PWA Window Controls Overlay mode.
 */
export function isWcoActive(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const wco = (navigator as any)?.windowControlsOverlay;
  if (wco?.visible === true) return true;
  if (typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(display-mode: window-controls-overlay)').matches === true;
    } catch {
      return false;
    }
  }
  return false;
}

function detectIsMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const plat = navigator.platform || '';
  return /Macintosh|Mac OS X/i.test(ua) || plat.includes('Mac');
}

/**
 * Read current WCO geometry from navigator.windowControlsOverlay or provide safe OS defaults.
 * When not in WCO mode and forceFallback is false, returns zeroed overlay dimensions.
 */
export function getWcoGeometry(forceFallback = false): WcoGeometry {
  const isMac = detectIsMac();
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      visible: false,
      height: forceFallback ? 38 : 0,
      left: forceFallback && isMac ? 80 : 0,
      right: forceFallback ? 138 : 0,
      titlebarWidth: 0,
      isMac
    };
  }

  const visible = isWcoActive();
  const wco = (navigator as any)?.windowControlsOverlay;
  const viewportWidth = window.innerWidth || 1280;

  if (visible && typeof wco?.getTitlebarAreaRect === 'function') {
    try {
      const rect = wco.getTitlebarAreaRect();
      if (rect && rect.height > 0 && rect.width > 0) {
        const height = Math.round(rect.height);
        const left = Math.max(0, Math.round(rect.x));
        const right = Math.max(0, Math.round(viewportWidth - (rect.x + rect.width)));
        return {
          visible: true,
          height,
          left,
          right,
          titlebarWidth: Math.max(0, Math.round(rect.width)),
          isMac
        };
      }
    } catch {}
  }

  if (visible || forceFallback) {
    const height = 38;
    const left = isMac ? 80 : 0;
    const right = 138;
    return {
      visible,
      height,
      left,
      right,
      titlebarWidth: Math.max(0, viewportWidth - left - right),
      isMac
    };
  }

  return {
    visible: false,
    height: 0,
    left: 0,
    right: 0,
    titlebarWidth: viewportWidth,
    isMac
  };
}

/**
 * Sync --wco-height, --wco-left, --wco-right CSS variables onto root.
 */
export function syncWcoGeometryCssVars(geometry: WcoGeometry, root?: HTMLElement): void {
  if (typeof document === 'undefined') return;
  const target = root || document.documentElement;
  target.style.setProperty('--wco-height', `${geometry.height}px`);
  target.style.setProperty('--wco-left', `${geometry.left}px`);
  target.style.setProperty('--wco-right', `${geometry.right}px`);
}

/**
 * Compute harmonized <meta name="theme-color"> value for current state.
 */
export function computeTitlebarHarmony(input: TitlebarHarmonyInput): TitlebarHarmonyOutput {
  const {
    baseColor,
    isLight = getRelativeLuminance(baseColor) > 0.45,
    isModalOpen = false,
    isImmersive = false,
    customBgColor,
    modalOverlayColor = '#000000',
    modalOverlayAlpha = 0.65,
    darkModalColor
  } = input;

  if (isImmersive) {
    const immersiveColor =
      typeof customBgColor === 'string' && customBgColor.trim().length > 0
        ? customBgColor.trim()
        : (isLight ? baseColor : blendColors(baseColor, '#0a0e1a', 0.7));

    if (isModalOpen) {
      return {
        harmonizedColor: blendColors(immersiveColor, modalOverlayColor, modalOverlayAlpha),
        isDisharmonious: false,
        contrastDelta: 0
      };
    }

    return {
      harmonizedColor: immersiveColor,
      isDisharmonious: false,
      contrastDelta: 0
    };
  }

  if (!isModalOpen) {
    return {
      harmonizedColor: baseColor,
      isDisharmonious: false,
      contrastDelta: 0
    };
  }

  if (!isLight && darkModalColor) {
    return {
      harmonizedColor: darkModalColor,
      isDisharmonious: false,
      contrastDelta: Math.abs(getRelativeLuminance(baseColor) - getRelativeLuminance(darkModalColor))
    };
  }

  const blendedColor = blendColors(baseColor, modalOverlayColor, modalOverlayAlpha);
  const contrastDelta = Math.abs(getRelativeLuminance(baseColor) - getRelativeLuminance(blendedColor));
  return {
    harmonizedColor: blendedColor,
    isDisharmonious: contrastDelta > 0.3,
    contrastDelta
  };
}

function buildCornerStopGradient(params: {
  isLeft: boolean;
  width: number;
  height: number;
  color: string;
  rgb: RgbColor | null;
  radiusX?: number;
  radiusY?: number;
}): string {
  const { isLeft, width, height, color, rgb, radiusX, radiusY } = params;
  const h = Math.max(24, height || 38);

  const rx = radiusX ?? (isLeft ? Math.max(320, Math.round(width * 4.75)) : Math.max(360, Math.round(width * 3.33)));
  const ry = radiusY ?? (isLeft ? Math.max(150, Math.round(h * 4.75)) : Math.max(160, Math.round(h * 5)));

  const offsetX = isLeft ? Math.round(width * 0.3) : Math.round(width * 0.41);
  const cy = Math.round(h * 0.37);
  const dx = Math.max(1, width - offsetX + 4);
  const dy = Math.max(1, h - cy + 4);

  // Ensure the 100% opaque ellipse mathematically encompasses the outer corner (W+4, H+4)
  const solidR = Math.min(rx - 20, Math.ceil(rx * Math.hypot(dx / rx, dy / ry)));
  const span = Math.max(20, rx - solidR);
  const stop85 = Math.round(solidR + span * 0.16);
  const stop45 = Math.round(solidR + span * 0.42);
  const stop15 = Math.round(solidR + span * 0.7);

  const pos = isLeft ? `${offsetX}px ${cy}px` : `calc(100% - ${offsetX}px) ${cy}px`;

  if (rgb) {
    const s100 = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
    const s85 = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`;
    const s45 = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`;
    const s15 = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
    const s0 = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`;
    return `radial-gradient(ellipse ${rx}px ${ry}px at ${pos}, ${s100} 0%, ${s100} ${solidR}px, ${s85} ${stop85}px, ${s45} ${stop45}px, ${s15} ${stop15}px, ${s0} 100%)`;
  }

  return `radial-gradient(ellipse ${rx}px ${ry}px at ${pos}, ${color} 0%, ${color} ${solidR}px, color-mix(in srgb, ${color} 85%, transparent) ${stop85}px, color-mix(in srgb, ${color} 45%, transparent) ${stop45}px, color-mix(in srgb, ${color} 15%, transparent) ${stop15}px, transparent 100%)`;
}

/**
 * Generate dual-corner radial-gradient CSS aligned to the exact WCO native cutout bounds.
 * Returns 'none' if both left and right WCO widths are 0.
 */
export function buildWcoCornerGradient(options?: WcoCornerGradientOptions): string {
  const color = options?.color || 'var(--wco-titlebar-bg)';
  const left = options?.left ?? 80;
  const right = options?.right ?? 138;
  const height = options?.height ?? 38;

  if (left <= 0 && right <= 0) return 'none';

  const trimmed = color.trim();
  const isConcreteColor = trimmed.startsWith('#') || /^rgba?\(/i.test(trimmed);
  const rgb = isConcreteColor ? parseColorRgb(trimmed) : null;

  const layers: string[] = [];
  if (left > 0) {
    layers.push(
      buildCornerStopGradient({
        isLeft: true,
        width: left,
        height,
        color: trimmed,
        rgb,
        radiusX: options?.radiusX,
        radiusY: options?.radiusY
      })
    );
  }
  if (right > 0) {
    layers.push(
      buildCornerStopGradient({
        isLeft: false,
        width: right,
        height,
        color: trimmed,
        rgb,
        radiusX: options?.radiusX,
        radiusY: options?.radiusY
      })
    );
  }

  return layers.join(', ');
}

/**
 * Sample weighted average color from the top pixel strip of an RGBA buffer.
 * Left and right corner bands receive higher weight to minimize WCO edge contrast.
 */
export function sampleTopColorFromPixels(
  data: Uint8ClampedArray | number[],
  width: number,
  height: number,
  options?: TopEdgeSampleOptions
): string | null {
  if (!data || width <= 0 || height <= 0) return null;
  const topRatio = options?.topRatio ?? 0.25;
  const cornerWeight = options?.cornerWeight ?? 2;
  const minAlpha = options?.minAlpha ?? 16;

  const maxRows = Math.max(1, Math.min(height, Math.round(height * topRatio)));
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let totalWeight = 0;

  for (let y = 0; y < maxRows; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (idx + 3 >= data.length || data[idx + 3] < minAlpha) continue;
      const weight = x < width * 0.3 || x >= width * 0.7 ? cornerWeight : 1;
      rSum += data[idx] * weight;
      gSum += data[idx + 1] * weight;
      bSum += data[idx + 2] * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return null;
  return toHex(rSum / totalWeight, gSum / totalWeight, bSum / totalWeight);
}

/**
 * Sample top-edge average color from a loaded <img> or <video> using an offscreen 64x32 canvas.
 * Safely returns null if canvas is unavailable or CORS-tainted.
 */
export function sampleElementTopColor(
  el: HTMLImageElement | HTMLVideoElement,
  options?: TopEdgeSampleOptions
): string | null {
  if (typeof document === 'undefined' || !el) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(el, 0, 0, 64, 32);
    const stripHeight = 8;
    const imageData = ctx.getImageData(0, 0, 64, stripHeight);
    return sampleTopColorFromPixels(imageData.data, 64, stripHeight, {
      topRatio: options?.topRatio ?? 1,
      cornerWeight: options?.cornerWeight ?? 2,
      minAlpha: options?.minAlpha ?? 16
    });
  } catch {
    return null;
  }
}

/**
 * Stateful, event-driven controller managing WCO geometry, <meta name="theme-color">,
 * CSS variables (--wco-titlebar-bg, --wco-corner-bg), and optional corner overlay DOM.
 *
 * When WCO is inactive and forcePreview is false, gradient calculation, corner overlay
 * rendering, and media canvas sampling are bypassed with zero runtime overhead.
 */
export class WcoTitlebarController {
  private baseColor: string;
  private isLight?: boolean;
  private isImmersive: boolean;
  private customBgTopColor: string | null;
  private customBgDimOpacity: number;
  private modalOverlayColor: string;
  private modalOverlayAlpha: number;
  private darkModalColor?: string;
  private forcePreview: boolean;
  private syncMeta: boolean;
  private rootElement?: HTMLElement;
  private overlayEl: HTMLElement | null = null;
  private ownsOverlayEl = false;
  private overlayZIndex: number;
  private backdropCount = 0;
  private listeners = new Set<(state: WcoTitlebarState) => void>();
  private mediaRef: WeakRef<HTMLImageElement | HTMLVideoElement> | null = null;
  private lastState!: WcoTitlebarState;
  private cleanupWatcher: (() => void) | null = null;
  private destroyed = false;

  constructor(options: WcoTitlebarOptions = {}) {
    this.baseColor = options.baseColor ?? '#ffffff';
    this.isLight = options.isLight;
    this.isImmersive = options.isImmersive ?? false;
    this.customBgTopColor = options.customBgTopColor ?? null;
    this.customBgDimOpacity = options.customBgDimOpacity ?? 0;
    this.modalOverlayColor = options.modalOverlayColor ?? '#000000';
    this.modalOverlayAlpha = options.modalOverlayAlpha ?? 0.65;
    this.darkModalColor = options.darkModalColor;
    this.forcePreview = options.forcePreview ?? false;
    this.syncMeta = options.syncMetaThemeColor ?? true;
    this.rootElement = options.rootElement;
    this.overlayZIndex = options.overlayZIndex ?? 99990;

    if (typeof document !== 'undefined') {
      if (options.overlayElement === true) {
        const el = document.createElement('div');
        el.setAttribute('data-wco-corner-overlay', 'true');
        el.setAttribute('aria-hidden', 'true');
        el.style.position = 'fixed';
        el.style.top = '0';
        el.style.left = '0';
        el.style.right = '0';
        el.style.height = '260px';
        el.style.pointerEvents = 'none';
        el.style.userSelect = 'none';
        el.style.zIndex = String(this.overlayZIndex);
        el.style.transition = 'background 220ms ease, opacity 220ms ease';
        document.body.appendChild(el);
        this.overlayEl = el;
        this.ownsOverlayEl = true;
      } else if (options.overlayElement instanceof HTMLElement) {
        this.overlayEl = options.overlayElement;
      }
    }

    this.setupWatchers();
    this.update();
  }

  private setupWatchers() {
    if (typeof window === 'undefined') return;
    const onGeometryOrModeChange = () => {
      if (this.destroyed) return;
      // Lazily sample media element if WCO was previously inactive
      if ((isWcoActive() || this.forcePreview) && !this.customBgTopColor && this.mediaRef) {
        const mediaEl = this.mediaRef.deref();
        if (mediaEl) {
          const sampled = sampleElementTopColor(mediaEl);
          if (sampled) this.customBgTopColor = sampled;
        }
      }
      this.update();
    };

    window.addEventListener('resize', onGeometryOrModeChange);
    const wco = (navigator as any)?.windowControlsOverlay;
    if (wco && typeof wco.addEventListener === 'function') {
      wco.addEventListener('geometrychange', onGeometryOrModeChange);
    }
    const mq = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: window-controls-overlay)')
      : null;
    if (mq && typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onGeometryOrModeChange);
    }

    this.cleanupWatcher = () => {
      window.removeEventListener('resize', onGeometryOrModeChange);
      if (wco && typeof wco.removeEventListener === 'function') {
        wco.removeEventListener('geometrychange', onGeometryOrModeChange);
      }
      if (mq && typeof mq.removeEventListener === 'function') {
        mq.removeEventListener('change', onGeometryOrModeChange);
      }
    };
  }

  public getState(): WcoTitlebarState {
    return this.lastState;
  }

  public subscribe(listener: (state: WcoTitlebarState) => void): () => void {
    this.listeners.add(listener);
    listener(this.lastState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setBaseColor(color: string, isLight?: boolean): void {
    this.baseColor = color;
    this.isLight = isLight;
    this.update();
  }

  public setImmersive(active: boolean): void {
    this.isImmersive = active;
    this.update();
  }

  public setForcePreview(force: boolean): void {
    this.forcePreview = force;
    if (force && !this.customBgTopColor && this.mediaRef) {
      const mediaEl = this.mediaRef.deref();
      if (mediaEl) {
        const sampled = sampleElementTopColor(mediaEl);
        if (sampled) this.customBgTopColor = sampled;
      }
    }
    this.update();
  }

  public setModalOverlay(color: string, alpha: number): void {
    this.modalOverlayColor = color;
    this.modalOverlayAlpha = Math.max(0, Math.min(1, alpha));
    this.update();
  }

  public setCustomBg(topColor: string | null, dimOpacity = this.customBgDimOpacity): void {
    this.customBgTopColor = topColor;
    this.customBgDimOpacity = Math.max(0, Math.min(0.95, dimOpacity));
    if (!topColor) this.mediaRef = null;
    this.update();
  }

  public setCustomBgDimOpacity(dimOpacity: number): void {
    this.customBgDimOpacity = Math.max(0, Math.min(0.95, dimOpacity));
    this.update();
  }

  /**
   * Sample top-edge color from an <img> or <video> element.
   * Bypassed with zero Canvas allocation when WCO is inactive and forcePreview is false.
   */
  public sampleMediaElement(el: HTMLImageElement | HTMLVideoElement | null, dimOpacity?: number): string | null {
    if (dimOpacity !== undefined) {
      this.customBgDimOpacity = Math.max(0, Math.min(0.95, dimOpacity));
    }
    if (!el) {
      this.mediaRef = null;
      this.customBgTopColor = null;
      this.update();
      return null;
    }

    if (typeof WeakRef !== 'undefined') {
      this.mediaRef = new WeakRef(el);
    }

    if (!isWcoActive() && !this.forcePreview) {
      return null;
    }

    const sampled = sampleElementTopColor(el);
    if (sampled) {
      this.customBgTopColor = sampled;
      this.update();
    }
    return sampled;
  }

  /**
   * Register an active modal/drawer/sheet backdrop. Returns an idempotent release function.
   */
  public pushBackdrop(): () => void {
    this.backdropCount++;
    this.update();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.backdropCount = Math.max(0, this.backdropCount - 1);
      this.update();
    };
  }

  public update(): WcoTitlebarState {
    const geometry = getWcoGeometry(this.forcePreview);
    const effectiveActive = geometry.visible || this.forcePreview;
    const resolvedLight = this.isLight ?? getRelativeLuminance(this.baseColor) > 0.45;

    const effectiveCustomColor =
      this.customBgTopColor
        ? blendColors(this.customBgTopColor, '#000000', this.customBgDimOpacity)
        : null;

    const harmony = computeTitlebarHarmony({
      baseColor: this.baseColor,
      isLight: resolvedLight,
      isModalOpen: this.backdropCount > 0,
      isImmersive: this.isImmersive,
      customBgColor: effectiveCustomColor,
      modalOverlayColor: this.modalOverlayColor,
      modalOverlayAlpha: this.modalOverlayAlpha,
      darkModalColor: this.darkModalColor
    });

    const cornerGradient = effectiveActive
      ? buildWcoCornerGradient({
          color: harmony.harmonizedColor,
          left: geometry.left,
          right: geometry.right,
          height: geometry.height
        })
      : 'none';

    if (typeof document !== 'undefined') {
      const target = this.rootElement || document.documentElement;
      syncWcoGeometryCssVars(geometry, target);
      target.style.setProperty('--wco-titlebar-bg', harmony.harmonizedColor);
      target.style.setProperty('--wco-corner-bg', cornerGradient);

      if (this.syncMeta) {
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'theme-color');
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', harmony.harmonizedColor);
      }

      if (this.overlayEl) {
        if (effectiveActive) {
          this.overlayEl.style.display = 'block';
          this.overlayEl.style.opacity = '1';
          this.overlayEl.style.background = cornerGradient;
        } else {
          this.overlayEl.style.display = 'none';
          this.overlayEl.style.background = 'none';
        }
      }
    }

    this.lastState = {
      geometry,
      effectiveActive,
      forcePreview: this.forcePreview,
      harmonizedColor: harmony.harmonizedColor,
      cornerGradient,
      baseColor: this.baseColor,
      isLight: resolvedLight,
      backdropCount: this.backdropCount,
      isImmersive: this.isImmersive,
      customBgTopColor: this.customBgTopColor,
      customBgDimOpacity: this.customBgDimOpacity
    };

    for (const listener of this.listeners) {
      try {
        listener(this.lastState);
      } catch {}
    }

    return this.lastState;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cleanupWatcher?.();
    this.cleanupWatcher = null;
    this.listeners.clear();
    if (this.ownsOverlayEl && this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
  }
}

export function createWcoTitlebarController(options?: WcoTitlebarOptions): WcoTitlebarController {
  return new WcoTitlebarController(options);
}
