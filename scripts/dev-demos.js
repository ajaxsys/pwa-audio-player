import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const services = [
  { name: 'Hub Portal', filter: 'example-hub', port: 5170, color: '\x1b[36m' },
  { name: 'Vanilla   ', filter: 'example-vanilla', port: 5173, color: '\x1b[33m' },
  { name: 'React     ', filter: 'example-react', port: 5174, color: '\x1b[34m' },
  { name: 'Vue       ', filter: 'example-vue', port: 5175, color: '\x1b[32m' },
  { name: 'Svelte    ', filter: 'example-svelte', port: 5176, color: '\x1b[35m' }
];

console.log('\n\x1b[1m\x1b[35m🎧 PWA Player · Multi-Framework Playground Launching...\x1b[0m\n');

const children = [];

for (const s of services) {
  const child = spawn('pnpm', ['--filter', s.filter, 'dev'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (d) => {
    const lines = d.toString().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      // Show Hub QR code and ready notifications
      if (s.filter === 'example-hub' || line.includes('ready in') || line.includes('Network:')) {
        process.stdout.write(`${s.color}[${s.name}]\x1b[0m ${line}\n`);
      }
    }
  });

  child.stderr.on('data', (d) => {
    const msg = d.toString();
    if (!msg.includes('ExperimentalWarning') && !msg.includes('ready in')) {
      process.stderr.write(`${s.color}[${s.name}]\x1b[0m ${msg}`);
    }
  });

  children.push(child);
}

function shutdown() {
  console.log('\n\x1b[33m🛑 Gracefully stopping all demo servers...\x1b[0m');
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {}
  }
  setTimeout(() => process.exit(0), 400);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

console.log('\x1b[32m✔ All 5 servers are spinning up concurrently!\x1b[0m\n');
console.log('\x1b[1m🌐 统一导航主入口 (Hub Portal):\x1b[0m \x1b[36m\x1b[4mhttp://localhost:5170/\x1b[0m');
console.log('   - ⚡ Vanilla TS:  http://localhost:5173/');
console.log('   - ⚛️ React 18/19: http://localhost:5174/');
console.log('   - 💚 Vue 3:       http://localhost:5175/');
console.log('   - 🧡 Svelte 5:    http://localhost:5176/\n');
console.log('\x1b[90m(打开 http://localhost:5170 或手机扫码即可直接看到 4 大框架的卡片一览并自由跳转)\x1b[0m');
console.log('\x1b[90m(按 Ctrl+C 可一键同时终止所有服务)\x1b[0m\n');
