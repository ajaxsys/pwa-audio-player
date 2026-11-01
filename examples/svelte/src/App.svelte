<script lang="ts">
  import { createSveltePlayer } from './playerStore.svelte';
  import { platform, type PlayMode } from '@pwa-player/core';
  import { DEMO_TRACKS } from '../../../demo-assets/demoTracks';
  import { DEMO_I18N, detectBrowserLang, savePreferredLang, type Lang } from '../../../demo-assets/i18n';
  import '../../../demo-assets/player-shared.css';

  let currentLang = $state<Lang>(detectBrowserLang());

  $effect(() => {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : currentLang === 'ja' ? 'ja-JP' : 'en';
  });

  const t = $derived(DEMO_I18N[currentLang] || DEMO_I18N.en);

  function handleLangChange(newLang: Lang) {
    currentLang = newLang;
    savePreferredLang(newLang);
  }

  const playerStore = createSveltePlayer({
    initialQueue: DEMO_TRACKS,
    initialIndex: 0,
    initialMode: 'loop',
    keepAlive: { strategy: 'auto', hardPauseTimeoutMs: 5 * 60 * 1000 },
    preloadAdjacent: true,
    enforceTrackNavigation: true,
    enableLockscreenLyrics: true
  });

  const state = $derived(playerStore.state);
  const currentTrack = $derived(state.currentTrack);
  const isPlaying = $derived(state.isPlaying);
  const isHolding = $derived(state.isHolding);
  const currentTime = $derived(state.currentTime);
  const duration = $derived(state.duration);
  const queueIndex = $derived(state.queueIndex);
  const playMode = $derived(state.playMode);
  const activeLyricText = $derived(state.activeLyricText);

  const percent = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);

  const modeIcons: Record<PlayMode, string> = {
    loop: '🔁',
    sequence: '➡️',
    single: '🔂',
    shuffle: '🔀'
  };

  function formatTime(sec: number): string {
    if (isNaN(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function handleNextMode() {
    const modes: PlayMode[] = ['loop', 'sequence', 'shuffle', 'single'];
    const curIdx = modes.indexOf(playMode);
    playerStore.setMode(modes[(curIdx + 1) % modes.length]);
  }

  function handleSeekClick(e: MouseEvent) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (duration > 0) {
      playerStore.seek(ratio * duration);
    }
  }

  const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
  const protocol = typeof window !== 'undefined' ? (window.location.protocol || 'http:') : 'http:';
  const hubUrl = `${protocol}//${host}:5170`;
</script>

<div class="player-container" data-theme="svelte">
  <!-- Top Nav -->
  <div class="top-nav">
    <a href={hubUrl} class="back-link">
      {t.backToHub}
    </a>
    <div class="lang-switcher">
      <button
        class="lang-btn {currentLang === 'zh' ? 'active' : ''}"
        onclick={() => handleLangChange('zh')}
      >
        中文
      </button>
      <button
        class="lang-btn {currentLang === 'en' ? 'active' : ''}"
        onclick={() => handleLangChange('en')}
      >
        EN
      </button>
      <button
        class="lang-btn {currentLang === 'ja' ? 'active' : ''}"
        onclick={() => handleLangChange('ja')}
      >
        日本語
      </button>
    </div>
  </div>

  <!-- Header -->
  <div class="player-header">
    <h1>PWA Player · Svelte 5</h1>
    <p>{t.subtitle}</p>
  </div>

  <!-- Badges -->
  <div class="badge-container">
    <span class="badge active">
      {platform.isIOS ? `📱 ${t.badgeIosReady}` : `💻 ${t.badgeDesktop}`}
    </span>
    <span class="badge {isHolding ? 'holding' : ''}">
      {isHolding
        ? `🛡️ ${t.badgeSilentHold}`
        : `${t.badgeStatus}: ${state.playbackState.toUpperCase()}`}
    </span>
  </div>

  <!-- Player Card -->
  <div class="player-card">
    <div class="cover-wrapper">
      <img
        src={typeof currentTrack?.artwork === 'string' ? currentTrack.artwork : ''}
        alt="Artwork"
        class="cover-img"
      />
    </div>

    <div class="track-info">
      <div class="track-title">{currentTrack?.title || 'No Track'}</div>
      <div class="track-artist">{currentTrack?.artist} - {currentTrack?.album}</div>
    </div>

    <div class="lyric-box">
      {activeLyricText || (isPlaying ? t.lyricPlaying : t.lyricDefault)}
    </div>

    <div class="progress-area">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="progress-bar-bg" onclick={handleSeekClick}>
        <div class="progress-bar-fill" style="width: {percent}%"></div>
      </div>
      <div class="time-row">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>

    <div class="controls">
      <button class="btn btn-mode" onclick={handleNextMode} title="切换播放模式">
        {modeIcons[playMode]}
      </button>
      <button class="btn btn-skip" onclick={() => playerStore.prev()} title="上一首">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
        </svg>
      </button>
      <button class="btn btn-play" onclick={() => playerStore.toggle()} title="播放 / 暂停">
        {#if isPlaying}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        {:else}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        {/if}
      </button>
      <button class="btn btn-skip" onclick={() => playerStore.next()} title="下一首">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Playlist -->
  <div class="playlist-card">
    <div class="playlist-title">{t.playlistTitle}</div>
    {#each DEMO_TRACKS as track, idx (track.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="track-item {idx === queueIndex ? 'current' : ''}"
        onclick={() => playerStore.playIndex(idx)}
      >
        <div class="track-item-left">
          <span class="track-item-title">{track.title}</span>
          <span class="track-item-artist">{track.artist}</span>
        </div>
        <span class="track-item-dur">{formatTime(track.duration)}</span>
      </div>
    {/each}
  </div>

  <!-- Testing Guide -->
  <div class="guide-box">
    <b>📱 {t.guideTitle}：</b>
    <ol>
      <li>{t.guideStep1}</li>
      <li>{t.guideStep2}</li>
      <li>{t.guideStep3}</li>
      <li>{t.guideStep4}</li>
      <li>{t.guideStep5}</li>
    </ol>
  </div>
</div>
