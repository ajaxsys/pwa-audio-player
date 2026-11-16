import {
  createWcoTitlebarController,
  getRelativeLuminance,
  parseColorRgb,
  type WcoTitlebarState
} from 'pwa-audio-player';
import {
  WCO_I18N,
  detectBrowserLang,
  savePreferredLang,
  type Lang,
  type WcoTranslations
} from '../_assets/i18n';

// 0. Language state & initialization
let currentLang: Lang = detectBrowserLang();

// 1. Register minimal SW so Chrome Desktop treats this demo as an installable WCO PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// 2. Wire one-click PWA install button if Chrome emits beforeinstallprompt
let deferredInstallPrompt: any = null;
const btnInstallHint = document.getElementById('btn-install-hint') as HTMLDivElement;
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  btnInstallHint.style.display = 'inline-flex';
});
btnInstallHint.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => {});
  deferredInstallPrompt = null;
  btnInstallHint.style.display = 'none';
});

// 3. Back to hub link
const linkBack = document.getElementById('link-back') as HTMLAnchorElement;
const isDev = window.location.port === '5177';
const host = window.location.hostname || 'localhost';
const protocol = window.location.protocol || 'http:';
linkBack.href = isDev ? `${protocol}//${host}:5170` : '../';

// 4. Initialize WCO Titlebar Controller (zero overhead outside WCO mode by default)
const wco = createWcoTitlebarController({
  baseColor: '#0a0e1a',
  overlayElement: true,
  overlayZIndex: 100010,
  modalOverlayColor: '#000000',
  modalOverlayAlpha: 0.65
});

// DOM references - General & WCO
const bgStage = document.getElementById('bg-stage')!;
const bgImg = document.getElementById('bg-media-img') as HTMLImageElement;
const bgVideo = document.getElementById('bg-media-video') as HTMLVideoElement;
const bgDim = document.getElementById('bg-dim')!;

const simLeft = document.getElementById('sim-native-left')!;
const simRight = document.getElementById('sim-native-right')!;
const chkForcePreview = document.getElementById('chk-force-preview') as HTMLInputElement;
const chkSimCutouts = document.getElementById('chk-sim-cutouts') as HTMLInputElement;
const chkBrokenMode = document.getElementById('chk-broken-mode') as HTMLInputElement;

const titlebarDot = document.getElementById('titlebar-dot')!;
const titlebarStatus = document.getElementById('titlebar-status')!;
const valWcoMode = document.getElementById('val-wco-mode')!;
const valEngineStatus = document.getElementById('val-engine-status')!;
const valGeometry = document.getElementById('val-geometry')!;
const valColorSwatch = document.getElementById('val-color-swatch')!;
const valColorHex = document.getElementById('val-color-hex')!;
const valBackdrops = document.getElementById('val-backdrops')!;

const inputBgColor = document.getElementById('input-bg-color') as HTMLInputElement;
const swatchButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#swatch-row .swatch-btn'));

const inputMediaFile = document.getElementById('input-media-file') as HTMLInputElement;
const btnClearMedia = document.getElementById('btn-clear-media')!;
const presetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-preset]'));
const rangeDim = document.getElementById('range-dim') as HTMLInputElement;
const valDim = document.getElementById('val-dim')!;
const rangeBlur = document.getElementById('range-blur') as HTMLInputElement;
const valBlur = document.getElementById('val-blur')!;

const backdropPrimary = document.getElementById('backdrop-primary')!;
const backdropNested = document.getElementById('backdrop-nested')!;
const modalTitle = document.getElementById('modal-title')!;
const btnOpenModal = document.getElementById('btn-open-modal')!;
const btnOpenDrawer = document.getElementById('btn-open-drawer')!;
const btnOpenSheet = document.getElementById('btn-open-sheet')!;
const btnClosePrimary = document.getElementById('btn-close-primary')!;
const btnOpenNested = document.getElementById('btn-open-nested')!;
const btnCloseNested = document.getElementById('btn-close-nested')!;
const rangeScrimAlpha = document.getElementById('range-scrim-alpha') as HTMLInputElement;
const valScrimAlpha = document.getElementById('val-scrim-alpha')!;
const inputScrimColor = document.getElementById('input-scrim-color') as HTMLInputElement;

