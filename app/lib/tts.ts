'use client';

type SpeakOptions = {
  lang?: 'es-ES' | 'es-MX' | 'fr-FR';
  rate?: number;  // 0.1–10 (normal 1)
  pitch?: number; // 0–2 (normal 1)
  volume?: number; // 0–1 (normal 1)
};

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

function pickBestVoice(lang: string, voices: SpeechSynthesisVoice[]) {
  // Preferencias por idioma
  const preferredLocales = lang.startsWith('fr')
    ? ['fr-FR', 'fr']
    : ['es-MX', 'es-ES', 'es'];

  // 1) Match exacto por lang
  for (const pref of preferredLocales) {
    const v = voices.find((x) => (x.lang || '').toLowerCase().startsWith(pref.toLowerCase()));
    if (v) return v;
  }

  // 2) Fallback: cualquier voz que contenga el idioma
  const generic = voices.find((x) => (x.lang || '').toLowerCase().includes(lang.split('-')[0].toLowerCase()));
  if (generic) return generic;

  // 3) Último recurso: la primera
  return voices[0] ?? null;
}

async function getVoicesSafe(): Promise<SpeechSynthesisVoice[]> {
  if (!isBrowser()) return [];

  const synth = window.speechSynthesis;
  let voices = synth.getVoices();

  // En algunos navegadores, getVoices() viene vacío hasta que se dispara onvoiceschanged
  if (voices.length > 0) return voices;

  voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const timer = window.setTimeout(() => resolve(synth.getVoices()), 800);
    synth.onvoiceschanged = () => {
      window.clearTimeout(timer);
      resolve(synth.getVoices());
    };
  });

  return voices;
}

export async function speak(text: string, options: SpeakOptions = {}) {
  if (!isBrowser()) return;

  const { lang = 'es-ES', rate = 1, pitch = 1, volume = 1 } = options;

  // Cancela cualquier habla anterior para que no se encime
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = rate;
  utter.pitch = pitch;
  utter.volume = volume;

  const voices = await getVoicesSafe();
  const best = pickBestVoice(lang, voices);
  if (best) utter.voice = best;

  window.speechSynthesis.speak(utter);
}
