import { createPwaPlayer, PwaPlayer, type PwaPlayerOptions, type PwaPlayerState, type PlayMode } from '@pwa-player/core';

let sharedPlayer: PwaPlayer | null = null;

export function createSveltePlayer(options?: PwaPlayerOptions) {
  if (!sharedPlayer) {
    sharedPlayer = createPwaPlayer(options);
  }
  const player = sharedPlayer;
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
