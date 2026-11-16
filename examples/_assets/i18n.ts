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
  wcoDesc: string;
  btnEnter: string;
  testingGuideTitle: string;
  guideItem1Title: string;
  guideItem1Desc: string;
  guideItem2Title: string;
  guideItem2Desc: string;
  guideItem3Title: string;
  guideItem3Desc: string;
  guideItem4Title: string;
  guideItem4Desc: string;
  footerNote: string;
}

export interface DemoTranslations {
  title: string;
  subtitle: string;
  badgeIosReady: string;
  badgeDesktop: string;
  badgeSilentHold: string;
  badgeRecovering: string;
  badgePrecached: string;
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
  guideStep6: string;
  backToHub: string;
}

export interface WcoTranslations {
  pageTitle: string;
  btnBack: string;
  btnInstall: string;
  wcoActive: string;
  wcoIdle: string;
  wcoPreview: string;

  // Telemetry Card
  heroTitle: string;
  heroDesc: string;
  chkForcePreview: string;
  chkSimCutouts: string;
  metricMode: string;
  metricModeActive: string;
  metricModeInactive: string;
  metricEngine: string;
  metricEngineBroken: string;
  metricEngineFeathering: string;
  metricEngineBypassed: string;
  metricGeometry: string;
  metricThemeColor: string;
  metricBackdrops: string;

  // Section 1: Solid Background
  sec1Title: string;
  customColorLabel: string;
  swatchPureLight: string;
  swatchWarmCream: string;
  swatchSakura: string;
  swatchSkyBlue: string;
  swatchEmerald: string;
  swatchMidnight: string;
  swatchSunset: string;

  // Section 2: Media Background
  sec2Title: string;
  btnExitMedia: string;
  btnUploadMedia: string;
  presetWarmWood: string;
  presetGoldenSunset: string;
  presetSplitContrast: string;
  presetOceanNight: string;
  labelDim: string;
  labelBlur: string;
  chkBrokenMode: string;

  // Section 3: Modals / Drawers
  sec3Title: string;
  sec3Desc: string;
  btnOpenModal: string;
  btnOpenDrawer: string;
  btnOpenSheet: string;
  labelScrimAlpha: string;
  labelScrimColor: string;

