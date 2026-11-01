export type Lang = 'zh' | 'en' | 'ja';

export interface HubTranslations {
  badge: string;
  heroTitle: string;
  heroDesc: string;
  nodePrefix: string;
  vanillaDesc: string;
  reactDesc: string;
  vueDesc: string;
  svelteDesc: string;
  btnEnter: string;
  testingGuideTitle: string;
  guideItem1Title: string;
  guideItem1Desc: string;
  guideItem2Title: string;
  guideItem2Desc: string;
  guideItem3Title: string;
  guideItem3Desc: string;
  footerNote: string;
}

export interface DemoTranslations {
  title: string;
  subtitle: string;
  badgeIosReady: string;
  badgeDesktop: string;
  badgeSilentHold: string;
  badgeStatus: string;
  stateIdle: string;
  lyricDefault: string;
  lyricPlaying: string;
  playlistTitle: string;
  guideTitle: string;
  guideStep1: string;
  guideStep2: string;
  guideStep3: string;
  guideStep4: string;
  guideStep5: string;
  backToHub: string;
}

export const HUB_I18N: Record<Lang, HubTranslations> = {
  zh: {
    badge: 'PWA Player · 全框架套件',
    heroTitle: '纯粹音质，无缝锁屏',
    heroDesc: '根治 iOS Safari 假走针死锁与锁屏后台断流的标准 Web 音频引擎',
    nodePrefix: '本地节点',
    vanillaDesc: '零框架依赖，极简纯粹，展示核心 API 调用与事件总线直连',
    reactDesc: '优雅的 usePwaPlayer Hook，响应式精准重绘与无缝状态流',
    vueDesc: '组合式 API 深度调优，基于 shallowRef 实现轻量直连',
    svelteDesc: '全新 Svelte 5 Runes ($state, $derived) 极致精简与单例守护',
    btnEnter: '进入演示',
    testingGuideTitle: 'iOS PWA 核心验证指南',
    guideItem1Title: '免版权试听音轨',
    guideItem1Desc: '内置 3 首无版权高品质音乐（12~14秒），纯前端离线立即可播。',
    guideItem2Title: '链式平滑连播',
    guideItem2Desc: '点击播放后关闭屏幕，首曲播完后无感自动切歌，用户激活链长效保持。',
    guideItem3Title: '静音硬件保活 (Silent-Hold)',
    guideItem3Desc: '锁屏暂停静置 20~30 秒待硬件进入深度休眠，轻点即可瞬时复播，彻底消除假走针。',
    footerNote: '基于 W3C MediaSession 标准与 Web Audio API'
  },
  en: {
    badge: 'PWA Player Suite',
    heroTitle: 'Unbroken Audio, True Lockscreen Control',
    heroDesc: 'Eliminate iOS Safari freeze-lock deadlocks and background stutters with standard MediaSession engineering',
    nodePrefix: 'Node',
    vanillaDesc: 'Zero dependencies, native DOM, direct API and event bus integration',
    reactDesc: 'Elegant usePwaPlayer Hook with fine-grained reactive state flow',
    vueDesc: 'Composition API optimized with shallowRef for lightweight direct binding',
    svelteDesc: 'Svelte 5 Runes ($state, $derived) with singleton audio guardian',
    btnEnter: 'Open Demo',
    testingGuideTitle: 'iOS PWA Testing Protocol',
    guideItem1Title: 'Built-in Royalty-Free Tracks',
    guideItem1Desc: 'Bundles 3 royalty-free audio tracks (12~14s) for immediate offline verification.',
    guideItem2Title: 'Unbroken Chain Playback',
    guideItem2Desc: 'Press play and lock screen. Seamless auto-advancement maintains activation chain.',
    guideItem3Title: 'Hardware Silent-Hold',
    guideItem3Desc: 'Pause on lockscreen and wait 20~30s during sleep. Instant recovery without freeze.',
    footerNote: 'Built on W3C MediaSession standard & Web Audio API'
  },
  ja: {
    badge: 'PWA Player · デモ一覧',
    heroTitle: '途切れない再生、確実なロック画面操作',
    heroDesc: 'iOS Safari 特有のプログレス停止（擬似シーク固まり）やスリープ時の音途切れを解消する Web オーディオエンジン',
    nodePrefix: '接続ノード',
    vanillaDesc: 'フレームワーク不使用のピュア DOM 実装。コア API とイベント連携の基本形',
    reactDesc: 'usePwaPlayer カスタムフックによる、無駄のないリアクティブな状態制御',
    vueDesc: 'Vue 3 Composition API 対応。shallowRef を用いた軽量バインディング',
    svelteDesc: 'Svelte 5 Runes（$state / $derived）による軽快な状態同期と単一オーディオ保護',
    btnEnter: 'デモを開く',
    testingGuideTitle: 'iOS PWA 動作検証ステップ',
    guideItem1Title: '動作確認用フリー音源',
    guideItem1Desc: '約12〜14秒のオリジナル曲を3曲収録。オフラインですぐに試せます。',
    guideItem2Title: '画面消灯時の自動連続再生',
    guideItem2Desc: '再生中に画面をロックしても、曲が終わると自動で次の曲へスムーズに遷移します。',
    guideItem3Title: '無音キープ（Silent-Hold）機能',
    guideItem3Desc: 'ロック画面で一時停止後、端末が完全スリープ（20〜30秒）に入っても、タップひとつで即座に再生が再開します。',
    footerNote: 'W3C MediaSession 標準仕様 & Web Audio API 準拠'
  }
};

