let cachedSilentWavUrl: string | null = null;

/**
 * Generate a 2-second zero-amplitude 16-bit mono PCM silent WAV data blob.
 * Returns a persistent ObjectURL.
 */
export function getSilentWavUrl(): string {
  if (cachedSilentWavUrl) {
    return cachedSilentWavUrl;
  }

  if (typeof window === 'undefined' || typeof Blob === 'undefined') {
    return '';
  }

  try {
    const sampleRate = 8000;
    const durationSec = 2;
    const numSamples = sampleRate * durationSec;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');

    // "fmt " sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
    view.setUint16(22, 1, true);  // NumChannels (1 = Mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true);  // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // "data" sub-chunk (all zeroes = complete silence)
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    const blob = new Blob([buffer], { type: 'audio/wav' });
    cachedSilentWavUrl = URL.createObjectURL(blob);
    return cachedSilentWavUrl;
  } catch (err) {
    console.error('[PwaPlayer:SilentWav] Failed to construct silent WAV blob:', err);
    return '';
  }
}
