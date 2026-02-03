'use client';

import { useEffect, useRef, useState } from 'react';
import { speak } from '../lib/tts';

type Team = 'A' | 'B';
type Phase = 'setup' | 'intro' | 'development' | 'conclusion';

interface Debater {
  id: string;
  name: string;
  team: Team;
  isSpecial: boolean;
}

// Formatea segundos -> mm:ss
const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

// Texto hablado para tiempo restante
function remainingSpeechText(label: string, secondsLeft: number, lang: 'fr' | 'es') {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;

  if (lang === 'fr') {
    if (m > 0 && s > 0) return `${label}, il te reste ${m} minute${m > 1 ? 's' : ''} et ${s} seconde${s > 1 ? 's' : ''}.`;
    if (m > 0) return `${label}, il te reste ${m} minute${m > 1 ? 's' : ''}.`;
    return `${label}, il te reste ${s} seconde${s > 1 ? 's' : ''}.`;
  }

  // Español
  if (m > 0 && s > 0) return `${label}, te quedan ${m} minuto${m > 1 ? 's' : ''} y ${s} segundo${s > 1 ? 's' : ''}.`;
  if (m > 0) return `${label}, te quedan ${m} minuto${m > 1 ? 's' : ''}.`;
  return `${label}, te quedan ${s} segundo${s > 1 ? 's' : ''}.`;
}

function Timer({
  initialSeconds,
  label,
  isActive,
}: {
  initialSeconds: number;
  label: string;
  isActive: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [running, setRunning] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Para no repetir avisos
  const warned30Ref = useRef(false);
  const warned10Ref = useRef(false);

  // Config idioma de la voz (puedes cambiar a 'fr-FR' si en tu compu suena bien)
  // Si en francés te suena raro, deja español:
  const voiceLang = 'es-MX';

  useEffect(() => {
    if (running && isActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          const next = t - 1;

          // Avisos 30s y 10s
          if (next === 30 && !warned30Ref.current) {
            warned30Ref.current = true;
            speak(`${label}, quedan 30 segundos.`, { lang: voiceLang });
          }
          if (next === 10 && !warned10Ref.current) {
            warned10Ref.current = true;
            speak(`${label}, quedan 10 segundos.`, { lang: voiceLang });
          }

          // Termina
          if (next <= 0) {
            setRunning(false);
            const endText = `Se acabó el tiempo para ${label}.`;
            speak(endText, { lang: voiceLang });
            return 0;
          }

          return next;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, isActive, timeLeft, label]);

  useEffect(() => {
    setTimeLeft(initialSeconds);
    setRunning(false);
    warned30Ref.current = false;
    warned10Ref.current = false;
  }, [initialSeconds]);

  // Si se pausa manualmente, avisa cuánto queda
  const toggleRunning = () => {
    setRunning((r) => {
      const next = !r;
      // Si vamos a pausar (o sea r era true), hablamos el tiempo restante
      if (r === true && next === false) {
        const msg = remainingSpeechText(label, timeLeft, 'es');
        speak(msg, { lang: voiceLang });
      }
      return next;
    });
  };

  const reset = () => {
    setRunning(false);
    setTimeLeft(initialSeconds);
    warned30Ref.current = false;
    warned10Ref.current = false;
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{label}</p>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`w-16 text-center font-mono text-xl font-extrabold ${
            timeLeft > 0 && timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-800'
          }`}
        >
          {formatTime(timeLeft)}
        </span>

        <button
          onClick={toggleRunning}
          disabled={timeLeft === 0}
          className={`rounded-lg px-3 py-1 text-sm font-semibold text-white transition ${
            running ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
          } disabled:bg-slate-300`}
        >
          {running ? 'Pause' : 'Start'}
        </button>

        <button
          onClick={reset}
          className="rounded-lg bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          title="Réinitialiser"
        >
          ↺
        </button>
      </div>
    </div>
  );
}

export default function DebatePage() {
  const [phase, setPhase] = useState<Phase>('setup');

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

  // 1 seule étoile au total (150s)
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
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-slate-900">{teamName}</h3>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-sm text-slate-700 border border-slate-200">
            {team.length}
          </span>
        </div>

        <div className="space-y-2">
          {team.map((member) => {
            // Configuration (noms + étoile)
            if (targetPhase === 'setup') {
              return (
                <div key={member.id} className="flex items-center gap-2">
                  <input
                    value={member.name}
                    onChange={(e) => updateName(member.team, member.id, e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                               text-slate-900 placeholder-slate-500
                               focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="Nom"
                  />
                  <button
                    onClick={() => setSpecial(member.team, member.id)}
                    className={`rounded-xl border px-3 py-2 text-sm font-extrabold transition ${
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

            // Développement (banque individuelle)
            if (targetPhase === 'development') {
              return (
                <Timer
                  key={member.id}
                  initialSeconds={member.isSpecial ? 150 : 120}
                  label={`${member.name}${member.isSpecial ? ' ★' : ''}`}
                  isActive={phase === 'development'}
                />
              );
            }

            // Intro / Conclusion (sélection + 60s)
            const selected = currentSet.has(member.id);

            return (
              <div key={member.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(member.id, currentSet, setFn)}
                    className="h-4 w-4"
                  />
                  <span className={`truncate ${selected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                    {member.name}
                  </span>
                </label>

                {selected && (
                  <div className="mt-2">
                    <Timer initialSeconds={60} label={member.name} isActive={phase === targetPhase} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const tabs: { key: Phase; label: string }[] = [
    { key: 'setup', label: 'Configuration' },
    { key: 'intro', label: 'Introduction' },
    { key: 'development', label: 'Développement' },
    { key: 'conclusion', label: 'Conclusion' },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="sticky top-4 z-10 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm">
            <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 shadow-sm" />
                <div>
                  <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Modérateur de débat</h1>
                  <p className="text-sm text-slate-500">Phases + chronomètres par participant</p>
                </div>
              </div>

              <nav className="flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setPhase(t.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                      phase === t.key
                        ? 'bg-slate-900 text-white border-slate-900 shadow'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {/* Garder monté (hidden/block) */}
        <div className={phase === 'setup' ? 'block' : 'hidden'}>
          <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900 shadow-sm">
            Modifie les noms. Marque ★ le participant qui aura <b>150s</b> pendant « Développement ».
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {renderTeamList(teamA, 'Équipe A', 'setup')}
            {renderTeamList(teamB, 'Équipe B', 'setup')}
          </div>
        </div>

        <div className={phase === 'intro' ? 'block' : 'hidden'}>
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
            Sélectionne les orateurs pour l’introduction. Chaque sélectionné a <b>60s</b>.
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {renderTeamList(teamA, 'Équipe A', 'intro')}
            {renderTeamList(teamB, 'Équipe B', 'intro')}
          </div>
        </div>

        <div className={phase === 'development' ? 'block' : 'hidden'}>
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
            Banque individuelle. Normal <b>120s</b>. ★ <b>150s</b>. La voix annonce à <b>30s</b> et <b>10s</b>, et quand tu mets en pause.
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {renderTeamList(teamA, 'Équipe A', 'development')}
            {renderTeamList(teamB, 'Équipe B', 'development')}
          </div>
        </div>

        <div className={phase === 'conclusion' ? 'block' : 'hidden'}>
          <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900 shadow-sm">
            Sélectionne les orateurs pour la conclusion. Chaque sélectionné a <b>60s</b>.
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
