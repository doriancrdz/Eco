"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Layers, ListChecks, Loader2, Lock, RotateCcw, Search, X } from "lucide-react";
import Flashcards, { buildFlashcards, type Flashcard } from "@/components/Flashcards";
import { useFolders } from "@/hooks/useFolders";
import type { Eco, QuizQuestion } from "@/types";

const MAX_QUIZ_QUESTIONS = 20;
const NO_FOLDER = "__none__";

type Mode = "quiz" | "cards";
type MixedQuestion = QuizQuestion & { from: string };

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
    const parsed = JSON.parse(eco.summary_text) as { notions?: Array<{ terme: string; definition: string } | string> };
    return parsed.notions ?? [];
  } catch {
    return [];
  }
}

function mcqOf(eco: Eco): MixedQuestion[] {
  return (Array.isArray(eco.quiz) ? (eco.quiz as QuizQuestion[]) : [])
    .filter((q) => q.type === "mcq" && q.options?.length && q.answer)
    .map((q) => ({ ...q, from: eco.title }));
}

function cardsOf(eco: Eco): Flashcard[] {
  return buildFlashcards(parseNotions(eco), Array.isArray(eco.quiz) ? (eco.quiz as QuizQuestion[]) : null);
}

function formatMeta(eco: Eco) {
  const date = new Date(eco.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const minutes = eco.duration_seconds ? Math.max(1, Math.round(eco.duration_seconds / 60)) : null;
  return minutes ? `${date} · ${minutes} min` : date;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/* ── Quiz mélangé ─────────────────────────────────────────────── */

function MixedQuiz({ questions, onRestart }: { questions: MixedQuestion[]; onRestart: () => void }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<MixedQuestion[]>([]);

  if (questions.length === 0) {
    return (
      <p className="py-10 text-[14.5px]" style={{ color: "var(--mk-muted)" }}>
        Ces cours n&apos;ont pas encore de QCM. Essaie les flashcards.
      </p>
    );
  }

  if (index >= questions.length) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="app-card p-8">
        <div className="text-center">
          <p className="mk-display text-[56px] leading-none">
            {score}/{questions.length}
          </p>
          <p className="mt-3 text-[15px]" style={{ color: "var(--mk-muted)" }}>
            {pct >= 80 ? "Tu maîtrises ces cours." : pct >= 50 ? "C'est en bonne voie : revois les questions ratées." : "Repasse par les fiches, puis retente le quiz."}
          </p>
        </div>
        {missed.length > 0 && (
          <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--mk-line)" }}>
            <p className="text-[13px] font-medium" style={{ color: "var(--mk-text)" }}>
              À revoir
            </p>
            <ul className="mt-3 space-y-3">
              {missed.map((q, i) => (
                <li key={i} className="text-[14px] leading-relaxed">
                  <span style={{ color: "#C9C6C0" }}>{q.question}</span>
                  <span className="block text-[13px]" style={{ color: "#BBF7D0" }}>
                    {(q.options ?? []).find((o) => o.charAt(0) === q.answer) ?? q.answer}
                  </span>
                  <span className="block text-[12px]" style={{ color: "var(--mk-faint)" }}>
                    {q.from}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={onRestart} className="app-btn app-btn-primary">
            <RotateCcw className="h-4 w-4" /> Nouveau quiz
          </button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const revealed = picked !== null;

  return (
    <div className="app-card p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4 text-[12.5px]" style={{ color: "var(--mk-faint)" }}>
        <span className="shrink-0">
          Question {index + 1} sur {questions.length}
        </span>
        <span className="truncate">{q.from}</span>
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
                else setMissed((m) => [...m, q]);
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
        <button
          type="button"
          onClick={() => {
            setPicked(null);
            setIndex((i) => i + 1);
          }}
          disabled={!revealed}
          className="app-btn app-btn-primary"
        >
          {index + 1 === questions.length ? "Voir mon score" : "Question suivante"}
        </button>
      </div>
    </div>
  );
}

/* ── Vue principale ───────────────────────────────────────────── */

interface ReviewViewProps {
  isPro: boolean;
  onUpsell: () => void;
}

export default function ReviewView({ isPro, onUpsell }: ReviewViewProps) {
  const { folders } = useFolders();
  const [ecos, setEcos] = useState<Eco[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<Mode | null>(null);
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ecos?limit=100&includeQuiz=1&noTranscription=1")
      .then((res) => (res.ok ? res.json() : { ecos: [] }))
      .then((data) => !cancelled && setEcos(data.ecos ?? []))
      .catch(() => !cancelled && setEcos([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Compteurs par cours, calculés une fois.
  const stats = useMemo(() => {
    const m = new Map<string, { questions: number; cards: number }>();
    for (const e of ecos) m.set(e.id, { questions: mcqOf(e).length, cards: cardsOf(e).length });
    return m;
  }, [ecos]);

  const folderName = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);
  const usedFolders = useMemo(() => {
    const ids = new Set(ecos.map((e) => e.folder || NO_FOLDER));
    const list = folders.filter((f) => ids.has(f.id)).map((f) => ({ id: f.id, name: f.name }));
    if (ids.has(NO_FOLDER) && list.length > 0) list.push({ id: NO_FOLDER, name: "Sans matière" });
    return list;
  }, [ecos, folders]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return ecos.filter((e) => {
      if (folderFilter && (e.folder || NO_FOLDER) !== folderFilter) return false;
      if (q && !normalize(e.title).includes(q)) return false;
      return true;
    });
  }, [ecos, folderFilter, query]);

  const selectable = visible.filter((e) => {
    const s = stats.get(e.id);
    return s && (s.questions > 0 || s.cards > 0);
  });
  const allVisibleSelected = selectable.length > 0 && selectable.every((e) => selected.has(e.id));

  const chosen = useMemo(() => ecos.filter((e) => selected.has(e.id)), [ecos, selected]);
  const totals = useMemo(
    () => chosen.reduce((acc, e) => ({ questions: acc.questions + (stats.get(e.id)?.questions ?? 0), cards: acc.cards + (stats.get(e.id)?.cards ?? 0) }), { questions: 0, cards: 0 }),
    [chosen, stats]
  );

  const questions = useMemo(
    () => shuffle(chosen.flatMap(mcqOf)).slice(0, MAX_QUIZ_QUESTIONS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chosen, seed]
  );
  const cards = useMemo(() => chosen.flatMap(cardsOf), [chosen]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) selectable.forEach((e) => next.delete(e.id));
      else selectable.forEach((e) => next.add(e.id));
      return next;
    });

  const start = (mode: Mode) => {
    if (!isPro) {
      onUpsell();
      return;
    }
    setSeed((n) => n + 1);
    setSession(mode);
  };

  /* ── Session de révision ── */
  if (session) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-8">
        <button type="button" onClick={() => setSession(null)} className="app-btn app-btn-quiet -ml-2.5 !h-8 !px-2.5 !text-[13px]">
          <ArrowLeft className="h-4 w-4" /> Modifier la sélection
        </button>
        <h1 className="mk-display mt-3 text-[40px] leading-tight">Révision</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chosen.slice(0, 6).map((e) => (
            <span key={e.id} className="max-w-[240px] truncate rounded-full border px-2.5 py-1 text-[12px]" style={{ borderColor: "var(--mk-line)", color: "var(--mk-muted)" }}>
              {e.title}
            </span>
          ))}
          {chosen.length > 6 && (
            <span className="rounded-full px-2.5 py-1 text-[12px]" style={{ color: "var(--mk-faint)" }}>
              +{chosen.length - 6} cours
            </span>
          )}
        </div>

        <div className="mt-6 inline-flex max-w-full rounded-xl border p-1" style={{ borderColor: "var(--mk-line)" }} role="tablist">
          {([
            ["quiz", `Quiz · ${Math.min(totals.questions, MAX_QUIZ_QUESTIONS)}`, ListChecks],
            ["cards", `Flashcards · ${cards.length}`, Layers],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={session === key}
              onClick={() => setSession(key)}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13.5px] transition-colors"
              style={session === key ? { background: "rgba(255,255,255,0.08)", color: "var(--mk-text)" } : { color: "var(--mk-muted)" }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} /> {label}
            </button>
          ))}
        </div>
        {session === "quiz" && totals.questions > MAX_QUIZ_QUESTIONS && (
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--mk-faint)" }}>
            {MAX_QUIZ_QUESTIONS} questions tirées au hasard parmi {totals.questions}. Relance un quiz pour en avoir d&apos;autres.
          </p>
        )}

        <div className="mt-6">
          {session === "quiz" ? (
            <MixedQuiz key={seed} questions={questions} onRestart={() => setSeed((n) => n + 1)} />
          ) : (
            <Flashcards key={`cards-${seed}`} cards={cards} title="Révision" />
          )}
        </div>
      </div>
    );
  }

  /* ── Choix des cours ── */
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-16 pt-10">
      <div className="flex items-center gap-2">
        <h1 className="mk-display text-[40px] leading-tight">Réviser</h1>
        <span className="rounded-full px-2 py-0.5 text-[11.5px] font-medium" style={{ background: "rgba(201,184,255,0.12)", color: "var(--mk-lilac)" }}>
          Pro
        </span>
      </div>
      <p className="mt-2 max-w-lg text-[15px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
        Coche les cours qui tombent à ton partiel. ECO mélange leurs questions dans un seul quiz et réunit toutes leurs notions en flashcards.
      </p>
      {!isPro && (
        <p className="mt-4 rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed" style={{ borderColor: "rgba(201,184,255,0.25)", background: "rgba(201,184,255,0.05)", color: "#C9C6C0" }}>
          <Lock className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" style={{ color: "var(--mk-lilac)" }} />
          Réviser plusieurs cours ensemble fait partie de Pro. Chaque fiche garde son propre quiz et ses flashcards, dans toutes les offres.
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-[14px]" style={{ color: "var(--mk-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement de tes cours…
        </div>
      ) : ecos.length === 0 ? (
        <p className="py-12 text-[14.5px]" style={{ color: "var(--mk-muted)" }}>
          Aucun cours pour l&apos;instant. Enregistre ton premier cours, puis reviens ici pour réviser.
        </p>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Rechercher un cours</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--mk-faint)" }} />
              <input id="review-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un cours" className="app-input w-full !pl-9" />
            </label>
            <button type="button" onClick={toggleAllVisible} disabled={selectable.length === 0} className="app-btn app-btn-ghost shrink-0 disabled:opacity-40">
              {allVisibleSelected ? "Tout désélectionner" : `Tout sélectionner (${selectable.length})`}
            </button>
          </div>

          {usedFolders.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {[{ id: null as string | null, name: "Toutes les matières" }, ...usedFolders].map((f) => {
                const active = folderFilter === f.id;
                return (
                  <button
                    key={f.id ?? "all"}
                    type="button"
                    onClick={() => setFolderFilter(f.id)}
                    className="shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition-colors"
                    style={active ? { borderColor: "var(--mk-text)", background: "var(--mk-text)", color: "#0A0A0B" } : { borderColor: "var(--mk-line)", color: "var(--mk-muted)" }}
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
          )}

          <ul className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--mk-line)" }}>
            {visible.length === 0 && (
              <li className="px-5 py-8 text-center text-[14px]" style={{ color: "var(--mk-muted)" }}>
                Aucun cours ne correspond.
              </li>
            )}
            {visible.map((e, i) => {
              const s = stats.get(e.id) ?? { questions: 0, cards: 0 };
              const disabled = s.questions === 0 && s.cards === 0;
              const checked = selected.has(e.id);
              return (
                <li key={e.id} className={i > 0 ? "border-t" : ""} style={{ borderColor: "var(--mk-line)" }}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={disabled}
                    onClick={() => toggle(e.id)}
                    className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors enabled:hover:bg-white/[0.025] disabled:cursor-not-allowed disabled:opacity-45 sm:px-5"
                    style={checked ? { background: "rgba(201,184,255,0.05)" } : undefined}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors"
                      style={checked ? { borderColor: "var(--mk-lilac)", background: "var(--mk-lilac)" } : { borderColor: "var(--mk-line-strong)" }}
                    >
                      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: "#0A0A0B" }} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px]" style={{ color: "var(--mk-text)" }}>
                        {e.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: "var(--mk-faint)" }}>
                        {e.folder && folderName.get(e.folder) ? `${folderName.get(e.folder)} · ` : ""}
                        {formatMeta(e)}
                        <span className="sm:hidden">{disabled ? " · fiche en préparation" : ` · ${s.questions} Q · ${plural(s.cards, "carte")}`}</span>
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-right text-[12.5px] tabular-nums sm:block" style={{ color: "var(--mk-muted)" }}>
                      {disabled ? "Fiche en préparation" : `${plural(s.questions, "question")} · ${plural(s.cards, "carte")}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] z-20 mt-6">
          <div
            className="flex flex-col gap-3 rounded-2xl border p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] sm:flex-row sm:items-center sm:justify-between sm:pl-5"
            style={{ borderColor: "var(--mk-line-strong)", background: "rgba(17,17,19,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
          >
            <p className="text-[13.5px]" style={{ color: "var(--mk-text)" }}>
              {selected.size} cours
              <span style={{ color: "var(--mk-muted)" }}>
                {" "}· {plural(totals.questions, "question")} · {plural(totals.cards, "carte")}
              </span>
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => start("cards")} disabled={totals.cards === 0} className="app-btn app-btn-ghost flex-1 disabled:opacity-40 sm:flex-none">
                <Layers className="h-4 w-4" /> Flashcards
              </button>
              <button type="button" onClick={() => start("quiz")} disabled={totals.questions === 0} className="app-btn app-btn-primary flex-1 disabled:opacity-40 sm:flex-none">
                <ListChecks className="h-4 w-4" /> Lancer le quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
