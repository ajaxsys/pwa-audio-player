// Audio Synthesizer to generate royalty-free CC0 PCM WAV test tracks
import fs from 'node:fs';
import path from 'node:path';

function createWavBuffer(sampleRate, durationSec, sampleGenerator) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const headerSize = 44;
  const dataSize = numSamples * 2; // 16-bit mono = 2 bytes per sample
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const val = sampleGenerator(t, durationSec);
    // clamp between -1.0 and 1.0
    const clamped = Math.max(-1.0, Math.min(1.0, val));
    const intVal = Math.floor(clamped * 32767);
    buffer.writeInt16LE(intVal, headerSize + i * 2);
  }

  return buffer;
}

// Track 1: Synthwave Arpeggio (12s)
function track1Gen(t, totalDur) {
  const bpm = 120;
  const beat = t * (bpm / 60);
  const notes = [261.63, 329.63, 392.00, 523.25, 440.00, 392.00, 329.63, 293.66]; // C-E-G-C-A-G-E-D
  const noteIdx = Math.floor(beat * 2) % notes.length;
  const freq = notes[noteIdx];
  const notePhase = (beat * 2) % 1.0;
  const env = Math.exp(-notePhase * 4.0); // pluck envelope

  // Synth wave (sine + square overtone)
  const synth = Math.sin(2 * Math.PI * freq * t) * 0.6 +
                (Math.sin(4 * Math.PI * freq * t) > 0 ? 0.2 : -0.2);

  // Bass kick on beat
  const kickPhase = beat % 1.0;
  const kickEnv = Math.exp(-kickPhase * 12.0);
  const kick = Math.sin(2 * Math.PI * (60 - kickPhase * 30) * kickPhase) * kickEnv * 0.7;

  // Fade out at end
  const masterFade = Math.min(1, (totalDur - t) / 1.5);
  return (synth * env * 0.4 + kick) * masterFade * 0.7;
}

// Track 2: Lo-Fi Ambient Chill (14s)
function track2Gen(t, totalDur) {
  const chords = [
    [220.00, 261.63, 329.63, 392.00], // Am7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [130.81, 164.81, 196.00, 246.94], // Cmaj7
    [196.00, 246.94, 293.66, 349.23]  // G7
  ];
  const chordIdx = Math.floor(t / 3.5) % chords.length;
  const currentChord = chords[chordIdx];
  
  let val = 0;
  for (let n of currentChord) {
    val += Math.sin(2 * Math.PI * n * t) * 0.15;
  }
  // Soft Rhodes vibrato
  val *= (1 + 0.1 * Math.sin(2 * Math.PI * 4 * t));

  // Vinyl hiss/warm noise
  const noise = (Math.random() * 2 - 1) * 0.02;

  const masterFade = Math.min(1, Math.min(t / 1.0, (totalDur - t) / 2.0));
  return (val + noise) * masterFade * 0.8;
}

// Track 3: Starlight Chimes (12s)
function track3Gen(t, totalDur) {
  const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
  const step = Math.floor(t * 3);
  const freq = pentatonic[step % pentatonic.length];
  const subPhase = (t * 3) % 1.0;
  const bellEnv = Math.exp(-subPhase * 3.5);
  
  const bell = Math.sin(2 * Math.PI * freq * t) * 0.5 +
               Math.sin(2 * Math.PI * freq * 2.76 * t) * 0.2 +
               Math.sin(2 * Math.PI * freq * 5.4 * t) * 0.1;

  const masterFade = Math.min(1, (totalDur - t) / 1.5);
  return bell * bellEnv * masterFade * 0.6;
}

const outDir = path.resolve('demo-assets');
const sampleRate = 22050; // crisp & compact

fs.writeFileSync(path.join(outDir, 'track1.wav'), createWavBuffer(sampleRate, 12.0, track1Gen));
fs.writeFileSync(path.join(outDir, 'track2.wav'), createWavBuffer(sampleRate, 14.0, track2Gen));
fs.writeFileSync(path.join(outDir, 'track3.wav'), createWavBuffer(sampleRate, 12.0, track3Gen));

console.log('Successfully generated 3 royalty-free test WAV tracks in', outDir);