  // Modals content
  titleModal: string;
  titleDrawer: string;
  titleSheet: string;
  modalDesc: string;
  btnOpenNested: string;
  btnClose: string;
  titleNested: string;
  nestedDesc: string;
  btnCloseNested: string;
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
    wcoDesc: '可安装桌面 WCO PWA 试验场：自由测试背景色、全屏图片/视频取色与多层 Modal 顶角融合',
    btnEnter: '进入演示',
    testingGuideTitle: 'iOS PWA 核心验证指南',
    guideItem1Title: '免版权试听音轨',
    guideItem1Desc: '内置 3 首无版权高品质音乐（12~14秒），纯前端离线立即可播。',
    guideItem2Title: '链式平滑连播',
    guideItem2Desc: '点击播放后关闭屏幕，首曲播完后无感自动切歌，用户激活链长效保持。',
    guideItem3Title: '静音硬件保活 (Silent-Hold)',
    guideItem3Desc: '锁屏暂停静置 20~30 秒待硬件进入深度休眠，轻点即可瞬时复播，彻底消除假走针。',
    guideItem4Title: '次曲预缓存与断点自愈',
    guideItem4Desc: '播放中静默预读下一曲写入 CacheStorage 内存 blob；被导航或来电打断后自动探测恢复，坏链自动跳过。',
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
    wcoDesc: 'Installable desktop WCO PWA lab: test dynamic background colors, media top-edge sampling & stacked modals',
    btnEnter: 'Open Demo',
    testingGuideTitle: 'iOS PWA Testing Protocol',
    guideItem1Title: 'Built-in Royalty-Free Tracks',
    guideItem1Desc: 'Bundles 3 royalty-free audio tracks (12~14s) for immediate offline verification.',
    guideItem2Title: 'Unbroken Chain Playback',
    guideItem2Desc: 'Press play and lock screen. Seamless auto-advancement maintains activation chain.',
    guideItem3Title: 'Hardware Silent-Hold',
    guideItem3Desc: 'Pause on lockscreen and wait 20~30s during sleep. Instant recovery without freeze.',
    guideItem4Title: 'Next-Track Precache & Focus Recovery',
    guideItem4Desc: 'Pre-stages the next track into CacheStorage blob memory while playing, recovers from OS interruptions, and skips broken streams.',
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
    wcoDesc: 'デスクトップ PWA (WCO) 実験場：背景色・全画面画像/動画の自動配色・多層モーダルを即座に検証',
    btnEnter: 'デモを開く',
    testingGuideTitle: 'iOS PWA 動作検証ステップ',
    guideItem1Title: '動作確認用フリー音源',
    guideItem1Desc: '約12〜14秒のオリジナル曲を3曲収録。オフラインですぐに試せます。',
    guideItem2Title: '画面消灯時の自動連続再生',
    guideItem2Desc: '再生中に画面をロックしても、曲が終わると自動で次の曲へスムーズに遷移します。',
    guideItem3Title: '無音キープ（Silent-Hold）機能',
    guideItem3Desc: 'ロック画面で一時停止後、端末が完全スリープ（20〜30秒）に入っても、タップひとつで即座に再生が再開します。',
    guideItem4Title: '次曲プリキャッシュ & 自動復帰',
    guideItem4Desc: '再生中に次曲を CacheStorage とメモリ blob へ先読みし、ナビ音声や通話割り込み後の自動復帰とエラー曲スキップを行います。',
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
    badgeRecovering: '音频焦点恢复中',
    badgePrecached: '下一曲已预缓存',
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
    guideStep5: '让 12 秒歌曲自然播完，验证熄屏下链式自动连播；',
    guideStep6: '播放时留意「下一曲已预缓存」徽标，并可测试语音播报/切后台打断后的自动复播。',
    backToHub: '← 返回导航总览'
  },
  en: {
    title: 'PWA Audio Engine',
    subtitle: 'iOS Lockscreen Hardware Keep-Alive & MediaSession Native Controls',
    badgeIosReady: 'iOS Safari (Silent-Hold Active)',
    badgeDesktop: 'Desktop / Android (Standard Pause)',
    badgeSilentHold: 'Keep-Alive: Silent-Holding',
    badgeRecovering: 'Recovering Audio Focus',
    badgePrecached: 'Next Track Precached',
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
    guideStep5: 'Allow the short track to finish naturally to test seamless auto-advance;',
    guideStep6: 'Watch the "Next Track Precached" badge during playback and verify automatic resume after OS interruptions.',
    backToHub: '← Hub Overview'
  },
  ja: {
    title: 'PWA オーディオエンジン',
    subtitle: 'iOS ロック画面バックグラウンド維持 & MediaSession 連携',
    badgeIosReady: 'iOS Safari（無音キープ有効）',
    badgeDesktop: 'PC / Android（通常一時停止）',
    badgeSilentHold: 'バックグラウンド保持中',
    badgeRecovering: 'フォーカス復帰中',
    badgePrecached: '次曲プリキャッシュ済',
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
    guideStep6: '再生中に「次曲プリキャッシュ済」表示を確認し、音声割り込み後の自動再生復帰も検証できます。',
    backToHub: '← デモ一覧へ戻る'
  }
};

