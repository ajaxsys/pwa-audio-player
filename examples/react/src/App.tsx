import React from 'react';
import { usePwaPlayer } from './usePwaPlayer';
import { platform, type PlayMode } from '@pwa-player/core';
import { DEMO_TRACKS } from '../../../demo-assets/demoTracks';

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

export default function App() {
  const { state, toggle, prev, next, seek, setMode, playIndex } = usePwaPlayer({
    initialQueue: DEMO_TRACKS,
    initialIndex: 0,
    initialMode: 'loop',
    keepAlive: { strategy: 'auto', hardPauseTimeoutMs: 5 * 60 * 1000 },
    preloadAdjacent: true,
    enforceTrackNavigation: true,
    enableLockscreenLyrics: true
  });

  const { currentTrack, isPlaying, isHolding, currentTime, duration, queueIndex, playMode } = state;

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleNextMode = () => {
    const modes: PlayMode[] = ['loop', 'sequence', 'shuffle', 'single'];
    const curIdx = modes.indexOf(playMode);
    setMode(modes[(curIdx + 1) % modes.length]);
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (duration > 0) {
      seek(ratio * duration);
    }
  };

  return (
    <div style={{ maxWidth: 440, width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>PWA Player · React Demo</h1>
        <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
          iOS 锁屏硬件保活与标准 MediaSession 播放器 (React Hook)
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, padding: '4px 10px', borderRadius: 9999,
          background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399'
        }}>
          {platform.isIOS ? '📱 iOS Safari (单轨静音保活已就绪)' : '💻 桌面/Android (原生 Pause)'}
        </span>
        <span style={{
          fontSize: 11, padding: '4px 10px', borderRadius: 9999,
          background: isHolding ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)',
          border: `1px solid ${isHolding ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
          color: isHolding ? '#fbbf24' : '#94a3b8'
        }}>
          {isHolding ? '🛡️ 硬件保活: 静音保持中 (Silent-Hold)' : `状态: ${state.playbackState.toUpperCase()}`}
        </span>
      </div>

      <div style={{
        background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(20px)',
        borderRadius: 28, padding: 24, border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        <div style={{
          width: 200, height: 200, borderRadius: 24, overflow: 'hidden',
          marginBottom: 20, boxShadow: '0 12px 24px -6px rgba(99, 102, 241, 0.35)'
        }}>
          <img
            src={typeof currentTrack?.artwork === 'string' ? currentTrack.artwork : ''}
            alt="Artwork"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{currentTrack?.title || 'No Track'}</div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
            {currentTrack?.artist} - {currentTrack?.album}
          </div>
        </div>

        <div style={{
          marginTop: 14, height: 44, display: 'flex', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', fontSize: 14,
          color: '#a5b4fc', fontWeight: 500
        }}>
          {state.activeLyricText || (isPlaying ? '♪ 正在播放 ♪' : '♪ 点击播放测试锁屏 ♪')}
        </div>

        <div style={{ width: '100%', marginTop: 16 }}>
          <div
            onClick={handleSeekClick}
            style={{
              width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.12)',
              borderRadius: 9999, cursor: 'pointer', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{
              height: '100%', width: `${percent}%`,
              background: 'linear-gradient(90deg, #6366f1, #a855f7)',
              borderRadius: 9999, transition: 'width 0.1s linear'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 20 }}>
          <button
            onClick={handleNextMode}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}
            title="切换播放模式"
          >
            {modeIcons[playMode]}
          </button>
          <button
            onClick={prev}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
            title="上一首"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button
            onClick={toggle}
            style={{
              width: 64, height: 64, borderRadius: '50%', border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.35)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            title="播放 / 暂停"
          >
            {isPlaying ? (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          <button
            onClick={next}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
            title="下一首"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
        </div>
      </div>

      <div style={{
        background: 'rgba(30, 41, 59, 0.7)', borderRadius: 20, padding: 16,
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>
          待播列表（自带 12s 免版权测试曲，快速测试连播）
        </div>
        {DEMO_TRACKS.map((t, idx) => (
          <div
            key={t.id}
            onClick={() => playIndex(idx)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
              marginBottom: 4,
              background: idx === queueIndex ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: idx === queueIndex ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent'
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.artist}</div>
            </div>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatTime(t.duration)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
