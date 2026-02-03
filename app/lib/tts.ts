// app/lib/tts.ts
type SpeakOptions = {
  lang?: string;         // 'fr-FR' o 'es-MX', etc.
  voiceURI?: string;     // el voiceURI elegido en el selector
  rate?: number;
  pitch?: number;
  volume?: number;
};

let preferredVoiceURI: string | null = null;

export function setPreferredVoiceURI(uri: string | null) {
  preferredVoiceURI = uri;
  try {
    if (uri) localStorage.setItem('tts_voice_uri', uri);
    else localStorage.removeItem('tts_voice_uri');
  } catch {}
}

export function getPreferredVoiceURI() {
  try {
    return localStorage.getItem('tts_voice_uri');
  } catch {
    return null;
  }
}

export function listVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined') return Promise.resolve([]);
  const synth = window.speechSynthesis;

  const v = synth.getVoices();
  if (v && v.length > 0) return Promise.resolve(v);

  return new Promise((resolve) => {
    const handler = () => {
      const voices = synth.getVoices();
      synth.onvoiceschanged = null;
      resolve(voices || []);
    };
    synth.onvoiceschanged = handler;

    // fallback por si el evento tarda
    setTimeout(() => resolve(synth.getVoices() || []), 500);
  });
}

function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string, voiceURI?: string | null) {
  const normLang = (lang || '').toLowerCase();

  // 1) Si el usuario eligió una voz concreta, úsala
  if (voiceURI) {
    const exact = voices.find(v => v.voiceURI === voiceURI);
    if (exact) return exact;
  }

  // 2) Preferir voces que coincidan con el idioma (fr-FR, es-MX, etc.)
  const exactLang = voices.find(v => (v.lang || '').toLowerCase() === normLang);
  if (exactLang) return exactLang;

  const startsLang = voices.find(v => (v.lang || '').toLowerCase().startsWith(normLang.split('-')[0]));
  if (startsLang) return startsLang;

  // 3) Preferir voces “buenas” típicas (Microsoft / Google) si están
  const goodByName = voices.find(v =>
    ((v.lang || '').toLowerCase().startsWith(normLang.split('-')[0])) &&
    /microsoft|google/i.test(v.name)
  );
  if (goodByName) return goodByName;

  // 4) Último recurso
  return voices[0] || null;
}

export async function speak(text: string, options: SpeakOptions = {}) {
  if (typeof window === 'undefined') return;

  const synth = window.speechSynthesis;
  if (!synth) return;

  // cancela cualquier voz anterior (evita que se “encime”)
  synth.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = options.lang || 'fr-FR';
  u.rate = options.rate ?? 1;
  u.pitch = options.pitch ?? 1;
  u.volume = options.volume ?? 1;

  const stored = getPreferredVoiceURI();
  const uriToUse = options.voiceURI ?? preferredVoiceURI ?? stored ?? null;

  const voices = await listVoices();
  const chosen = pickBestVoice(voices, u.lang, uriToUse);

  if (chosen) u.voice = chosen;

  synth.speak(u);
}
