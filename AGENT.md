# AGENT INSTRUCTIONS (CRITICAL: PRIVACY & SECRECY CONTRACT)

> **[IMPORTANT] STRICT PRIVACY PROTECTION FOR PUBLIC REPOSITORY**
> 1. **NEVER expose any personal names, personal email addresses, private usernames, local absolute paths (e.g. `/Users/...`), API keys, tokens, or credentials in any committed files, documentation, commit messages, or responses.**
> 2. Always use public generic identifiers:
>    - Organization / GitHub account: `ajaxsys`
>    - Author / Organization: `ajaxsys`
>    - Repositories: `https://github.com/ajaxsys/pwa-player`
>    - Demos & Deployment: `https://pwa-audio-player.pages.dev`
> 3. Preserve clean top-level repository structure. Keep shared demo assets under `examples/_assets/`.
> 4. Always respond in Chinese, and write code/commits in English.

---

## Technical Context
- **Monorepo Structure**:
  - `packages/core`: `@pwa-player/core` (Framework-agnostic audio engine in TypeScript).
  - `examples/_assets`: Shared royalty-free audio tracks (`.wav`), SVG artworks, and shared styles/i18n.
  - `examples/{hub,vanilla,react,vue,svelte}`: Multi-framework demos.
  - `scripts/build-pages.js`: Build aggregator for single-domain Cloudflare Pages deployment (`dist-pages/`).
- **Core Technology**:
  - Eliminates iOS WebKit lockscreen freeze-lock deadlocks via single-track silent-hold (`keepAlive.ts`).
  - Native MediaSession controls (⏮ ⏯ ⏭) and lockscreen dynamic lyrics.
  - Bidirectional preloading to preserve iOS User Gesture Activation chain.
