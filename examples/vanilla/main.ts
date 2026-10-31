import { createPwaPlayer, platform, type PlayMode } from '@pwa-player/core';
import { DEMO_TRACKS } from '../../demo-assets/demoTracks';

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

// DOM Elements
const badgePlatform = document.getElementById('badge-platform')!;
const badgeState = document.getElementById('badge-state')!;
const badgeF3 = document.getElementById('badge-f3')!;

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
const playlistList = document.getElementById('playlist-list')!;

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

// Initial Platform badge
badgePlatform.textContent = platform.isIOS
  ? '📱 iOS / Safari (F3 已就绪)'
  : '💻 Desktop / Other (原生 Pause)';
badgePlatform.classList.add('active');

// Mode icon lookup
const modeIcons: Record<PlayMode, string> = {
  loop: '🔁',
  sequence: '➡️',
  single: '🔂',
  shuffle: '🔀'
};

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

  // Lyric Box
  if (state.activeLyricText) {
    lyricBox.textContent = state.activeLyricText;
  } else {
    lyricBox.textContent = state.isPlaying ? '♪ 正在播放 ♪' : '♪ 点击播放开始测试 ♪';
  }

  // F3 Status Badge
  if (state.isF3Holding) {
    badgeF3.textContent = '🛡️ Mode F3: 静音保活中';
    badgeF3.className = 'badge holding';
    badgeState.textContent = '状态: F3-HOLDING';
  } else {
    badgeF3.textContent = '🛡️ Mode F3: 待命';
    badgeF3.className = 'badge';
    badgeState.textContent = `状态: ${state.playbackState.toUpperCase()}`;
  }

  // Play Mode
  modeText.textContent = modeIcons[state.playMode] || '🔁';

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
