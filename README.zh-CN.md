# 🎧 PWA Audio Player (`pwa-audio-player`)

> **跨框架通用 PWA 音频播放器内核** — 彻底根治 iOS WebKit / Mobile Safari 锁屏后台暂停假走针死锁、硬件解码器回收、静音封面蒸发与 AirPods 反向按压难题。

<p align="center">
  <a href="./README.md"><b>English</b></a> |
  <a href="./README.zh-CN.md"><b>简体中文</b></a> |
  <a href="./README.ja.md"><b>日本語</b></a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![在线演示](https://img.shields.io/badge/在线演示-pwa--audio--player.pages.dev-emerald.svg)](https://pwa-audio-player.pages.dev)
[![Frameworks](https://img.shields.io/badge/Frameworks-Vanilla%20%7C%20React%20%7C%20Vue%20%7C%20Svelte-brightgreen.svg)](#framework-demos)
[![iOS Support](https://img.shields.io/badge/iOS-16%20%7C%2017%20%7C%2018%2B-orange.svg)](#core-architecture)

---

## 💡 为什么需要 PWA Audio Player？

在 iOS Mobile Safari 和 PWA（独立全屏模式 Standalone）中，使用标准 HTML5 `<audio>` 播放音乐一直存在几个令 Web 开发者痛苦万分的**系统级深水区顽疾**：

| 顽疾现象 | 触发场景 | 底层系统根因 | 传统播放器表现 | PWA Player (单轨静音保活) |
| :--- | :--- | :--- | :--- | :--- |
| **假走针死锁 (Fake Progress)** | 锁屏暂停超过 5~15 秒后再按播放 | iOS 为节电在 3~5 秒后单方面注销并回收该 `<audio>` 绑定的底层 **CoreAudio PCM 硬件解码槽** | UI 进度条往前空跑，耳机无声，`currentTime` 冻结 | **✅ 毫秒级瞬时出声恢复** |
| **锁屏封面歌名蒸发** | 暂停时使用 `muted = true` 试图软暂停 | WebKit 源码 `canShowControlsManager()` 命中静音硬拦截，当场剥夺 NowPlaying 资格 | 锁屏卡片直接消失被 Apple Music 顶替 | **✅ 保持原曲 Metadata 钉死不丢** |
| **AirPods 按压唤醒失效** | 耳机按压单击暂停后再按压播放 | 底层有发声流时，iOS 守护进程倾向下发反向 `action: "pause"` 导致死循环 | 怎么按都没有反应或越按越死 | **✅ 智能翻转状态机（Flip-Flop）顺滑唤醒** |
| **切歌/连播死锁** | 播放完自动下一首或锁屏点切歌 | 切歌时若经过 `await fetch()` 异步网络请求，**用户手势信任链（User Gesture Context）**瞬间失效，系统抛出 `NotAllowedError` | 锁屏切歌看似切了但完全无声 | **✅ 双向周边并发预热，零异步同步切换** |
| **锁屏跳秒键冲刷** | 熄屏控制中心 | 在 `timeupdate` 中每秒多次调用 `setPositionState`，导致跨进程 IPC 冲刷使系统重置回 `«15 15»` 跳秒布局 | 锁屏只能跳 15 秒，没有上一首/下一首 | **✅ 显式封死跳秒，低频事件驱动原生 ⏮ ⏯ ⏭ 音乐布局** |

---

## 🛡️ 核心技术架构：单轨静音换源保活 (Single-Track Silent Hold)

### 为什么“双音轨”或“Web Audio 振荡器”不管用？
- iOS 会为每一个独立的 `HTMLMediaElement` 实例分配专属的硬件解码通道。一旦主音频元素调用了 `audio.pause()`，即使副音轨在播放声音，主音轨对应的 CoreAudio 硬件解码器依然会在数秒后被系统单方面销毁；
- Web Audio API (`AudioContext`) 在屏幕熄灭数秒后会被 WebKit 强行挂起（`state -> suspended`）。

### PWA Player 的解决方案
保持**同一个 `<audio>` 实例永不调用 `pause()`**：

```mermaid
stateDiagram-v2
    [*] --> PLAYING: 用户播放歌曲
    
    PLAYING --> SILENT_HOLD: 用户/锁屏/耳机单击【暂停】
    note right of SILENT_HOLD
        1. 保持原 <audio> 实例，绝不调用 audio.pause()！
        2. 原 audio 换源至 2s 内存短静音 WAV (loop=true) 持续发声
        3. 锁住 CoreAudio 硬件解码槽与 AVAudioSession active 态
        4. 施加【三重隐形锁】：
           - playbackState = 'paused' (系统显示播放图标)
           - 钉死原曲 Metadata 封面与歌名
           - 钉死 setPositionState 毫秒断点进度
    end note
    
    SILENT_HOLD --> PLAYING: 锁屏点击【播放】或 AirPods 按压
    note right of PLAYING
        1. 换源回原曲流 URL，恢复 audio.loop = false
        2. audio.play() 成功后精准 seek 回断点
        3. 毫秒级无缝发声复苏
    end note

    SILENT_HOLD --> HARD_PAUSED: 超过 5 分钟超时（防久置耗电）
    note right of HARD_PAUSED
        主动调用原生 audio.pause()
        让渡系统硬件资源，进入节能休眠
    end note
```

---

## 🎮 多框架演示套件 (Demos)

在 `examples/` 目录下提供了完整的跨框架演示与专属主题：

- **Hub 导航中心** (`:5170`): 跨框架一览、局域网测试节点与测试指南。
- **Vanilla TS** (`:5173`): 琥珀金主题，纯原生 DOM，零第三方框架。
- **React 18 / 19** (`:5174`): 天空蓝主题，内置 `usePwaPlayer` 自定义 Hook。
- **Vue 3** (`:5175`): 翡翠绿主题，组合式 API 与 `shallowRef` 直连。
- **Svelte 5** (`:5176`): 焰火橙主题，基于 Svelte 5 Runes (`$state`, `$derived`) 实现。

### 本地启动演示
```bash
git clone https://github.com/ajaxsys/pwa-audio-player.git
cd pwa-audio-player
pnpm install
pnpm dev:demos
```
手机与电脑处于同一 Wi-Fi 时，直接扫描终端输出的二维码即可在真机 Safari 上体验。

---

## 🚀 快速上手

### 安装
```bash
npm install pwa-audio-player
# or
pnpm add pwa-audio-player
```

### 基础调用 (TypeScript / 原生)
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
    strategy: 'auto',              // iOS 下自动启用静音保活，其他系统走原生 Pause
    hardPauseTimeoutMs: 5 * 60 * 1000 // 5 分钟超时防耗电保活退避
  },
  preloadAdjacent: true,           // 双向预热周边音轨，保护 iOS 用户手势链
  enableLockscreenLyrics: true     // 同步锁屏 MediaSession 动态歌词
});

// 播放控制
player.play();
player.toggle();
player.next();

// 状态订阅
const unsubscribe = player.subscribe((state) => {
  console.log('播放状态:', state.playbackState, '当前进度:', state.currentTime);
});
```

---

## 📱 iOS 真机测试步骤

1. iPhone Safari 中点击播放，按电源键进入锁屏状态；
2. 检查锁屏界面是否正常展示高清封面、歌词与切歌按键；
3. 在锁屏卡片或通过 AirPods 按压暂停，等待 20~30 秒让系统进入深度睡眠；
4. 再次点击播放：毫秒级瞬时恢复出声，彻底消除假走针死锁；
5. 让歌曲自然完播，验证熄屏下链式连播是否稳定。

---

## 📄 开源许可

MIT License © 2026 [ajaxsys](https://github.com/ajaxsys)

