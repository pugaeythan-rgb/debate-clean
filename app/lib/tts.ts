'use client';

type SpeakOptions = {
  lang?: string;      // 'fr-FR' o 'es-MX' etc.
  rate?: number;      // 0.1 - 10 (normal 1)
  pitch?: number;     // 0 - 2 (normal 1)
  volume?: number;    // 0 - 1 (normal 1)
};

const STORAGE_KEY = 'tts_preferred_voice_uri_v1';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

/**
 * Espera a que el navegador cargue las voces (en Chrome a veces tarda).
 */
function waitForVoices(timeoutMs = 2500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isBrowser()) return resolve([]);

    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing && existing.length > 0) return resolve(existing);

    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      try {
        synth.removeEventListener('voiceschanged', onChanged);
      } catch {}
      resolve(synth.getVoices() || []);
    };

    const onChanged = () => finish();

    try {
      synth.addEventListener('voiceschanged', onChanged);
    } catch {}

    // fallback por si no dispara el evento
    setTimeout(() => finish(), timeoutMs);
  });
}

/**
 * Devuelve lista simple de voces disponibles
 */
export async function listVoices() {
  const voices = await waitForVoices();
  return voices.map((v) => ({
    name: v.name,
    lang: v.lang,
    voiceURI: v.voiceURI,
    localService: v.localService,
    default: v.default,
  }));
}

/**
 * Guarda la voz preferida (por voiceURI) en localStorage
 */
export function setPreferredVoiceURI(voiceURI: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, voiceURI);
  } catch {}
}

/**
 * Lee la voz preferida (voiceURI) de localStorage
 */
export function getPreferredVoiceURI(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Selecciona la mejor voz: primero la preferida por URI,
 * si no existe, intenta por idioma (fr o es), si no, primera disponible.
 */
function pickVoice(voices: SpeechSynthesisVoice[], preferredURI: string | null, lang: string) {
  if (!voices || voices.length === 0) return null;

  // 1) exact match por URI
  if (preferredURI) {
    const byURI = voices.find((v) => v.voiceURI === preferredURI);
    if (byURI) return byURI;
  }

  const langLower = (lang || '').toLowerCase();

  // 2) match por idioma exacto (ej fr-FR)
  const exactLang = voices.find((v) => (v.lang || '').toLowerCase() === langLower);
  if (exactLang) return exactLang;

  // 3) match por prefijo (fr, es)
  const prefix = langLower.split('-')[0];
  if (prefix) {
    const byPrefix = voices.find((v) => (v.lang || '').toLowerCase().startsWith(prefix));
    if (byPrefix) return byPrefix;
  }

  // 4) fallback
  return voices[0];
}

/**
 * Habla un texto (TTS)
 */
export async function speak(text: string, options: SpeakOptions = {}) {
  if (!isBrowser()) return;

  const synth = window.speechSynthesis;

  // Si hay algo hablando, lo cortamos para que sea claro
  try {
    synth.cancel();
  } catch {}

  const voices = await waitForVoices();

  // Idioma default (tú dijiste: interfaz en francés; voz puede ser fr o es)
  // Puedes cambiar esto a 'es-MX' si prefieres voz por default en español.
  const lang = options.lang ?? 'fr-FR';

  const preferredURI = getPreferredVoiceURI();
  const voice = pickVoice(voices, preferredURI, lang);

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;

  if (voice) utter.voice = voice;

  utter.rate = options.rate ?? 1;
  utter.pitch = options.pitch ?? 1;
  utter.volume = options.volume ?? 1;

  try {
    synth.speak(utter);
  } catch {}
}
