import { state } from './state';
import { t } from './i18n';

// Voice announcement of the result, so the athlete hears their time from the
// finish line without walking back to the phone.

function synth(): SpeechSynthesis | null {
  return 'speechSynthesis' in window ? window.speechSynthesis : null;
}

export function speechAvailable(): boolean {
  return synth() !== null;
}

// iOS Safari only allows programmatic speak() after one was started from a
// user gesture — call this from the start button, like unlockAudio().
export function unlockSpeech(): void {
  const s = synth();
  if (!s) return;
  const u = new SpeechSynthesisUtterance('');
  u.volume = 0;
  s.speak(u);
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  // getVoices() may be empty until the async voiceschanged event; falling
  // back to the default voice is fine, the utterance lang still applies
  const voices = s.getVoices();
  return voices.find((v) => v.lang.startsWith(lang)) || null;
}

function speak(text: string): void {
  const s = synth();
  if (!s || !state.voice || !state.sound) return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const lang = state.lang === 'fr' ? 'fr-FR' : 'en-US';
  u.lang = lang;
  const voice = pickVoice(state.lang);
  if (voice) u.voice = voice;
  u.rate = 1;
  u.volume = 1;
  s.speak(u);
}

export function announceResult(ms: number, isPB: boolean): void {
  const seconds = Math.floor(ms / 1000);
  const hundredths = Math.round((ms % 1000) / 10);
  const text = state.lang === 'fr'
    ? `${seconds} secondes ${String(hundredths).padStart(2, '0')}`
    : `${seconds} point ${String(hundredths).padStart(2, '0')} seconds`;
  speak(isPB ? `${text}. ${t('voice_new_record')}` : text);
}