// DOM references - i18n
const txtBtnBack = document.getElementById('txt-btn-back')!;
const txtBtnInstall = document.getElementById('txt-btn-install')!;
const txtHeroTitle = document.getElementById('txt-hero-title')!;
const txtHeroDesc = document.getElementById('txt-hero-desc')!;
const txtChkForcePreview = document.getElementById('txt-chk-force-preview')!;
const txtChkSimCutouts = document.getElementById('txt-chk-sim-cutouts')!;

const lblMetricMode = document.getElementById('lbl-metric-mode')!;
const lblMetricEngine = document.getElementById('lbl-metric-engine')!;
const lblMetricGeometry = document.getElementById('lbl-metric-geometry')!;
const lblMetricTheme = document.getElementById('lbl-metric-theme')!;
const lblMetricBackdrops = document.getElementById('lbl-metric-backdrops')!;

const txtSec1Title = document.getElementById('txt-sec1-title')!;
const lblCustomColor = document.getElementById('lbl-custom-color')!;

const txtSec2Title = document.getElementById('txt-sec2-title')!;
const txtBtnExitMedia = document.getElementById('txt-btn-exit-media')!;
const txtBtnUploadMedia = document.getElementById('txt-btn-upload-media')!;
const presetWarmWood = document.getElementById('preset-warm-wood')!;
const presetGoldenSunset = document.getElementById('preset-golden-sunset')!;
const presetSplitContrast = document.getElementById('preset-split-contrast')!;
const presetOceanNight = document.getElementById('preset-ocean-night')!;
const lblDim = document.getElementById('lbl-dim')!;
const lblBlur = document.getElementById('lbl-blur')!;
const txtChkBrokenMode = document.getElementById('txt-chk-broken-mode')!;

const txtSec3Title = document.getElementById('txt-sec3-title')!;
const txtSec3Desc = document.getElementById('txt-sec3-desc')!;
const lblScrimAlpha = document.getElementById('lbl-scrim-alpha')!;
const lblScrimColor = document.getElementById('lbl-scrim-color')!;
const modalDesc = document.getElementById('modal-desc')!;
const nestedTitle = document.getElementById('nested-title')!;
const nestedDesc = document.getElementById('nested-desc')!;

let activeObjectUrl: string | null = null;
let releasePrimaryBackdrop: (() => void) | null = null;
let releaseNestedBackdrop: (() => void) | null = null;
let currentOverlayMode: 'modal' | 'drawer' | 'sheet' | null = null;

function revokeCurrentObjectUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function applyPageBaseColor(hex: string) {
  document.documentElement.style.setProperty('--page-bg', hex);
  const isLight = getRelativeLuminance(hex) > 0.45;
  document.body.classList.toggle('light-ink', isLight && !wco.getState().isImmersive);
  inputBgColor.value = hex;
  swatchButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.color?.toLowerCase() === hex.toLowerCase());
  });
  wco.setBaseColor(hex, isLight);
}

// Generate offline procedural test images on an offscreen canvas
function generatePresetDataUrl(preset: string): string {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 360;
  const ctx = c.getContext('2d')!;

  if (preset === 'warm-wood') {
    const grad = ctx.createLinearGradient(0, 0, 640, 360);
    grad.addColorStop(0, '#c7b299');
    grad.addColorStop(0.5, '#a88c6c');
    grad.addColorStop(1, '#7a5e42');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 360);
    for (let x = 0; x < 640; x += 28) {
      ctx.fillStyle = x % 56 === 0 ? 'rgba(92, 68, 44, 0.28)' : 'rgba(255, 244, 224, 0.16)';
      ctx.fillRect(x, 0, 10, 360);
    }
  } else if (preset === 'golden-sunset') {
    const grad = ctx.createLinearGradient(0, 0, 0, 360);
    grad.addColorStop(0, '#fb923c');
    grad.addColorStop(0.45, '#f43f5e');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.beginPath();
    ctx.arc(320, 175, 76, 0, Math.PI * 2);
    ctx.fill();
  } else if (preset === 'split-contrast') {
    const grad = ctx.createLinearGradient(0, 0, 640, 0);
    grad.addColorStop(0, '#fef3c7');
    grad.addColorStop(0.5, '#94a3b8');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 360);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 640, 360);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(0.5, '#0f766e');
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 360);
  }

  return c.toDataURL('image/png');
}

