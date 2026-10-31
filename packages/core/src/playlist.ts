import type { Track, PlayMode } from './types';

export class PlaylistManager {
  private queue: Track[] = [];
  private currentIndex = 0;
  private playMode: PlayMode = 'sequence';
  private shuffleIndices: number[] = [];
  private shufflePointer = 0;

  constructor(initialQueue: Track[] = [], initialIndex = 0, initialMode: PlayMode = 'sequence') {
    this.queue = [...initialQueue];
    this.currentIndex = Math.max(0, Math.min(initialIndex, this.queue.length - 1));
    this.playMode = initialMode;
    if (this.playMode === 'shuffle') {
      this.rebuildShuffleOrder();
    }
  }

  public getQueue(): Track[] {
    return [...this.queue];
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentTrack(): Track | null {
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

  public setQueue(tracks: Track[], startIndex = 0): void {
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

  public stepNext(): Track | null {
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

  public stepPrev(): Track | null {
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
