import { shallowRef, onUnmounted } from 'vue';
import { createPwaPlayer, PwaPlayer, type PwaPlayerOptions, type PwaPlayerState } from '@pwa-player/core';

export function usePwaPlayer(options?: PwaPlayerOptions) {
  const player = createPwaPlayer(options);
  const state = shallowRef<PwaPlayerState>(player.getState());

  const unsubscribe = player.subscribe((newState) => {
    state.value = { ...newState };
  });

  onUnmounted(() => {
    unsubscribe();
  });

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
