import track1 from './track1.wav';
import track2 from './track2.wav';
import track3 from './track3.wav';
import cover1 from './cover1.svg';
import cover2 from './cover2.svg';
import cover3 from './cover3.svg';

export interface DemoTrackItem {
  id: number;
  title: string;
  artist: string;
  album: string;
  src: string;
  artwork: string;
  duration: number;
  lrc: string;
}

export const DEMO_TRACKS: DemoTrackItem[] = [
  {
    id: 1,
    title: 'Neon Horizon',
    artist: 'Synthwave Echoes',
    album: 'Cyber Odyssey (Royalty-Free)',
    src: track1,
    artwork: cover1,
    duration: 12,
    lrc: `[00:00.00]Neon Horizon - Synthwave Echoes
[00:02.00]Driving through the digital rain
[00:05.00]Synthesizers pulse in the dark
[00:08.00]Reaching for the cyber horizon
[00:10.50]Track 1 ends - Auto advancing to Track 2`
  },
  {
    id: 2,
    title: 'Morning Mist',
    artist: 'Lo-Fi Dreamer',
    album: 'Chill Beats at Dawn (Royalty-Free)',
    src: track2,
    artwork: cover2,
    duration: 14,
    lrc: `[00:00.00]Morning Mist - Lo-Fi Dreamer
[00:03.00]A quiet cup of coffee
[00:06.00]Warm sunlight through the leaves
[00:09.50]Gentle breeze whispers softly
[00:12.00]Track 2 ends - Auto advancing to Track 3`
  },
  {
    id: 3,
    title: 'Starlight Serenade',
    artist: 'Cosmic Chimes',
    album: 'Astral Lullaby (Royalty-Free)',
    src: track3,
    artwork: cover3,
    duration: 12,
    lrc: `[00:00.00]Starlight Serenade - Cosmic Chimes
[00:02.50]Gazing at constellations above
[00:05.50]Chimes resonate across galaxies
[00:08.50]Floating in zero gravity dreams
[00:10.50]Track 3 ends - Looping back to Track 1`
  }
];
