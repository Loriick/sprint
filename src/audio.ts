import { state } from './state';

let audioCtx: AudioContext | null = null;

export function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// iOS Safari requires a silent buffer to be played synchronously within
// the user gesture handler to unlock the AudioContext for future use.
export async function unlockAudio(): Promise<void> {
  const ac = getAudioCtx();
  if (ac.state === 'suspended') await ac.resume();
  const buffer = ac.createBuffer(1, 1, ac.sampleRate);
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.connect(ac.destination);
  source.start(0);
}

function beep(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.4): void {
  if (!state.sound) return;
  const ac = getAudioCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.setValueAtTime(vol, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration);
}

export function beepLow(): void { beep(440, 0.15); }
export function beepGo(): void { beep(880, 0.4, 'square', 0.5); }
export function beepStop(): void { beep(1200, 0.6, 'square', 0.6); }

export function vibrate(pattern: number | number[]): void {
  if (state.haptics && navigator.vibrate) navigator.vibrate(pattern);
}
