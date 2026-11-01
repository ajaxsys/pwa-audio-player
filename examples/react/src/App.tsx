import React, { useState, useEffect } from 'react';
import { usePwaPlayer } from './usePwaPlayer';
import { platform, type PlayMode } from '@pwa-player/core';
import { DEMO_TRACKS } from '../../../demo-assets/demoTracks';
import { DEMO_I18N, detectBrowserLang, savePreferredLang, type Lang } from '../../../demo-assets/i18n';
import '../../../demo-assets/player-shared.css';

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
  const [lang, setLang] = useState<Lang>(() => detectBrowserLang());

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
  const t = DEMO_I18N[lang] || DEMO_I18N.en;

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en';
  }, [lang]);

  const handleLangChange = (newLang: Lang) => {
    setLang(newLang);
    savePreferredLang(newLang);
  };

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

  const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
  const protocol = typeof window !== 'undefined' ? (window.location.protocol || 'http:') : 'http:';
  const hubUrl = `${protocol}//${host}:5170`;

  return (
    <div className="player-container" data-theme="react">
      {/* Top Nav */}
      <div className="top-nav">
        <a href={hubUrl} className="back-link">
          {t.backToHub}
        </a>
        <div className="lang-switcher">
          <button
            className={`lang-btn ${lang === 'zh' ? 'active' : ''}`}
            onClick={() => handleLangChange('zh')}
          >
            中文
          </button>
          <button
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => handleLangChange('en')}
          >
            EN
          </button>
          <button
            className={`lang-btn ${lang === 'ja' ? 'active' : ''}`}
            onClick={() => handleLangChange('ja')}
          >
            日本語
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="player-header">
        <h1>PWA Player · React</h1>
        <p>{t.subtitle}</p>
      </div>

      {/* Badges */}
      <div className="badge-container">
        <span className="badge active">
          {platform.isIOS ? `📱 ${t.badgeIosReady}` : `💻 ${t.badgeDesktop}`}
        </span>
        <span className={`badge ${isHolding ? 'holding' : ''}`}>
          {isHolding
            ? `🛡️ ${t.badgeSilentHold}`
            : `${t.badgeStatus}: ${state.playbackState.toUpperCase()}`}
        </span>
      </div>

      {/* Player Card */}
      <div className="player-card">
        <div className="cover-wrapper">
          <img
            src={typeof currentTrack?.artwork === 'string' ? currentTrack.artwork : ''}
            alt="Artwork"
            className="cover-img"
          />
        </div>

        <div className="track-info">
          <div className="track-title">{currentTrack?.title || 'No Track'}</div>
          <div className="track-artist">
            {currentTrack?.artist} - {currentTrack?.album}
          </div>
        </div>

        <div className="lyric-box">
          {state.activeLyricText || (isPlaying ? t.lyricPlaying : t.lyricDefault)}
        </div>

        <div className="progress-area">
          <div className="progress-bar-bg" onClick={handleSeekClick}>
            <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="time-row">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="controls">
          <button className="btn btn-mode" onClick={handleNextMode} title="切换播放模式">
            {modeIcons[playMode]}
          </button>
          <button className="btn btn-skip" onClick={prev} title="上一首">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          <button className="btn btn-play" onClick={toggle} title="播放 / 暂停">
            {isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          <button className="btn btn-skip" onClick={next} title="下一首">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Playlist */}
      <div className="playlist-card">
        <div className="playlist-title">{t.playlistTitle}</div>
        {DEMO_TRACKS.map((track, idx) => (
          <div
            key={track.id}
            onClick={() => playIndex(idx)}
            className={`track-item ${idx === queueIndex ? 'current' : ''}`}
          >
            <div className="track-item-left">
              <span className="track-item-title">{track.title}</span>
              <span className="track-item-artist">{track.artist}</span>
            </div>
            <span className="track-item-dur">{formatTime(track.duration)}</span>
          </div>
        ))}
      </div>

      {/* Testing Guide */}
      <div className="guide-box">
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
  );
}