function showImageBackground(src: string) {
  bgVideo.pause();
  bgVideo.removeAttribute('src');
  bgVideo.style.display = 'none';
  bgImg.style.display = 'block';
  bgImg.src = src;
  bgStage.classList.add('active');
  document.body.classList.remove('light-ink');
  wco.setImmersive(true);
}

function showVideoBackground(src: string) {
  bgImg.removeAttribute('src');
  bgImg.style.display = 'none';
  bgVideo.style.display = 'block';
  bgVideo.src = src;
  bgVideo.play().catch(() => {});
  bgStage.classList.add('active');
  document.body.classList.remove('light-ink');
  wco.setImmersive(true);
}

function clearMediaBackground() {
  revokeCurrentObjectUrl();
  bgVideo.pause();
  bgVideo.removeAttribute('src');
  bgVideo.style.display = 'none';
  bgImg.removeAttribute('src');
  bgImg.style.display = 'none';
  bgStage.classList.remove('active');
  wco.setImmersive(false);
  wco.setCustomBg(null);
  applyPageBaseColor(inputBgColor.value);
}

bgImg.addEventListener('load', () => {
  wco.sampleMediaElement(bgImg, Number(rangeDim.value) / 100);
});
bgVideo.addEventListener('loadeddata', () => {
  wco.sampleMediaElement(bgVideo, Number(rangeDim.value) / 100);
});

// Render telemetry & simulated comparison states
function renderState(state: WcoTitlebarState) {
  const t = WCO_I18N[currentLang];
  const broken = chkBrokenMode.checked;
  const overlayEl = document.querySelector<HTMLElement>('[data-wco-corner-overlay="true"]');
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  if (broken && state.effectiveActive) {
    // Demonstrate the legacy bug for side-by-side visual comparison
    if (overlayEl) {
      overlayEl.style.opacity = '0.3';
      overlayEl.style.background =
        'radial-gradient(ellipse 420px 320px at 0% 0%, #0a0e1a 0%, #0a0e1a 65px, transparent 100%), ' +
        'radial-gradient(ellipse 420px 320px at 100% 0%, #0a0e1a 0%, #0a0e1a 65px, transparent 100%)';
    }
    metaTheme?.setAttribute('content', '#0a0e1a');
  } else if (state.effectiveActive) {
    if (overlayEl) {
      overlayEl.style.opacity = '1';
      overlayEl.style.background = state.cornerGradient;
    }
    metaTheme?.setAttribute('content', state.harmonizedColor);
  } else {
    metaTheme?.setAttribute('content', state.harmonizedColor);
  }

  const displayColor = broken ? '#0a0e1a' : state.harmonizedColor;
  simLeft.style.background = displayColor;
  simRight.style.background = displayColor;

  const showSimBoxes = chkSimCutouts.checked && !state.geometry.visible;
  simLeft.classList.toggle('visible', showSimBoxes);
  simRight.classList.toggle('visible', showSimBoxes);

  titlebarDot.classList.toggle('active', state.effectiveActive);
  titlebarStatus.textContent = state.geometry.visible
    ? t.wcoActive
    : state.forcePreview
      ? t.wcoPreview
      : t.wcoIdle;

  valWcoMode.textContent = state.geometry.visible ? t.metricModeActive : t.metricModeInactive;
  valEngineStatus.textContent = state.effectiveActive
    ? broken
      ? t.metricEngineBroken
      : t.metricEngineFeathering
    : t.metricEngineBypassed;
  valGeometry.textContent = `${state.geometry.left}px / ${state.geometry.right}px / ${state.geometry.height}px`;
  valColorSwatch.style.background = displayColor;
  valColorHex.textContent = displayColor;
  valBackdrops.textContent = String(state.backdropCount);
}

