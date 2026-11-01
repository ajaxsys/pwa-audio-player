import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

console.log('🚀 开始全量多框架打包聚合 (Cloudflare Pages)...');

// 1. 构建核心包
console.log('\n📦 [1/6] 构建 pwa-audio-player...');
execSync('pnpm --filter pwa-audio-player build', { stdio: 'inherit' });

// 2. 构建 Hub 导航中心
console.log('\n🧭 [2/6] 构建 example-hub (根入口)...');
execSync('pnpm --filter example-hub build', { stdio: 'inherit' });

// 3. 构建 4 个框架 Demo
console.log('\n⚡ [3/6] 构建 example-vanilla...');
execSync('pnpm --filter example-vanilla build', { stdio: 'inherit' });

console.log('\n⚛️  [4/6] 构建 example-react...');
execSync('pnpm --filter example-react build', { stdio: 'inherit' });

console.log('\n💚 [5/6] 构建 example-vue...');
execSync('pnpm --filter example-vue build', { stdio: 'inherit' });

console.log('\n🧡 [6/6] 构建 example-svelte...');
execSync('pnpm --filter example-svelte build', { stdio: 'inherit' });

// 4. 创建发布聚合根目录 dist-pages
const outDir = path.resolve('dist-pages');
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// 5. 复制 Hub 到根路径
fs.cpSync('examples/hub/dist', outDir, { recursive: true });

// 6. 分别将 4 个 Demo 挂载到子路径
fs.cpSync('examples/vanilla/dist', path.join(outDir, 'vanilla'), { recursive: true });
fs.cpSync('examples/react/dist', path.join(outDir, 'react'), { recursive: true });
fs.cpSync('examples/vue/dist', path.join(outDir, 'vue'), { recursive: true });
fs.cpSync('examples/svelte/dist', path.join(outDir, 'svelte'), { recursive: true });

console.log('\n✨ 打包聚合完成！');
console.log(`📂 发布目录: ${outDir}`);
console.log('🔗 结构:');
console.log('  /           -> Hub 导航中心 (index.html)');
console.log('  /vanilla/   -> Vanilla TS Demo (index.html)');
console.log('  /react/     -> React Demo (index.html)');
console.log('  /vue/       -> Vue 3 Demo (index.html)');
console.log('  /svelte/    -> Svelte 5 Demo (index.html)');