export const WCO_I18N: Record<Lang, WcoTranslations> = {
  zh: {
    pageTitle: 'WCO 顶角无缝融合实验室 · pwa-audio-player',
    btnBack: '← 返回 Hub',
    btnInstall: '＋ 安装 PWA',
    wcoActive: 'WCO 激活中',
    wcoIdle: '浏览器 Tab · 0ms 休眠',
    wcoPreview: '预览模式',

    heroTitle: 'WCO Corner Harmony Lab',
    heroDesc: '安装为 Chrome Desktop PWA 后点击右上角 <code>⌄ / ^</code> 开启 WCO，自由切换纯色、自定义图片/视频、多层 Modal 遮罩观察顶角实时无缝融合；非 WCO 模式下自动休眠零开销。',
    chkForcePreview: '浏览器 Tab 强制预览渐变',
    chkSimCutouts: '模拟原生 WCO 黑框对照',
    metricMode: 'WCO 窗口模式',
    metricModeActive: '已激活 (原生 WCO)',
    metricModeInactive: '未激活',
    metricEngine: '顶角融合引擎',
    metricEngineBroken: '旧版缺陷模拟',
    metricEngineFeathering: '运行中 (羽化采样)',
    metricEngineBypassed: '已旁路 (0ms 休眠)',
    metricGeometry: '边距 (左 / 右 / 高度)',
    metricThemeColor: 'meta[theme-color]',
    metricBackdrops: '遮罩引用计数',

    sec1Title: '1. 背景色切换测试 (Theme & 自定义取色)',
    customColorLabel: '自定义取色:',
    swatchPureLight: '纯净亮白',
    swatchWarmCream: '暖米白',
    swatchSakura: '樱花粉',
    swatchSkyBlue: '天青蓝',
    swatchEmerald: '祖母绿',
    swatchMidnight: '深邃夜空',
    swatchSunset: '落日橙',

    sec2Title: '2. 自定义图片 / 视频背景测试 (顶角取色 + 实心核覆盖)',
    btnExitMedia: '退出媒体背景',
    btnUploadMedia: '上传本地图片/视频',
    presetWarmWood: '🪵 暖木米白百叶窗',
    presetGoldenSunset: '🌅 琥珀落日',
    presetSplitContrast: '🌓 左亮右暗极端分割',
    presetOceanNight: '🌊 深海极光',
    labelDim: '压暗系数',
    labelBlur: '模糊',
    chkBrokenMode: '模拟旧版缺陷 (固定 #0a0e1a + 30% 透明，对比大门牙)',

    sec3Title: '3. 各种 Modal / Drawer / 嵌套遮罩测试',
    sec3Desc: '打开浮层后，WCO 顶角会按遮罩颜色与透明度物理混色，消除两端漏光或死黑断层；嵌套弹窗关闭内层时不提前恢复。',
    btnOpenModal: '打开居中 Modal',
    btnOpenDrawer: '打开右侧 Drawer',
    btnOpenSheet: '打开底部 Sheet',
    labelScrimAlpha: '遮罩透明度',
    labelScrimColor: '遮罩底色:',

    titleModal: '居中 Modal',
    titleDrawer: '右侧 Slide-Over Drawer',
    titleSheet: '底部 Sheet',
    modalDesc: '观察顶部左右 WCO 控制区：其底色已实时按背景色 + 当前遮罩色与透明度混色对齐，无矩形色差边界。',
    btnOpenNested: '打开嵌套第二层 Modal',
    btnClose: '关闭',
    titleNested: '嵌套弹窗 (第 2 层)',
    nestedDesc: '当前 Backdrop 引用计数为 2。关闭此内层弹窗后，外层遮罩仍处于激活状态，顶栏不会闪烁恢复原色。',
    btnCloseNested: '关闭内层 Modal'
  },
  en: {
    pageTitle: 'WCO Corner Harmony Lab · pwa-audio-player',
    btnBack: '← Hub',
    btnInstall: '＋ Install PWA',
    wcoActive: 'WCO Active',
    wcoIdle: 'Browser Tab · 0ms Idle',
    wcoPreview: 'Preview Mode',

    heroTitle: 'WCO Corner Harmony Lab',
    heroDesc: 'Install as Chrome Desktop PWA and toggle <code>⌄ / ^</code> top-right for WCO. Test solid colors, full-bleed media sampling, and stacked modals for seamless corner blending. Sleeps with zero overhead outside WCO mode.',
    chkForcePreview: 'Force preview gradient in browser tab',
    chkSimCutouts: 'Simulate native WCO cutouts',
    metricMode: 'WCO Display Mode',
    metricModeActive: 'Active (Native WCO)',
    metricModeInactive: 'Inactive',
    metricEngine: 'Corner Engine',
    metricEngineBroken: 'Legacy Broken Sim',
    metricEngineFeathering: 'Active (Feathering)',
    metricEngineBypassed: 'Bypassed (0ms Idle)',
    metricGeometry: 'Rect (L / R / H)',
    metricThemeColor: 'meta[theme-color]',
    metricBackdrops: 'Backdrop Stack',

    sec1Title: '1. Background Color Torture Test (Theme & Custom Picker)',
    customColorLabel: 'Custom Color:',
    swatchPureLight: 'Pure Light',
    swatchWarmCream: 'Warm Cream',
    swatchSakura: 'Sakura',
    swatchSkyBlue: 'Sky Blue',
    swatchEmerald: 'Emerald',
    swatchMidnight: 'Midnight',
    swatchSunset: 'Sunset',

    sec2Title: '2. Full-Bleed Image / Video Torture Test (Top-Edge Sampling & Solid Core)',
    btnExitMedia: 'Exit Media Background',
    btnUploadMedia: 'Upload Local Image / Video',
    presetWarmWood: '🪵 Warm Wood Blinds',
    presetGoldenSunset: '🌅 Amber Sunset',
    presetSplitContrast: '🌓 Split Bright / Dark',
    presetOceanNight: '🌊 Abyssal Aurora',
    labelDim: 'Dim Overlay',
    labelBlur: 'Blur',
    chkBrokenMode: 'Simulate Legacy Flaw (Fixed #0a0e1a + 30% alpha gap)',

    sec3Title: '3. Modals / Drawers / Nested Stack Test',
    sec3Desc: 'When modals open, WCO corners physically blend the scrim color & opacity to eliminate light leakage or dark banding; nested modals do not prematurely reset on inner dismissal.',
    btnOpenModal: 'Open Centered Modal',
    btnOpenDrawer: 'Open Right Drawer',
    btnOpenSheet: 'Open Bottom Sheet',
    labelScrimAlpha: 'Scrim Opacity',
    labelScrimColor: 'Scrim Base Color:',

    titleModal: 'Centered Modal',
    titleDrawer: 'Slide-Over Drawer',
    titleSheet: 'Bottom Sheet',
    modalDesc: 'Observe the top left & right WCO controls: background color is blended in real time with the current scrim color & opacity, eliminating rectangular seams.',
    btnOpenNested: 'Open Nested Layer 2 Modal',
    btnClose: 'Close',
    titleNested: 'Nested Modal (Layer 2)',
    nestedDesc: 'Current backdrop reference count is 2. Dismissing this inner modal leaves the outer scrim active, preventing top bar color flicker.',
    btnCloseNested: 'Close Inner Modal'
  },
  ja: {
    pageTitle: 'WCO コーナーハーモニー実験場 · pwa-audio-player',
    btnBack: '← デモ一覧',
    btnInstall: '＋ PWAをインストール',
    wcoActive: 'WCO 有効',
    wcoIdle: 'ブラウザタブ · 0ms 休眠',
    wcoPreview: 'プレビューモード',

    heroTitle: 'WCO コーナーハーモニー実験場',
    heroDesc: 'Chrome デスクトップ PWA としてインストール後、右上の <code>⌄ / ^</code> で WCO を有効化。単色、画像/動画の端部サンプリング、モーダル重なり時の頂角リアルタイム融合を検証可能。非 WCO 時は完全休眠・オーバーヘッドゼロ。',
    chkForcePreview: 'ブラウザタブでグラデーション強制プレビュー',
    chkSimCutouts: 'ネイティブ WCO 枠をシミュレート',
    metricMode: 'WCO 表示モード',
    metricModeActive: '有効 (ネイティブ WCO)',
    metricModeInactive: '無効',
    metricEngine: 'コーナー融合エンジン',
    metricEngineBroken: '旧実装の欠陥シミュレート',
    metricEngineFeathering: '稼働中 (フェザリング)',
    metricEngineBypassed: 'バイパス済 (0ms 休眠)',
    metricGeometry: '矩形領域 (左 / 右 / 高さ)',
    metricThemeColor: 'meta[theme-color]',
    metricBackdrops: 'モーダル重なり数',

    sec1Title: '1. 背景色切替テスト (テーマ & カスタムピッカー)',
    customColorLabel: 'カスタム色:',
    swatchPureLight: 'ピュアホワイト',
    swatchWarmCream: 'ウォームクリーム',
    swatchSakura: '桜ピンク',
    swatchSkyBlue: 'スカイブルー',
    swatchEmerald: 'エメラルド',
    swatchMidnight: 'ミッドナイト',
    swatchSunset: 'サンセット',

    sec2Title: '2. 画像 / 動画背景テスト (頂角サンプリング + ソリッドコア)',
    btnExitMedia: 'メディア背景を解除',
    btnUploadMedia: '画像 / 動画をアップロード',
    presetWarmWood: '🪵 暖木ブラインド',
    presetGoldenSunset: '🌅 琥珀色の夕日',
    presetSplitContrast: '🌓 左右明暗分割',
    presetOceanNight: '🌊 深海オーロラ',
    labelDim: '減光オーバーレイ',
    labelBlur: 'ぼかし',
    chkBrokenMode: '旧実装の欠陥をシミュレート（固定色+30%透過の目立つ隙間）',

    sec3Title: '3. 各種モーダル / ドロワー / 重複オーバーレイ検証',
    sec3Desc: 'オーバーレイ展開時、WCO頂角はスクリムの色と透過率に合わせて物理混色され、明暗の不自然な境界線を解消します。多層モーダルの内側を閉じても外側が維持されます。',
    btnOpenModal: '中央モーダルを開く',
    btnOpenDrawer: '右側ドロワーを開く',
    btnOpenSheet: 'ボトムシートを開く',
    labelScrimAlpha: 'スクリム透過度',
    labelScrimColor: 'スクリム背景色:',

    titleModal: '中央モーダル',
    titleDrawer: 'スライドオーバー・ドロワー',
    titleSheet: 'ボトムシート',
    modalDesc: '上部左右の WCO コントロール領域を確認してください。背景色と現在のスクリム色・透過率がリアルタイムに混色され、矩形の継ぎ目がありません。',
    btnOpenNested: '第2層ネストモーダルを開く',
    btnClose: '閉じる',
    titleNested: 'ネストモーダル (第2層)',
    nestedDesc: '現在の Backdrop 参照カウントは 2 です。この内側モーダルを閉じても外側スクリムが保持され、タイトルバーの色がちらつくことはありません。',
    btnCloseNested: '内側モーダルを閉じる'
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
