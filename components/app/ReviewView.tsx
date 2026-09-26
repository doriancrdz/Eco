"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, FolderClosed, Layers, ListChecks, Loader2, Lock, RotateCcw, X } from "lucide-react";
import Flashcards, { buildFlashcards } from "@/components/Flashcards";
import { useFolders } from "@/hooks/useFolders";
import type { Eco, QuizQuestion } from "@/types";

const MAX_QUIZ_QUESTIONS = 15;

type Scope = { id: string | null; name: string };
type Mode = "quiz" | "cards";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseNotions(eco: Eco) {
  if (!eco.summary_text) return [];
  try {
    const parsed = JSON.parse(eco.summary_text) as { notions?: Array<{ terme?: string; definition?: string } | string> };
    return parsed.notions ?? [];
  } catch {
    return [];
  }
}

function MixedQuiz({ questions, onRestart }: { questions: Array<QuizQuestion & { from: string }>; onRestart: () => void }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const done = index >= questions.length;

  if (questions.length === 0) {
    return <p style={{ color: "var(--mk-muted)" }}>Aucun QCM dans ces cours pour l&apos;instant.</p>;
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="app-card p-8 text-center">
        <p className="mk-display text-[56px]">
          {score}/{questions.length}
        </p>
        <p className="mt-2 text-[15px]" style={{ color: "var(--mk-muted)" }}>
          {pct >= 80 ? "Tu maîtrises cette matière." : pct >= 50 ? "C'est en bonne voie : revois les notions ratées." : "Repasse par les fiches, puis retente le quiz."}
        </p>
        <button type="button" onClick={onRestart} className="app-btn app-btn-primary mt-6">
          <RotateCcw className="h-4 w-4" /> Nouveau quiz
        </button>
      </div>
    );
  }

  const q = questions[index];
  const revealed = picked !== null;
  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  return (
    <div className="app-card p-6 sm:p-8">
      <div className="flex items-center justify-between text-[12.5px]" style={{ color: "var(--mk-faint)" }}>
        <span>
          Question {index + 1} sur {questions.length}
        </span>
        <span className="truncate pl-4">{q.from}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${(index / questions.length) * 100}%`, background: "var(--mk-lilac)" }} />
      </div>
      <p className="mt-6 text-[17px] font-medium leading-snug" style={{ color: "var(--mk-text)" }}>
        {q.question}
      </p>
      <div className="mt-5 space-y-2">
        {(q.options ?? []).map((opt) => {
          const letter = opt.charAt(0);
          const isAnswer = letter === q.answer;
          const isPicked = letter === picked;
          let border = "var(--mk-line)";
          let bg = "transparent";
          let color = "#C9C6C0";
          if (revealed && isAnswer) {
            border = "rgba(134,239,172,0.45)";
            bg = "rgba(134,239,172,0.08)";
            color = "#BBF7D0";
          } else if (revealed && isPicked) {
            border = "rgba(252,165,165,0.45)";
            bg = "rgba(252,165,165,0.08)";
            color = "#FECACA";
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={revealed}
              onClick={() => {
                setPicked(letter);
                if (isAnswer) setScore((s) => s + 1);
              }}
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[14.5px] transition-colors enabled:hover:bg-white/[0.03]"
              style={{ borderColor: border, background: bg, color }}
            >
              {revealed && isAnswer ? <Check className="h-4 w-4 shrink-0" /> : revealed && isPicked ? <X className="h-4 w-4 shrink-0" /> : null}
              {opt}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={next} disabled={!revealed} className="app-btn app-btn-primary">
          {index + 1 === questions.length ? "Voir mon score" : "Question suivante"}
        </button>
      </div>
    </div>
  );
}

interface ReviewViewProps {
  isPro: boolean;
  onUpsell: () => void;
}

export default function ReviewView({ isPro, onUpsell }: ReviewViewProps) {
  const { folders } = useFolders();
  const [scope, setScope] = useState<Scope | null>(null);
  const [mode, setMode] = useState<Mode>("quiz");
  const [ecos, setEcos] = useState<Eco[]>([]);
  const [loading, setLoading] = useState(false);
  const [seed, setSeed] = useState(0);

  const scopes: Scope[] = useMemo(() => [{ id: null, name: "Tous mes cours" }, ...folders.map((f) => ({ id: f.id, name: f.name }))], [folders]);

  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: "50", includeQuiz: "1", noTranscription: "1" });
    if (scope.id) params.set("folderId", scope.id);
    fetch(`/api/ecos?${params}`)
      .then((res) => (res.ok ? res.json() : { ecos: [] }))
      .then((data) => !cancelled && setEcos(data.ecos ?? []))
      .catch(() => !cancelled && setEcos([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const questions = useMemo(() => {
    const all = ecos.flatMap((eco) =>
      (Array.isArray(eco.quiz) ? eco.quiz : [])
        .filter((q) => q.type === "mcq" && q.options?.length && q.answer)
        .map((q) => ({ ...q, from: eco.title }))
    );
    return shuffle(all).slice(0, MAX_QUIZ_QUESTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecos, seed]);

  const cards = useMemo(
    () => ecos.flatMap((eco) => buildFlashcards(parseNotions(eco), Array.isArray(eco.quiz) ? eco.quiz : null)),
    [ecos]
  );

  const pick = (s: Scope) => {
    if (!isPro) {
      onUpsell();
      return;
    }
    setEcos([]);
    setLoading(true);
    setScope(s);
    setSeed((n) => n + 1);
  };

  if (!scope) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-10">
        <div className="flex items-center gap-2">
          <h1 className="mk-display text-[40px]">Réviser</h1>
          <span className="rounded-full px-2 py-0.5 text-[11.5px] font-medium" style={{ background: "rgba(201,184,255,0.12)", color: "var(--mk-lilac)" }}>
            Pro
          </span>
        </div>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
          Avant un partiel, révise toute une matière d&apos;un coup : un quiz qui mélange les questions de tous tes cours, et toutes les notions en flashcards.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {scopes.map((s) => (
            <button key={s.id ?? "all"} type="button" onClick={() => pick(s)} className="app-card flex items-center gap-3 p-4 text-left transition-colors hover:border-white/[0.14] hover:bg-[#141416]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "var(--mk-muted)" }}>
                {s.id ? <FolderClosed className="h-4 w-4" strokeWidth={1.75} /> : <Layers className="h-4 w-4" strokeWidth={1.75} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px]" style={{ color: "var(--mk-text)" }}>
                {s.name}
              </span>
              {!isPro && <Lock className="h-4 w-4 shrink-0" style={{ color: "var(--mk-faint)" }} />}
            </button>
          ))}
        </div>
        {folders.length === 0 && (
          <p className="mt-4 text-[13.5px]" style={{ color: "var(--mk-faint)" }}>
            Astuce : crée une matière dans la barre latérale et ranges-y tes cours pour réviser matière par matière.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-8">
      <button type="button" onClick={() => setScope(null)} className="app-btn app-btn-quiet -ml-2.5 !h-8 !px-2.5 !text-[13px]">
        <ArrowLeft className="h-4 w-4" /> Toutes les matières
      </button>
      <h1 className="mk-display mt-3 text-[40px]">{scope.name}</h1>
      <p className="mt-1 text-[14px]" style={{ color: "var(--mk-muted)" }}>
        {loading ? "Chargement…" : `${ecos.length} cours · ${cards.length} flashcards`}
      </p>

      <div className="mt-6 inline-flex rounded-xl border p-1" style={{ borderColor: "var(--mk-line)" }} role="tablist">
        {([
          ["quiz", "Quiz mélangé", ListChecks],
          ["cards", "Flashcards", Layers],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13.5px] transition-colors"
            style={mode === key ? { background: "rgba(255,255,255,0.08)", color: "var(--mk-text)" } : { color: "var(--mk-muted)" }}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex items-center gap-2 py-16 text-[14px]" style={{ color: "var(--mk-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Préparation de la révision…
          </div>
        ) : ecos.length === 0 ? (
          <p className="py-10 text-[14.5px]" style={{ color: "var(--mk-muted)" }}>
            Aucun cours dans cette matière pour l&apos;instant.
          </p>
        ) : mode === "quiz" ? (
          <MixedQuiz key={seed} questions={questions} onRestart={() => setSeed((n) => n + 1)} />
        ) : (
          <Flashcards key={`${scope.id ?? "all"}-${cards.length}`} cards={cards} title={scope.name} />
        )}
      </div>
    </div>
  );
}
