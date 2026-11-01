import { useState, useEffect } from 'react';
import { createPwaPlayer, PwaPlayer, type PwaPlayerOptions, type PwaPlayerState } from 'pwa-audio-player';

let sharedPlayer: PwaPlayer | null = null;

export function usePwaPlayer(options?: PwaPlayerOptions) {
  const [player] = useState(() => {
    if (!sharedPlayer) {
      sharedPlayer = createPwaPlayer(options);
    }
    return sharedPlayer;
  });
  const [state, setState] = useState<PwaPlayerState>(() => player.getState());

  useEffect(() => {
    const unsubscribe = player.subscribe((newState) => {
      setState(newState);
    });
    return () => {
      unsubscribe();
    };
  }, [player]);

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