wco.subscribe(renderState);

// i18n update handler
function updateI18n(lang: Lang) {
  currentLang = lang;
  const t = WCO_I18N[lang];

  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  document.title = t.pageTitle;

  txtBtnBack.textContent = t.btnBack;
  txtBtnInstall.textContent = t.btnInstall;
  txtHeroTitle.textContent = t.heroTitle;
  txtHeroDesc.innerHTML = t.heroDesc;
  txtChkForcePreview.textContent = t.chkForcePreview;
  txtChkSimCutouts.textContent = t.chkSimCutouts;

  lblMetricMode.textContent = t.metricMode;
  lblMetricEngine.textContent = t.metricEngine;
  lblMetricGeometry.textContent = t.metricGeometry;
  lblMetricTheme.textContent = t.metricThemeColor;
  lblMetricBackdrops.textContent = t.metricBackdrops;

  txtSec1Title.textContent = t.sec1Title;
  lblCustomColor.textContent = t.customColorLabel;

  swatchButtons.forEach((btn) => {
    const key = btn.dataset.swatchKey as keyof WcoTranslations | undefined;
    const nameEl = btn.querySelector('.swatch-name');
    if (key && nameEl && t[key]) {
      nameEl.textContent = t[key] as string;
    }
  });

  txtSec2Title.textContent = t.sec2Title;
  txtBtnExitMedia.textContent = t.btnExitMedia;
  txtBtnUploadMedia.textContent = t.btnUploadMedia;
  presetWarmWood.textContent = t.presetWarmWood;
  presetGoldenSunset.textContent = t.presetGoldenSunset;
  presetSplitContrast.textContent = t.presetSplitContrast;
  presetOceanNight.textContent = t.presetOceanNight;
  lblDim.textContent = t.labelDim;
  lblBlur.textContent = t.labelBlur;
  txtChkBrokenMode.textContent = t.chkBrokenMode;

  txtSec3Title.textContent = t.sec3Title;
  txtSec3Desc.textContent = t.sec3Desc;
  btnOpenModal.textContent = t.btnOpenModal;
  btnOpenDrawer.textContent = t.btnOpenDrawer;
  btnOpenSheet.textContent = t.btnOpenSheet;
  lblScrimAlpha.textContent = t.labelScrimAlpha;
  lblScrimColor.textContent = t.labelScrimColor;

  if (currentOverlayMode) {
    if (currentOverlayMode === 'drawer') modalTitle.textContent = t.titleDrawer;
    else if (currentOverlayMode === 'sheet') modalTitle.textContent = t.titleSheet;
    else modalTitle.textContent = t.titleModal;
  }
  modalDesc.textContent = t.modalDesc;
  btnOpenNested.textContent = t.btnOpenNested;
  btnClosePrimary.textContent = t.btnClose;
  nestedTitle.textContent = t.titleNested;
  nestedDesc.textContent = t.nestedDesc;
  btnCloseNested.textContent = t.btnCloseNested;

  document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  renderState(wco.getState());
}

// Language switcher clicks
document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const selected = btn.dataset.lang as Lang;
    if (selected && (selected === 'zh' || selected === 'en' || selected === 'ja')) {
      savePreferredLang(selected);
      updateI18n(selected);
    }
  });
});

// Event bindings
chkForcePreview.addEventListener('change', () => {
  wco.setForcePreview(chkForcePreview.checked);
});
chkSimCutouts.addEventListener('change', () => {
  if (chkSimCutouts.checked && !chkForcePreview.checked && !wco.getState().geometry.visible) {
    chkForcePreview.checked = true;
    wco.setForcePreview(true);
  }
  renderState(wco.getState());
});
chkBrokenMode.addEventListener('change', () => {
  renderState(wco.getState());
});

swatchButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const color = btn.dataset.color || '#0a0e1a';
    clearMediaBackground();
    applyPageBaseColor(color);
  });
});

