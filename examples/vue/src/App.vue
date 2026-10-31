<script setup lang="ts">
import { computed } from 'vue';
import { usePwaPlayer } from './usePwaPlayer';
import { platform, type PlayMode } from '@pwa-player/core';
import { DEMO_TRACKS } from '../../../demo-assets/demoTracks';

const { state, toggle, prev, next, seek, setMode, playIndex } = usePwaPlayer({
  initialQueue: DEMO_TRACKS,
  initialIndex: 0,
  initialMode: 'loop',
  keepAlive: { strategy: 'auto', hardPauseTimeoutMs: 5 * 60 * 1000 },
  preloadAdjacent: true,
  enforceTrackNavigation: true,
  enableLockscreenLyrics: true
});

const modeIcons: Record<PlayMode, string> = {
  loop: '🔁',
  sequence: '➡️',
  single: '🔂',
  shuffle: '🔀'
};

const currentTrack = computed(() => state.value.currentTrack);
const isPlaying = computed(() => state.value.isPlaying);
const isF3Holding = computed(() => state.value.isF3Holding);
const currentTime = computed(() => state.value.currentTime);
const duration = computed(() => state.value.duration);
const queueIndex = computed(() => state.value.queueIndex);
const playMode = computed(() => state.value.playMode);
const activeLyricText = computed(() => state.value.activeLyricText);

const percent = computed(() => {
  return duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0;
});

function formatTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function handleNextMode() {
  const modes: PlayMode[] = ['loop', 'sequence', 'shuffle', 'single'];
  const curIdx = modes.indexOf(playMode.value);
  setMode(modes[(curIdx + 1) % modes.length]);
}

function handleSeekClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  if (duration.value > 0) {
    seek(ratio * duration.value);
  }
}
</script>

<template>
  <div class="player-wrapper">
    <div class="header">
      <h1>PWA Player · Vue 3 Demo</h1>
      <p>基于 Vue 3 <code>shallowRef</code> 组合式 API (Composable) 实现</p>
    </div>

    <div class="badge-container">
      <span class="badge active">
        {{ platform.isIOS ? '📱 iOS Safari (F3 换源就绪)' : '💻 Desktop (原生 Pause)' }}
      </span>
      <span :class="['badge', isF3Holding ? 'holding' : '']">
        {{ isF3Holding ? '🛡️ Mode F3: 静音保活中' : `状态: ${state.playbackState.toUpperCase()}` }}
      </span>
    </div>

    <div class="card">
      <div class="cover-wrapper">
        <img :src="typeof currentTrack?.artwork === 'string' ? currentTrack.artwork : ''" alt="Artwork" class="cover-img" />
      </div>

      <div class="track-info">
        <div class="track-title">{{ currentTrack?.title || 'No Track' }}</div>
        <div class="track-artist">{{ currentTrack?.artist }} - {{ currentTrack?.album }}</div>
      </div>

      <div class="lyric-box">
        {{ activeLyricText || (isPlaying ? '♪ 正在播放 ♪' : '♪ 点击播放测试锁屏 ♪') }}
      </div>

      <div class="progress-area">
        <div class="progress-bar-bg" @click="handleSeekClick">
          <div class="progress-bar-fill" :style="{ width: `${percent}%` }"></div>
        </div>
        <div class="time-row">
          <span>{{ formatTime(currentTime) }}</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
      </div>

      <div class="controls">
        <button class="btn btn-mode" @click="handleNextMode" title="切换模式">
          <span>{{ modeIcons[playMode] }}</span>
        </button>
        <button class="btn btn-skip" @click="prev" title="上一首">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        <button class="btn btn-play" @click="toggle" title="播放 / 暂停">
          <svg v-if="isPlaying" width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          <svg v-else width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button class="btn btn-skip" @click="next" title="下一首">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>
    </div>

    <div class="playlist-card">
      <div class="playlist-title">待播列表（自带 12s 免版权测试曲，快速测试连播）</div>
      <div
        v-for="(t, idx) in DEMO_TRACKS"
        :key="t.id"
        :class="['track-item', idx === queueIndex ? 'current' : '']"
        @click="playIndex(idx)"
      >
        <div>
          <div class="track-item-title">{{ t.title }}</div>
          <div class="track-item-artist">{{ t.artist }}</div>
        </div>
        <span class="track-item-dur">{{ formatTime(t.duration) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-wrapper { max-width: 440px; width: 100%; display: flex; flex-direction: column; gap: 20px; }
.header { text-align: center; }
.header h1 { font-size: 22px; font-weight: 700; }
.header p { font-size: 13px; color: #94a3b8; margin-top: 4px; }
.badge-container { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
.badge { font-size: 11px; padding: 4px 10px; border-radius: 9999px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; }
.badge.active { background: rgba(16, 185, 129, 0.15); border-color: #10b981; color: #34d399; }
.badge.holding { background: rgba(245, 158, 11, 0.2); border-color: #f59e0b; color: #fbbf24; }
.card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(20px); border-radius: 28px; padding: 24px; border: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; align-items: center; }
.cover-wrapper { width: 200px; height: 200px; border-radius: 24px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 12px 24px -6px rgba(99, 102, 241, 0.35); }
.cover-img { width: 100%; height: 100%; object-fit: cover; }
.track-info { text-align: center; width: 100%; }
.track-title { font-size: 20px; font-weight: 700; }
.track-artist { font-size: 14px; color: #94a3b8; margin-top: 4px; }
.lyric-box { margin-top: 14px; height: 44px; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 14px; color: #a5b4fc; font-weight: 500; }
.progress-area { width: 100%; margin-top: 16px; }
.progress-bar-bg { width: 100%; height: 6px; background: rgba(255, 255, 255, 0.12); border-radius: 9999px; cursor: pointer; position: relative; overflow: hidden; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #a855f7); border-radius: 9999px; transition: width 0.1s linear; }
.time-row { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-top: 8px; }
.controls { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 20px; }
.btn { background: none; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.btn-mode { font-size: 20px; }
.btn-play { width: 64px; height: 64px; background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 8px 20px -4px rgba(99, 102, 241, 0.35); }
.playlist-card { background: rgba(30, 41, 59, 0.7); border-radius: 20px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.08); }
.playlist-title { font-size: 14px; font-weight: 600; color: #94a3b8; margin-bottom: 12px; }
.track-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 12px; cursor: pointer; margin-bottom: 4px; }
.track-item.current { background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); }
.track-item-title { font-size: 14px; font-weight: 600; }
.track-item-artist { font-size: 12px; color: #94a3b8; }
.track-item-dur { font-size: 12px; color: #94a3b8; }
</style>
