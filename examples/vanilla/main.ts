import { createPwaPlayer, platform, type PlayMode } from 'pwa-audio-player';
import { DEMO_TRACKS } from '../_assets/demoTracks';
import { DEMO_I18N, detectBrowserLang, savePreferredLang, type Lang } from '../_assets/i18n';

// Initialize Player
const player = createPwaPlayer({
  initialQueue: DEMO_TRACKS,
  initialIndex: 0,
  initialMode: 'loop',
  keepAlive: {
    strategy: 'auto',
    hardPauseTimeoutMs: 5 * 60 * 1000
  },
  preloadAdjacent: true,
  enforceTrackNavigation: true,
  enableLockscreenLyrics: true
});

// Current language state
let currentLang: Lang = detectBrowserLang();

// DOM Elements
const linkBack = document.getElementById('link-back') as HTMLAnchorElement;
const txtBack = document.getElementById('txt-back')!;
const txtTitle = document.getElementById('txt-title')!;
const txtSubtitle = document.getElementById('txt-subtitle')!;

const badgePlatform = document.getElementById('badge-platform')!;
const badgeState = document.getElementById('badge-state')!;
const badgeKeepAlive = document.getElementById('badge-keepalive')!;

const coverImg = document.getElementById('cover-img') as HTMLImageElement;
const trackTitle = document.getElementById('track-title')!;
const trackArtist = document.getElementById('track-artist')!;
const lyricBox = document.getElementById('lyric-box')!;

const progressBarBg = document.getElementById('progress-bar-bg')!;
const progressBarFill = document.getElementById('progress-bar-fill')!;
const timeCurrent = document.getElementById('time-current')!;
const timeDuration = document.getElementById('time-duration')!;

const btnPlay = document.getElementById('btn-play')!;
const iconPlay = document.getElementById('icon-play')!;
const iconPause = document.getElementById('icon-pause')!;
const btnPrev = document.getElementById('btn-prev')!;
const btnNext = document.getElementById('btn-next')!;
const btnMode = document.getElementById('btn-mode')!;
const modeText = document.getElementById('mode-text')!;
const txtPlaylistTitle = document.getElementById('txt-playlist-title')!;
const playlistList = document.getElementById('playlist-list')!;

const txtGuideTitle = document.getElementById('txt-guide-title')!;
const txtStep1 = document.getElementById('txt-step-1')!;
const txtStep2 = document.getElementById('txt-step-2')!;
const txtStep3 = document.getElementById('txt-step-3')!;
const txtStep4 = document.getElementById('txt-step-4')!;
const txtStep5 = document.getElementById('txt-step-5')!;

// Back to hub link (dynamic host & subpath support)
const isDev = window.location.port === '5173';
const host = window.location.hostname || 'localhost';
const protocol = window.location.protocol || 'http:';
linkBack.href = isDev ? `${protocol}//${host}:5170` : '../';

// Format helper (mm:ss)
function formatTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Render playlist
function renderPlaylist(currentIndex: number) {
  playlistList.innerHTML = DEMO_TRACKS.map((t, idx) => `
    <div class="track-item ${idx === currentIndex ? 'current' : ''}" data-index="${idx}">
      <div class="track-item-left">
        <span class="track-item-title">${t.title}</span>
        <span class="track-item-artist">${t.artist}</span>
      </div>
      <span class="track-item-dur">${formatTime(t.duration)}</span>
    </div>
  `).join('');

  playlistList.querySelectorAll('.track-item').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-index') || '0', 10);
      player.playTrackByIndex(idx);
    });
  });
}

// Mode icon lookup
const modeIcons: Record<PlayMode, string> = {
  loop: '🔁',
  sequence: '➡️',
  single: '🔂',
  shuffle: '🔀'
};

// Apply i18n
function updateI18n(lang: Lang) {
  currentLang = lang;
  const t = DEMO_I18N[lang] || DEMO_I18N.en;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en';

  txtBack.textContent = t.backToHub;
  txtTitle.textContent = `PWA Player · Vanilla`;
  txtSubtitle.textContent = t.subtitle;
  txtPlaylistTitle.textContent = t.playlistTitle;

  txtGuideTitle.textContent = `📱 ${t.guideTitle}：`;
  txtStep1.textContent = t.guideStep1;
  txtStep2.textContent = t.guideStep2;
  txtStep3.textContent = t.guideStep3;
  txtStep4.textContent = t.guideStep4;
  txtStep5.textContent = t.guideStep5;

  // Platform badge
  badgePlatform.textContent = platform.isIOS
    ? `📱 ${t.badgeIosReady}`
    : `💻 ${t.badgeDesktop}`;
  badgePlatform.classList.add('active');

  // Lang buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.getAttribute('data-lang') === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Re-sync dynamic state text
  updateStateDisplay(player.getState());
}

function updateStateDisplay(state: ReturnType<typeof player.getState>) {
  const t = DEMO_I18N[currentLang] || DEMO_I18N.en;

  // KeepAlive Status Badge
  if (state.isHolding) {
    badgeKeepAlive.textContent = `🛡️ ${t.badgeSilentHold}`;
    badgeKeepAlive.className = 'badge holding';
    badgeState.textContent = `${t.badgeStatus}: SILENT-HOLD`;
  } else {
    badgeKeepAlive.textContent = `🛡️ ${t.badgeStatus}: ${t.stateIdle}`;
    badgeKeepAlive.className = 'badge';
    badgeState.textContent = `${t.badgeStatus}: ${state.playbackState.toUpperCase()}`;
  }

  // Lyric Box
  if (state.activeLyricText) {
    lyricBox.textContent = state.activeLyricText;
  } else {
    lyricBox.textContent = state.isPlaying ? t.lyricPlaying : t.lyricDefault;
  }
}

// Player State Subscription
player.subscribe((state) => {
  const current = state.currentTrack;
  if (current) {
    coverImg.src = typeof current.artwork === 'string' ? current.artwork : '';
    trackTitle.textContent = current.title;
    trackArtist.textContent = `${current.artist || ''} - ${current.album || ''}`;
  }

  // Play / Pause Icon
  if (state.isPlaying) {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
  } else {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  }

  // Progress Bar
  const percent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  progressBarFill.style.width = `${percent}%`;
  timeCurrent.textContent = formatTime(state.currentTime);
  timeDuration.textContent = formatTime(state.duration);

  // Mode Icon
  modeText.textContent = modeIcons[state.playMode] || '🔁';

  // Update dynamic text
  updateStateDisplay(state);

  // Update Playlist Highlight
  renderPlaylist(state.queueIndex);
});

// Event Listeners
btnPlay.addEventListener('click', () => player.toggle());
btnPrev.addEventListener('click', () => player.prev());
btnNext.addEventListener('click', () => player.next());

btnMode.addEventListener('click', () => {
  const modes: PlayMode[] = ['loop', 'sequence', 'shuffle', 'single'];
  const cur = player.getState().playMode;
  const nextMode = modes[(modes.indexOf(cur) + 1) % modes.length];
  player.setPlayMode(nextMode);
});

progressBarBg.addEventListener('click', (e) => {
  const rect = progressBarBg.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  const dur = player.getState().duration;
  if (dur > 0) {
    player.seek(ratio * dur);
  }
});

// Language switcher clicks
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang') as Lang;
    savePreferredLang(lang);
    updateI18n(lang);
  });
});

// Initialize UI i18n
updateI18n(currentLang);
