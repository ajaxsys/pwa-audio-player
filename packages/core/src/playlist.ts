import type { Track, PlayMode } from './types';

export class PlaylistManager<T extends Record<string, any> = Track> {
  private queue: T[] = [];
  private currentIndex = 0;
  private playMode: PlayMode = 'sequence';
  private shuffleIndices: number[] = [];
  private shufflePointer = 0;

  constructor(initialQueue: T[] = [], initialIndex = 0, initialMode: PlayMode = 'sequence') {
    this.queue = [...initialQueue];
    this.currentIndex = Math.max(0, Math.min(initialIndex, this.queue.length - 1));
    this.playMode = initialMode;
    if (this.playMode === 'shuffle') {
      this.rebuildShuffleOrder();
    }
  }

  public getQueue(): T[] {
    return [...this.queue];
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentTrack(): T | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  public getPlayMode(): PlayMode {
    return this.playMode;
  }

  public setPlayMode(mode: PlayMode): void {
    this.playMode = mode;
    if (mode === 'shuffle') {
      this.rebuildShuffleOrder();
    }
  }

  public setQueue(tracks: T[], startIndex = 0): void {
    this.queue = [...tracks];
    this.currentIndex = Math.max(0, Math.min(startIndex, this.queue.length - 1));
    if (this.playMode === 'shuffle') {
      this.rebuildShuffleOrder();
    }
  }

  public setIndex(index: number): boolean {
    if (index >= 0 && index < this.queue.length) {
      this.currentIndex = index;
      return true;
    }
    return false;
  }

  /**
   * Insert track(s) immediately following the currently playing track ("Play Next" / 插播)
   */
  public insertNext(trackOrTracks: T | T[]): void {
    const items = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
    if (!items.length) return;

    if (this.queue.length === 0) {
      this.queue = [...items];
      this.currentIndex = 0;
    } else {
      const insertPos = this.currentIndex + 1;
      this.queue.splice(insertPos, 0, ...items);
    }

    if (this.playMode === 'shuffle') {
      this.rebuildShuffleOrder();
    }
  }

  /**
   * Append track(s) to the end of the queue
   */
  public append(trackOrTracks: T | T[]): void {
    const items = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
    if (!items.length) return;

    this.queue.push(...items);
    if (this.playMode === 'shuffle') {
      this.rebuildShuffleOrder();
    }
  }

  /**
   * Remove a track from queue by index with automatic cursor position correction
   */
  public remove(index: number): T | null {
    if (index < 0 || index >= this.queue.length) return null;

    const [removed] = this.queue.splice(index, 1);

    if (this.queue.length === 0) {
      this.currentIndex = 0;
    } else if (index < this.currentIndex) {
      this.currentIndex = Math.max(0, this.currentIndex - 1);
    } else if (index === this.currentIndex) {
      this.currentIndex = Math.min(this.currentIndex, this.queue.length - 1);
    }

    if (this.playMode === 'shuffle') {
      this.rebuildShuffleOrder();
    }
    return removed;
  }

  /**
   * Reorder/move a track within queue with automatic cursor protection
   */
  public move(fromIndex: number, toIndex: number): boolean {
    if (
      fromIndex < 0 ||
      fromIndex >= this.queue.length ||
      toIndex < 0 ||
      toIndex >= this.queue.length ||
      fromIndex === toIndex
    ) {
      return false;
    }

    const currentTrack = this.getCurrentTrack();
    const [item] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, item);

    // Keep current track cursor stable
    if (currentTrack) {
      const newPos = this.queue.indexOf(currentTrack);
      if (newPos >= 0) this.currentIndex = newPos;
    }

    if (this.playMode === 'shuffle') {
      this.rebuildShuffleOrder();
    }
    return true;
  }

  public getNextIndex(): number {
    if (this.queue.length === 0) return -1;
    if (this.playMode === 'single') {
      return this.currentIndex;
    }
    if (this.playMode === 'shuffle') {
      if (this.shuffleIndices.length === 0) this.rebuildShuffleOrder();
      const nextPointer = (this.shufflePointer + 1) % this.shuffleIndices.length;
      return this.shuffleIndices[nextPointer];
    }
    if (this.playMode === 'loop') {
      return (this.currentIndex + 1) % this.queue.length;
    }
    // 'sequence' mode: stops at the end
    const next = this.currentIndex + 1;
    return next < this.queue.length ? next : -1;
  }

  public getPrevIndex(): number {
    if (this.queue.length === 0) return -1;
    if (this.playMode === 'single') {
      return this.currentIndex;
    }
    if (this.playMode === 'shuffle') {
      if (this.shuffleIndices.length === 0) this.rebuildShuffleOrder();
      const prevPointer = (this.shufflePointer - 1 + this.shuffleIndices.length) % this.shuffleIndices.length;
      return this.shuffleIndices[prevPointer];
    }
    if (this.playMode === 'loop') {
      return (this.currentIndex - 1 + this.queue.length) % this.queue.length;
    }
    // 'sequence' mode
    const prev = this.currentIndex - 1;
    return prev >= 0 ? prev : -1;
  }

  public stepNext(): T | null {
    const nextIdx = this.getNextIndex();
    if (nextIdx >= 0) {
      this.currentIndex = nextIdx;
      if (this.playMode === 'shuffle') {
        this.shufflePointer = (this.shufflePointer + 1) % this.shuffleIndices.length;
      }
      return this.getCurrentTrack();
    }
    return null;
  }

  public stepPrev(): T | null {
    const prevIdx = this.getPrevIndex();
    if (prevIdx >= 0) {
      this.currentIndex = prevIdx;
      if (this.playMode === 'shuffle') {
        this.shufflePointer = (this.shufflePointer - 1 + this.shuffleIndices.length) % this.shuffleIndices.length;
      }
      return this.getCurrentTrack();
    }
    return null;
  }

  public shuffle(): void {
    this.rebuildShuffleOrder();
  }

  public clear(): void {
    this.queue = [];
    this.currentIndex = 0;
    this.shuffleIndices = [];
    this.shufflePointer = 0;
  }

  private rebuildShuffleOrder(): void {
    const len = this.queue.length;
    this.shuffleIndices = Array.from({ length: len }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = len - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffleIndices[i], this.shuffleIndices[j]] = [this.shuffleIndices[j], this.shuffleIndices[i]];
    }
    // Place current track at start if valid
    const currentPos = this.shuffleIndices.indexOf(this.currentIndex);
    if (currentPos > 0) {
      [this.shuffleIndices[0], this.shuffleIndices[currentPos]] = [this.shuffleIndices[currentPos], this.shuffleIndices[0]];
    }
    this.shufflePointer = 0;
  }
}
