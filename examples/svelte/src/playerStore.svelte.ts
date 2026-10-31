import { createPwaPlayer, type PwaPlayerOptions, type PwaPlayerState, type PlayMode } from '@pwa-player/core';

export function createSveltePlayer(options?: PwaPlayerOptions) {
  const player = createPwaPlayer(options);
  let state = $state<PwaPlayerState>(player.getState());

  player.subscribe((newState) => {
    state = newState;
  });

  return {
    get state() {
      return state;
    },
    play: () => player.play(),
    pause: () => player.pause(),
    toggle: () => player.toggle(),
    next: () => player.next(),
    prev: () => player.prev(),
    seek: (sec: number) => player.seek(sec),
    setMode: (mode: PlayMode) => player.setPlayMode(mode),
    playIndex: (idx: number) => player.playTrackByIndex(idx)
  };
}
