/**
 * 📱 PWA Service Worker Lifecycle & Auto-Update Manager
 */

export interface PwaLifecycleOptions {
  swUrl?: string;
  updateViaCache?: 'imports' | 'all' | 'none' | any;
  bypassDevPort?: string | number | (string | number)[];
  autoReloadOnControllerChange?: boolean;
  onUpdateFound?: () => void;
  onUpdateWaiting?: (reg: ServiceWorkerRegistration) => void;
}

export class PwaLifecycleManager {
  private refreshing = false;
  private options: PwaLifecycleOptions;
  private controllerChangeHandler: (() => void) | null = null;
  private visibilityChangeHandler: (() => void) | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  constructor(options: PwaLifecycleOptions = {}) {
    this.options = {
      swUrl: options.swUrl ?? '/sw.js',
      updateViaCache: options.updateViaCache ?? 'none',
      bypassDevPort: options.bypassDevPort ?? '5173',
      autoReloadOnControllerChange: options.autoReloadOnControllerChange ?? true,
      onUpdateFound: options.onUpdateFound,
      onUpdateWaiting: options.onUpdateWaiting
    };
  }

  /**
   * Check if current browser running mode is standalone PWA (Home screen icon)
   */
  public isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const isStandaloneNavigator = (navigator as any)?.standalone === true;
    const isStandaloneDisplayMode =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    return Boolean(isStandaloneNavigator || isStandaloneDisplayMode);
  }

  /**
   * Register service worker with lifecycle hooks and background update guards
   */
  public register(customOptions?: PwaLifecycleOptions): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const opts = { ...this.options, ...customOptions };

    // Skip registration in local dev environment to protect HMR and prevent stale caching
    if (this.shouldBypassDev(opts.bypassDevPort)) {
      if (typeof navigator.serviceWorker.getRegistrations === 'function') {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            for (const reg of regs) reg.unregister();
          })
          .catch(() => {});
      }
      return;
    }

    if (opts.autoReloadOnControllerChange && !this.controllerChangeHandler) {
      this.controllerChangeHandler = () => {
        if (this.refreshing) return;
        this.refreshing = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', this.controllerChangeHandler);
    }

    const initRegistration = () => {
      navigator.serviceWorker
        .register(opts.swUrl || '/sw.js', { updateViaCache: opts.updateViaCache })
        .then((reg) => {
          this.registration = reg;

          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            opts.onUpdateFound?.();
            opts.onUpdateWaiting?.(reg);
          }

          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.onstatechange = () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                installing.postMessage({ type: 'SKIP_WAITING' });
                opts.onUpdateFound?.();
                opts.onUpdateWaiting?.(reg);
              }
            };
          };

          if (!this.visibilityChangeHandler && typeof document !== 'undefined') {
            this.visibilityChangeHandler = () => {
              if (document.visibilityState === 'visible') {
                reg.update().catch(() => {});
              }
            };
            document.addEventListener('visibilitychange', this.visibilityChangeHandler);
          }
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    };

    if (document.readyState === 'complete') {
      initRegistration();
    } else {
      window.addEventListener('load', initRegistration, { once: true });
    }
  }

  /**
   * Manually check for PWA update (e.g. on pull-to-refresh or settings action)
   */
  public async checkForUpdate(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;

      const currentWaiting = reg.waiting;
      if (currentWaiting) {
        currentWaiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }

      await reg.update();
      const newWaiting = reg.waiting as ServiceWorker | null;
      if (newWaiting) {
        newWaiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[PWA] Failed to check for update:', e);
      return false;
    }
  }

  public destroy(): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (this.controllerChangeHandler) {
      navigator.serviceWorker.removeEventListener('controllerchange', this.controllerChangeHandler);
      this.controllerChangeHandler = null;
    }
    if (this.visibilityChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
  }

  private shouldBypassDev(bypassPort?: string | number | (string | number)[]): boolean {
    if (!bypassPort || typeof window === 'undefined') return false;
    const currentPort = window.location?.port;
    if (!currentPort) return false;

    if (Array.isArray(bypassPort)) {
      return bypassPort.some((p) => String(p) === currentPort);
    }
    return String(bypassPort) === currentPort;
  }
}

// Global default singleton instance
const defaultPwaManager = new PwaLifecycleManager();

export function isPwaStandalone(): boolean {
  return defaultPwaManager.isStandalone();
}

export function registerServiceWorker(
  onUpdateFound?: () => void,
  options?: PwaLifecycleOptions
): void {
  defaultPwaManager.register({ ...options, onUpdateFound });
}

export function checkForPwaUpdate(): Promise<boolean> {
  return defaultPwaManager.checkForUpdate();
}
