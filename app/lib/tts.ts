// app/lib/tts.ts
// Utilidad TTS (SpeechSynthesis) con:
// - selección de voz entendible (fr/es)
// - soporte voiceURI opcional (para forzar voz)
// - espera a que carguen voces
// - cancelación previa para que no se empalmen audios

export type SpeakOptions = {
  lang?: string;      // 'fr-FR' | 'es-ES' | 'es-MX' ...
  rate?: number;      // 0.1 - 10 (1 = normal)
  pitch?: number;     // 0 - 2 (1 = normal)
  volume?: number;    // 0 - 1 (1 = normal)
  voiceURI?: string;  // forzar una voz exacta si existe
};

const STORAGE_KEY = 'debate_preferred_voice_uri_v1';

// Guardar / leer voz preferida (si quieres persistencia)
export function setPreferredVoiceURI(uri: string) {
  try {
    localStorage.setItem(STORAGE_KEY, uri);
  } catch {}
}

export function getPreferredVoiceURI(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Lista voces (puede estar vacía al inicio; por eso usamos waitForVoices)
export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined') return [];
  const synth = window.speechSynthesis;
  return synth?.getVoices?.() ?? [];
}

// Espera a que el navegador cargue voces (Chrome a veces tarda)
async function waitForVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  const start = Date.now();

  const current = listVoices();
  if (current.length) return current;

  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve([]);

    const synth = window.speechSynthesis;

    const done = () => {
      const v = listVoices();
      resolve(v);
    };

    const tick = () => {
      const v = listVoices();
      if (v.length) return resolve(v);
      if (Date.now() - start > timeoutMs) return resolve(v);
      setTimeout(tick, 60);
    };

    // Algunos browsers disparan onvoiceschanged
    try {
      synth.onvoiceschanged = () => done();
    } catch {}

    tick();
  });
}

// Normaliza a minúsculas para comparación
function norm(s: string) {
  return (s || '').toLowerCase();
}

// Elige una voz buena:
// 1) si voiceURI existe y está en la lista, úsala
// 2) si no, busca por lang exacto
// 3) si no, busca por prefijo ('fr', 'es')
// 4) si no, toma la primera disponible
function pickVoice(
  voices: SpeechSynthesisVoice[],
  requestedURI: string | null,
  lang: string
): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;

  if (requestedURI) {
    const exact = voices.find((v) => v.voiceURI === requestedURI);
    if (exact) return exact;
  }

  const target = norm(lang);

  // 2) match exact lang
  let v = voices.find((x) => norm(x.lang) === target);
  if (v) return v;

  // 3) match por prefijo (fr / es)
  const prefix = target.split('-')[0];
  v = voices.find((x) => norm(x.lang).startsWith(prefix));
  if (v) return v;

  // 3.5) heurística: prioriza voces “naturales” si existen (Google/Microsoft)
  const preferredBrands = ['google', 'microsoft', 'natural', 'neur', 'online'];
  const withPrefix = voices.filter((x) => norm(x.lang).startsWith(prefix));
  if (withPrefix.length) {
    const best = withPrefix.find((x) => preferredBrands.some((k) => norm(x.name).includes(k)));
    return best ?? withPrefix[0];
  }

  // 4) fallback
  return voices[0];
}

// Habla el texto
export async function speak(text: string, options: SpeakOptions = {}) {
  if (typeof window === 'undefined') return;

  const synth = window.speechSynthesis;
  if (!synth) return;

  // Cancelar lo anterior para evitar voces “raras” por empalme
  try {
    synth.cancel();
  } catch {}

  const voices = await waitForVoices();

  const lang = options.lang ?? 'fr-FR';

  const requestedURI = options.voiceURI ?? getPreferredVoiceURI();
  const voice = pickVoice(voices, requestedURI, lang);

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
