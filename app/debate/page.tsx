'use client';

import { useEffect, useRef, useState } from 'react';
import { speak, listVoices, setPreferredVoiceURI, getPreferredVoiceURI } from '../lib/tts';

type Team = 'A' | 'B';
type Phase = 'setup' | 'intro' | 'development' | 'conclusion';

interface Debater {
  id: string;
  name: string;
  team: Team;
  isSpecial: boolean;
}

type VoiceLang = 'fr-FR' | 'es-MX';

function timeSpeech(seconds: number, lang: VoiceLang) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;

  if (lang === 'fr-FR') {
    if (m <= 0) return `${s} seconde${s > 1 ? 's' : ''}`;
    if (s === 0) return `${m} minute${m > 1 ? 's' : ''}`;
    return `${m} minute${m > 1 ? 's' : ''} et ${s} seconde${s > 1 ? 's' : ''}`;
  }

  // es-MX
  if (m <= 0) return `${s} segundos`;
  if (s === 0) return `${m} minuto${m > 1 ? 's' : ''}`;
  return `${m} minuto${m > 1 ? 's' : ''} y ${s} segundos`;
}

function Timer({
  initialSeconds,
  label,
  isActive,
  voiceLang,
  voiceURI,
}: {
  initialSeconds: number;
  label: string;
  isActive: boolean;
  voiceLang: VoiceLang;
  voiceURI: string | null;
}) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // evitar repetir 30s/10s
  const announcedRef = useRef<{ t30: boolean; t10: boolean }>({ t30: false, t10: false });

  useEffect(() => {
    if (running && isActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            setRunning(false);
            // Anuncio final (lo decimos en el idioma de la voz)
            const endText =
              voiceLang === 'fr-FR'
                ? `Temps terminé pour ${label}.`
                : `Se acabó el tiempo para ${label}.`;
            speak(endText, { lang: voiceLang, voiceURI });
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, isActive, timeLeft, label, voiceLang, voiceURI]);

  useEffect(() => {
    setRunning(false);
    setTimeLeft(initialSeconds);
    announcedRef.current = { t30: false, t10: false };
  }, [initialSeconds]);

  // Anuncios 30s y 10s (una sola vez)
  useEffect(() => {
    if (!running || !isActive) return;
    if (timeLeft <= 0) return;

    if (timeLeft === 30 && !announcedRef.current.t30) {
      announcedRef.current.t30 = true;
      const t =
        voiceLang === 'fr-FR'
          ? `${label}, il te reste trente secondes.`
          : `${label}, te quedan treinta segundos.`;
      speak(t, { lang: voiceLang, voiceURI });
    }

    if (timeLeft === 10 && !announcedRef.current.t10) {
      announcedRef.current.t10 = true;
      const t =
        voiceLang === 'fr-FR'
          ? `${label}, il te reste dix secondes.`
          : `${label}, te quedan diez segundos.`;
      speak(t, { lang: voiceLang, voiceURI });
    }
  }, [timeLeft, running, isActive, label, voiceLang, voiceURI]);

  const format = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const urgent = timeLeft > 0 && timeLeft <= 10;

  const toggleRunning = () => {
    if (running) {
      // Al pausar, anuncio del tiempo restante
      const remain = timeSpeech(timeLeft, voiceLang);
      const t =
        voiceLang === 'fr-FR'
          ? `${label}, il te reste ${remain}.`
          : `${label}, te quedan ${remain}.`;
      speak(t, { lang: voiceLang, voiceURI });
      setRunning(false);
      return;
    }
    if (timeLeft > 0) setRunning(true);
  };

  const resetTimer = () => {
    setRunning(false);
    setTimeLeft(initialSeconds);
    announcedRef.current = { t30: false, t10: false };
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:shadow transition">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900" title={label}>
          {label}
        </p>
        <p className="text-xs text-slate-500">Chronomètre individuel</p>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`rounded-xl px-3 py-2 font-mono text-lg font-bold tracking-tight ${
            urgent ? 'bg-rose-50 text-rose-700 animate-pulse' : 'bg-slate-50 text-slate-800'
          }`}
        >
          {format(timeLeft)}
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggleRunning}
            disabled={timeLeft === 0}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:bg-slate-300 ${
              running ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {running ? 'Pause' : 'Démarrer'}
          </button>

          <button
            onClick={resetTimer}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            title="Réinitialiser"
          >
            ↺
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DebatePage() {
  const [phase, setPhase] = useState<Phase>('setup');

  // VOIX
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState<string | null>(null);

  // La interfaz queda en FR. La voz la puedes poner en ES si se entiende mejor.
  const [voiceLang, setVoiceLang] = useState<VoiceLang>('fr-FR');

  useEffect(() => {
    (async () => {
      const v = await listVoices();
      setVoices(v);

      const stored = getPreferredVoiceURI();
      if (stored) setVoiceURIState(stored);
    })();
  }, []);

  const setVoiceURI = (uri: string | null) => {
    setVoiceURIState(uri);
    setPreferredVoiceURI(uri);
  };

  const testVoice = () => {
    const t =
      voiceLang === 'fr-FR'
        ? `Test. Il reste une minute et dix secondes.`
        : `Prueba. Te queda un minuto y diez segundos.`;
    speak(t, { lang: voiceLang, voiceURI });
  };

  // Equipos
  const [teamA, setTeamA] = useState<Debater[]>(
    Array.from({ length: 9 }).map((_, i) => ({
      id: `a-${i}`,
      name: `Débatteur A${i + 1}`,
      team: 'A',
      isSpecial: false,
    }))
  );

  const [teamB, setTeamB] = useState<Debater[]>(
    Array.from({ length: 8 }).map((_, i) => ({
      id: `b-${i}`,
      name: `Débatteur B${i + 1}`,
      team: 'B',
      isSpecial: false,
    }))
  );

  const [selectedIntro, setSelectedIntro] = useState<Set<string>>(new Set());
  const [selectedConcl, setSelectedConcl] = useState<Set<string>>(new Set());

  const updateName = (team: Team, id: string, newName: string) => {
    if (team === 'A') setTeamA(teamA.map((d) => (d.id === id ? { ...d, name: newName } : d)));
    else setTeamB(teamB.map((d) => (d.id === id ? { ...d, name: newName } : d)));
  };

  // Une seule étoile ★ au total
  const setSpecial = (team: Team, id: string) => {
    const resetA = teamA.map((d) => ({ ...d, isSpecial: false }));
    const resetB = teamB.map((d) => ({ ...d, isSpecial: false }));

    if (team === 'A') {
      setTeamA(resetA.map((d) => (d.id === id ? { ...d, isSpecial: true } : d)));
      setTeamB(resetB);
    } else {
      setTeamA(resetA);
      setTeamB(resetB.map((d) => (d.id === id ? { ...d, isSpecial: true } : d)));
    }
  };

  const toggle = (id: string, set: Set<string>, setFn: (s: Set<string>) => void) => {
    const ns = new Set(set);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setFn(ns);
  };

  const renderTeamList = (team: Debater[], teamName: string, targetPhase: Phase) => {
    const isIntro = targetPhase === 'intro';
    const currentSet = isIntro ? selectedIntro : selectedConcl;
    const setFn = isIntro ? setSelectedIntro : setSelectedConcl;

    return (
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">{teamName}</h3>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {team.length} participants
          </span>
        </div>

        <div className="p-5">
          <div className="space-y-3">
            {team.map((member) => {
              if (targetPhase === 'setup') {
                return (
                  <div key={member.id} className="flex items-center gap-2">
                    <input
                      value={member.name}
                      onChange={(e) => updateName(member.team, member.id, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                                 text-slate-900 placeholder-slate-500 shadow-sm
                                 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                      placeholder="Nom"
                    />

                    <button
                      onClick={() => setSpecial(member.team, member.id)}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                        member.isSpecial
                          ? 'bg-yellow-300 border-yellow-400 text-slate-900'
                          : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}
                      title="Attribuer 150s"
                    >
                      ★
                    </button>
                  </div>
                );
              }

              if (targetPhase === 'development') {
                return (
                  <Timer
                    key={member.id}
                    initialSeconds={member.isSpecial ? 150 : 120}
                    label={`${member.name}${member.isSpecial ? ' ★' : ''}`}
                    isActive={phase === 'development'}
                    voiceLang={voiceLang}
                    voiceURI={voiceURI}
                  />
                );
              }

              const selected = currentSet.has(member.id);

              return (
                <div key={member.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggle(member.id, currentSet, setFn)}
                      className="h-4 w-4"
                    />
                    <span className={`truncate ${selected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                      {member.name}
                    </span>
                    {selected && (
                      <span className="ml-auto rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                        sélectionné
                      </span>
                    )}
                  </label>

                  {selected && (
                    <div className="mt-3">
                      <Timer
                        initialSeconds={60}
                        label={member.name}
                        isActive={phase === targetPhase}
                        voiceLang={voiceLang}
                        voiceURI={voiceURI}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="sticky top-4 z-10 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm">
            <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm" />
                <div>
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight">Modérateur de débat</h1>
                  <p className="text-sm text-slate-500">Phases + chronomètres par participant</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                {/* Sélecteur voix */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Voix:</span>
                  <select
                    value={voiceURI ?? ''}
                    onChange={(e) => setVoiceURI(e.target.value || null)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="">Auto</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} — {v.lang}
                      </option>
                    ))}
                  </select>

                  <select
                    value={voiceLang}
                    onChange={(e) => setVoiceLang(e.target.value as VoiceLang)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    title="Langue de la voix"
                  >
                    <option value="fr-FR">FR</option>
                    <option value="es-MX">ES</option>
                  </select>

                  <button
                    onClick={testVoice}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Tester
                  </button>
                </div>

                {/* Tabs */}
                <nav className="flex flex-wrap gap-2">
                  {(['setup', 'intro', 'development', 'conclusion'] as Phase[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPhase(p)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                        phase === p
                          ? 'bg-slate-900 text-white border-slate-900 shadow'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {p === 'setup'
                        ? 'Configuration'
                        : p === 'intro'
                          ? 'Introduction'
                          : p === 'development'
                            ? 'Développement'
                            : 'Conclusion'}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </header>

        <div className={phase === 'setup' ? 'block' : 'hidden'}>
          <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900 shadow-sm">
            Modifie les noms. Mets ★ sur l’orateur qui aura 150s en « Développement ».
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {renderTeamList(teamA, 'Équipe A', 'setup')}
            {renderTeamList(teamB, 'Équipe B', 'setup')}
          </div>
        </div>

        <div className={phase === 'intro' ? 'block' : 'hidden'}>
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
            Sélectionne les orateurs pour l’introduction. Chaque sélectionné a 60s.
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {renderTeamList(teamA, 'Équipe A', 'intro')}
            {renderTeamList(teamB, 'Équipe B', 'intro')}
          </div>
        </div>

        <div className={phase === 'development' ? 'block' : 'hidden'}>
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
            Banque de temps individuelle. Normal 120s. ★ 150s.
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {renderTeamList(teamA, 'Équipe A', 'development')}
            {renderTeamList(teamB, 'Équipe B', 'development')}
          </div>
        </div>

        <div className={phase === 'conclusion' ? 'block' : 'hidden'}>
          <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900 shadow-sm">
            Sélectionne les orateurs pour la conclusion. Chaque sélectionné a 60s.
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {renderTeamList(teamA, 'Équipe A', 'conclusion')}
            {renderTeamList(teamB, 'Équipe B', 'conclusion')}
          </div>
        </div>
      </div>
    </main>
  );
}