export const DEMO_I18N: Record<Lang, DemoTranslations> = {
  zh: {
    title: 'PWA 音频播控引擎',
    subtitle: 'iOS 锁屏硬件保活与标准 MediaSession 原生音乐播放器',
    badgeIosReady: 'iOS Safari (单轨静音保活)',
    badgeDesktop: '桌面 / Android (原生 Pause)',
    badgeSilentHold: '硬件保活: 静音保持中',
    badgeStatus: '状态',
    stateIdle: '就绪',
    lyricDefault: '♪ 沉浸式锁屏歌词同步 ♪',
    lyricPlaying: '♪ 正在播放 ♪',
    playlistTitle: '测试音乐清单 (12~14秒，快速验证后台连播)',
    guideTitle: 'iOS 锁屏与熄屏恢复验证指南',
    guideStep1: '点击播放音乐，按 iPhone 电源键熄屏进入锁屏；',
    guideStep2: '锁屏卡片可查看封面、歌词与标准切歌按键；',
    guideStep3: '锁屏点【暂停】或按压 AirPods，静置 20~30 秒使硬件进入休眠；',
    guideStep4: '再次轻点【播放】：毫秒级瞬时出声恢复，彻底消除假走针死锁；',
    guideStep5: '让 12 秒歌曲自然播完，验证熄屏下链式自动连播。',
    backToHub: '← 返回导航总览'
  },
  en: {
    title: 'PWA Audio Engine',
    subtitle: 'iOS Lockscreen Hardware Keep-Alive & MediaSession Native Controls',
    badgeIosReady: 'iOS Safari (Silent-Hold Active)',
    badgeDesktop: 'Desktop / Android (Standard Pause)',
    badgeSilentHold: 'Keep-Alive: Silent-Holding',
    badgeStatus: 'Status',
    stateIdle: 'READY',
    lyricDefault: '♪ Lockscreen Lyric Sync ♪',
    lyricPlaying: '♪ Now Playing ♪',
    playlistTitle: 'Test Playlist (12~14s per track, instant loop check)',
    guideTitle: 'iOS Lockscreen Verification Guide',
    guideStep1: 'Start playback and press the power button to enter lockscreen;',
    guideStep2: 'Inspect lockscreen artwork, synchronized lyrics, and track controls;',
    guideStep3: 'Press Pause or tap AirPods, wait 20~30s for device deep sleep;',
    guideStep4: 'Tap Play again: instant audio resume with zero deadlock or position desync;',
    guideStep5: 'Allow the short track to finish naturally to test seamless auto-advance.',
    backToHub: '← Hub Overview'
  },
  ja: {
    title: 'PWA オーディオエンジン',
    subtitle: 'iOS ロック画面バックグラウンド維持 & MediaSession 連携',
    badgeIosReady: 'iOS Safari（無音キープ有効）',
    badgeDesktop: 'PC / Android（通常一時停止）',
    badgeSilentHold: 'バックグラウンド保持中',
    badgeStatus: '状態',
    stateIdle: '待機中',
    lyricDefault: '♪ ロック画面 歌詞同期対応 ♪',
    lyricPlaying: '♪ 再生中 ♪',
    playlistTitle: 'テスト音源（各12〜14秒・自動送り確認用）',
    guideTitle: 'iOS ロック画面・スリープ復帰の検証手順',
    guideStep1: '曲を再生し、電源ボタンを押して画面をロックします。',
    guideStep2: 'ロック画面上にアートワーク・同期歌詞・スキップ操作が表示されます。',
    guideStep3: 'ロック画面やAirPodsで一時停止し、20〜30秒ほど待って深いスリープに入れます。',
    guideStep4: '再度再生ボタンを押すと、秒針が固まることなく即座に音が鳴り始めます。',
    guideStep5: '曲が終了した際、画面が消灯したまま次の曲へ自動で進むことを確認してください。',
    backToHub: '← デモ一覧へ戻る'
  }
};

const STORAGE_KEY = 'pwa_player_preferred_lang';

export function detectBrowserLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && (saved === 'zh' || saved === 'en' || saved === 'ja')) {
      return saved;
    }
  } catch {}

  const navLangs = navigator.languages || [navigator.language || 'en'];
  for (const lang of navLangs) {
    const l = lang.toLowerCase();
    if (l.startsWith('zh')) return 'zh';
    if (l.startsWith('ja')) return 'ja';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

export function savePreferredLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
}
