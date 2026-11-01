# 🎧 PWA Audio Player (`pwa-audio-player`)

> **Universal PWA & Web Audio Engine** — Eliminates iOS WebKit lockscreen freeze-lock deadlocks, hardware decoder eviction, artwork disappearance, and AirPods pause/resume loops.

<p align="center">
  <a href="./README.md"><b>English</b></a> |
  <a href="./README.zh-CN.md"><b>简体中文</b></a> |
  <a href="./README.ja.md"><b>日本語</b></a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-pwa--audio--player.pages.dev-emerald.svg)](https://pwa-audio-player.pages.dev)
[![Frameworks](https://img.shields.io/badge/Frameworks-Vanilla%20%7C%20React%20%7C%20Vue%20%7C%20Svelte-brightgreen.svg)](#framework-demos)
[![iOS Support](https://img.shields.io/badge/iOS-16%20%7C%2017%20%7C%2018%2B-orange.svg)](#core-architecture)

---

## 💡 Why PWA Audio Player?

On iOS Mobile Safari and standalone PWAs, using HTML5 `<audio>` for lockscreen playback has long been plagued by low-level WebKit quirks and CoreAudio power-saving behaviors:

| Pitfall | Trigger Scenario | Underlying Cause | Typical Player Behavior | PWA Player (Single-Track Silent Hold) |
| :--- | :--- | :--- | :--- | :--- |
| **Freeze-Lock Deadlock** | Paused on lockscreen for >15 seconds, then resume | iOS evicts the underlying **CoreAudio hardware decoder slot** to save power | Progress bar advances silently; time is frozen; no audio output | **✅ Instant millisecond audio recovery** |
| **Artwork Eviction** | Using `muted = true` for soft pauses | WebKit `canShowControlsManager()` strips NowPlaying privileges on mute | Lockscreen card disappears or is replaced by Apple Music | **✅ Metadata and artwork pinned permanently** |
| **AirPods Click Failures** | Pausing and resuming via AirPods stem click | During silent streams, iOS daemon emits inverted `action: "pause"` events | Taps are ignored or trigger pause-pause loops | **✅ Flip-Flop state machine for smooth wake-up** |
| **Track-Switch Stalls** | Auto-advancing tracks or skipping on lockscreen | Asynchronous `fetch()` calls invalidate the **User Gesture Context** | Track changes on UI but remains completely silent | **✅ Bidirectional adjacent preloading with sync switches** |
| **Seek Button Scrubbing** | Frequent calls in `timeupdate` | IPC flooding causes iOS to reset lockscreen controls to `«15 15»` seek buttons | Lockscreen loses prev/next track buttons | **✅ Enforces native ⏮ ⏯ ⏭ controls with event throttling** |

---

## 🛡️ Core Architecture: Single-Track Silent Hold

### Why don't dual-audio or Web Audio oscillators work?
- iOS assigns separate hardware decoder channels to distinct `HTMLMediaElement` instances. Calling `audio.pause()` on the primary element still causes CoreAudio to evict that channel after a few seconds.
- Web Audio API (`AudioContext`) is suspended by WebKit seconds after the display turns off.

### The Solution: Keep the Same Element Alive
```mermaid
stateDiagram-v2
    [*] --> PLAYING: User plays audio
    
    PLAYING --> SILENT_HOLD: User/Lockscreen/AirPods pauses
    note right of SILENT_HOLD
        1. Keep same <audio> element alive without calling audio.pause()
        2. Swap src to a 2s memory-generated silent WAV (loop=true)
        3. Maintain CoreAudio decoder slot and AVAudioSession active state
        4. Apply Triple-Lock contract:
           - playbackState = 'paused' (displays standard play icon)
           - Pin track artwork, title, and album metadata
           - Lock exact breakpoint time with setPositionState
    end note
    
    SILENT_HOLD --> PLAYING: Resume via lockscreen or AirPods
    note right of PLAYING
        1. Swap back to original track URL (loop=false)
        2. Precision seek back to breakpoint on playback start
        3. Instant millisecond audio recovery
    end note

    SILENT_HOLD --> HARD_PAUSED: Exceeds inactivity timeout (default 5m)
    note right of HARD_PAUSED
        Call native audio.pause() to surrender decoder
        and conserve device battery during long pauses
    end note
```

---

## 🎮 Framework Demos

A unified test suite is available under `examples/` with dedicated framework themes:

- **Hub Overview** (`:5170`): Cross-framework navigation and mobile testing guide.
- **Vanilla TS** (`:5173`): Pure DOM implementation, zero dependencies.
- **React 18 / 19** (`:5174`): Features the `usePwaPlayer` custom hook.
- **Vue 3** (`:5175`): Features the `usePwaPlayer` Composable with `shallowRef`.
- **Svelte 5** (`:5176`): Built on modern Svelte 5 Runes (`$state`, `$derived`).

### Running Demos Locally
```bash
git clone https://github.com/ajaxsys/pwa-audio-player.git
cd pwa-audio-player
pnpm install
pnpm dev:demos
```
Open `http://localhost:5170` or scan the terminal QR code with your iPhone on the same Wi-Fi.

---

## 🚀 Quick Start

### Installation
```bash
npm install pwa-audio-player
# or
pnpm add pwa-audio-player
```

### Basic Usage (TypeScript / Vanilla)
```typescript
import { createPwaPlayer } from 'pwa-audio-player';

const player = createPwaPlayer({
  initialQueue: [
    {
      id: 1,
      title: 'Neon Horizon',
      artist: 'Synthwave Echoes',
      album: 'Cyber Odyssey',
      src: 'https://example.com/audio1.mp3',
      artwork: 'https://example.com/cover1.jpg',
      duration: 180,
      lrc: '[00:00.00]Synthesizer starts...'
    }
  ],
  keepAlive: {
    strategy: 'auto',              // iOS enables silent-hold, other platforms standard pause
    hardPauseTimeoutMs: 5 * 60 * 1000 // Deep battery-saving pause after 5 minutes
  },
  preloadAdjacent: true,           // Safeguards user-gesture activation chain
  enableLockscreenLyrics: true     // Synchronizes lyrics to lockscreen MediaSession
});

// Controls
player.play();
player.toggle();
player.next();

// State subscription
const unsubscribe = player.subscribe((state) => {
  console.log('Playback state:', state.playbackState, 'Current time:', state.currentTime);
});
```

---

## 📱 iOS Testing Protocol

1. Start music playback on iPhone Safari, then press the power button to lock the device.
2. Verify that lockscreen artwork, synchronized lyrics, and ⏮ ⏭ skip controls are displayed.
3. Pause playback on the lockscreen or via AirPods stem press. Wait 20–30 seconds to allow the device to enter deep sleep.
4. Tap Play again: audio resumes instantly with zero position desynchronization or freeze-lock.
5. Allow a track to complete naturally to confirm uninterrupted background auto-advance.

---

## 📄 License

MIT License © 2026 [ajaxsys](https://github.com/ajaxsys)
