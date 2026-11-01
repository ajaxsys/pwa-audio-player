/**
 * 💾 Storage & PWA Offline Audio Cache Helper Utilities
 */

/**
 * Formats byte numbers into human-readable strings (e.g. "12.5 MB")
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(decimals))} ${sizes[safeI]}`;
}

/**
 * Formats a timestamp into short cache date string (MM-DD HH:mm)
 */
export function formatCacheDate(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return '';
  const d = new Date(timestamp);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}-${day} ${h}:${min}`;
}

export interface StorageQuotaInfo {
  usage: number;
  quota: number;
  percentage: number;
  isAvailable: boolean;
}

/**
 * Queries browser StorageManager quota and estimate safely with SSR guards
 */
export async function queryStorageQuota(): Promise<StorageQuotaInfo> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== 'function'
  ) {
    return { usage: 0, quota: 0, percentage: 0, isAvailable: false };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
    return {
      usage,
      quota,
      percentage,
      isAvailable: true
    };
  } catch (e) {
    return { usage: 0, quota: 0, percentage: 0, isAvailable: false };
  }
}
