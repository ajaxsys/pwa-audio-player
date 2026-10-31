import { useRef, useSyncExternalStore } from 'react';
import { createPwaPlayer, PwaPlayer, type PwaPlayerOptions, type PwaPlayerState } from '@pwa-player/core';

export function usePwaPlayer(options?: PwaPlayerOptions) {
  const playerRef = useRef<PwaPlayer | null>(null);

  if (!playerRef.current) {
    playerRef.current = createPwaPlayer(options);
  }

  const player = playerRef.current;

  const state = useSyncExternalStore(
    (callback) => player.subscribe(() => callback()),
    () => player.getState()
  );

  return {
    player,
    state,
    play: () => player.play(),
    pause: () => player.pause(),
    toggle: () => player.toggle(),
    next: () => player.next(),
    prev: () => player.prev(),
    seek: (sec: number) => player.seek(sec),
    setMode: (mode: any) => player.setPlayMode(mode),
    playIndex: (idx: number) => player.playTrackByIndex(idx)
  };
}
