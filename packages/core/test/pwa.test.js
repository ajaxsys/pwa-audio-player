import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PwaLifecycleManager,
  isPwaStandalone,
  registerServiceWorker,
  checkForPwaUpdate
} from '../dist/index.js';

test('pwa - isStandalone returns boolean based on matchMedia / navigator.standalone', () => {
  const manager = new PwaLifecycleManager();
  assert.equal(typeof manager.isStandalone(), 'boolean');
  assert.equal(typeof isPwaStandalone(), 'boolean');
  manager.destroy();
});

test('pwa - checkForUpdate gracefully returns false in environments without serviceWorker', async () => {
  const hasUpdate = await checkForPwaUpdate();
  assert.equal(hasUpdate, false);
});

test('pwa - register bypasses in local dev environment without errors', () => {
  let unregisterCalled = false;
  globalThis.window = {
    location: { port: '5173' },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  globalThis.document = { readyState: 'complete' };

  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          getRegistrations: async () => [{ unregister: () => { unregisterCalled = true; } }]
        }
      },
      configurable: true
    });
  } catch {}

  const manager = new PwaLifecycleManager({ bypassDevPort: '5173' });
  manager.register();
  manager.destroy();
});