inputBgColor.addEventListener('input', () => {
  if (wco.getState().isImmersive) clearMediaBackground();
  applyPageBaseColor(inputBgColor.value);
});

presetButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    revokeCurrentObjectUrl();
    const url = generatePresetDataUrl(btn.dataset.preset || 'warm-wood');
    showImageBackground(url);
  });
});

inputMediaFile.addEventListener('change', () => {
  const file = inputMediaFile.files?.[0];
  if (!file) return;
  revokeCurrentObjectUrl();
  activeObjectUrl = URL.createObjectURL(file);
  if (file.type.startsWith('video/')) {
    showVideoBackground(activeObjectUrl);
  } else {
    showImageBackground(activeObjectUrl);
  }
  inputMediaFile.value = '';
});

btnClearMedia.addEventListener('click', clearMediaBackground);

rangeDim.addEventListener('input', () => {
  const alpha = Number(rangeDim.value) / 100;
  valDim.textContent = `${rangeDim.value}%`;
  bgDim.style.background = `rgba(0, 0, 0, ${alpha})`;
  wco.setCustomBgDimOpacity(alpha);
});

rangeBlur.addEventListener('input', () => {
  const px = `${rangeBlur.value}px`;
  valBlur.textContent = px;
  bgImg.style.filter = `blur(${px})`;
  bgVideo.style.filter = `blur(${px})`;
});

function updateScrimStyle() {
  const hex = inputScrimColor.value;
  const alpha = Number(rangeScrimAlpha.value) / 100;
  valScrimAlpha.textContent = `${rangeScrimAlpha.value}%`;
  const { r, g, b } = parseColorRgb(hex);
  document.documentElement.style.setProperty('--scrim-rgba', `rgba(${r}, ${g}, ${b}, ${alpha})`);
  wco.setModalOverlay(hex, alpha);
}

rangeScrimAlpha.addEventListener('input', updateScrimStyle);
inputScrimColor.addEventListener('input', updateScrimStyle);

function openPrimaryOverlay(mode: 'modal' | 'drawer' | 'sheet') {
  currentOverlayMode = mode;
  const t = WCO_I18N[currentLang];
  backdropPrimary.classList.remove('drawer-mode', 'sheet-mode');
  if (mode === 'drawer') {
    backdropPrimary.classList.add('drawer-mode');
    modalTitle.textContent = t.titleDrawer;
  } else if (mode === 'sheet') {
    backdropPrimary.classList.add('sheet-mode');
    modalTitle.textContent = t.titleSheet;
  } else {
    modalTitle.textContent = t.titleModal;
  }

  backdropPrimary.classList.add('open');
  if (!releasePrimaryBackdrop) {
    releasePrimaryBackdrop = wco.pushBackdrop();
  }
}

function closePrimaryOverlay() {
  backdropPrimary.classList.remove('open');
  currentOverlayMode = null;
  releasePrimaryBackdrop?.();
  releasePrimaryBackdrop = null;
}

btnOpenModal.addEventListener('click', () => openPrimaryOverlay('modal'));
btnOpenDrawer.addEventListener('click', () => openPrimaryOverlay('drawer'));
btnOpenSheet.addEventListener('click', () => openPrimaryOverlay('sheet'));
btnClosePrimary.addEventListener('click', closePrimaryOverlay);
backdropPrimary.addEventListener('click', (e) => {
  if (e.target === backdropPrimary) closePrimaryOverlay();
});

btnOpenNested.addEventListener('click', () => {
  backdropNested.classList.add('open');
  if (!releaseNestedBackdrop) {
    releaseNestedBackdrop = wco.pushBackdrop();
  }
});

function closeNestedOverlay() {
  backdropNested.classList.remove('open');
  releaseNestedBackdrop?.();
  releaseNestedBackdrop = null;
}

btnCloseNested.addEventListener('click', closeNestedOverlay);
backdropNested.addEventListener('click', (e) => {
  if (e.target === backdropNested) closeNestedOverlay();
});

// Initialize UI with preferred or detected language
updateI18n(currentLang);
