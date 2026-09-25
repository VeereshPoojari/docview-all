import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generateWav(sampleRate = 44100, durationSec = 3) {
  const numSamples = sampleRate * durationSec;
  const blockAlign = 2; // 1 channel * 2 bytes (16-bit)
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audioFormat 1 (PCM)
  buffer.writeUInt16LE(1, 22);  // numChannels 1 (mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bitsPerSample (16)

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write pleasant chord chime (A major: 440Hz + 554Hz + 659Hz with exponential decay)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-1.2 * t);
    const val = (0.5 * Math.sin(2 * Math.PI * 440 * t) + 
                 0.3 * Math.sin(2 * Math.PI * 554.37 * t) + 
                 0.2 * Math.sin(2 * Math.PI * 659.25 * t)) * decay;
    const sample = Math.max(-32768, Math.min(32767, Math.floor(val * 30000)));
    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  return buffer;
}

const wavBuffer = generateWav(44100, 3);
const samplesDir = path.resolve(__dirname, '../tests/samples');
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

fs.writeFileSync(path.join(samplesDir, 'sample.wav'), wavBuffer);
console.log('✓ Generated sample.wav successfully (' + wavBuffer.length + ' bytes)');
