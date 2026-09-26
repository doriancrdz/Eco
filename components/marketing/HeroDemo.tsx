"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileText, FolderClosed, Layers, ListChecks, Loader2, Mic, NotebookPen } from "lucide-react";

/**
 * Démo animée du produit (remplace l'ancienne vidéo) : enregistrement → traitement → fiche.
 * 100 % CSS/JS, rien à télécharger. Boucle tant que la démo est visible à l'écran.
 */

type Phase = "record" | "process" | "fiche";
const DURATIONS: Record<Phase, number> = { record: 4200, process: 3000, fiche: 7000 };
const NEXT: Record<Phase, Phase> = { record: "process", process: "fiche", fiche: "record" };

const SUBJECTS = [
  { name: "Macroéconomie", count: 12, active: true },
  { name: "Droit des contrats", count: 9 },
  { name: "Finance d'entreprise", count: 7 },
  { name: "Marketing", count: 5 },
];

const BARS = 36;

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function RecordPhase({ elapsed }: { elapsed: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(248,113,113,0.12)" }}>
        <span className="absolute inset-0 animate-ping rounded-full" style={{ background: "rgba(248,113,113,0.12)", animationDuration: "1.8s" }} />
        <Mic className="relative h-6 w-6" style={{ color: "#FCA5A5" }} />
      </span>
      <p className="mt-5 text-[12.5px]" style={{ color: "#FCA5A5" }}>
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#F87171] align-middle" />
        Enregistrement · Macroéconomie, amphi B
      </p>
      <div className="mt-6 flex h-12 items-center gap-[3px]" aria-hidden>
        {Array.from({ length: BARS }).map((_, i) => (
          <span
            key={i}
            className="hero-bar w-[3px] rounded-full"
            style={{ animationDelay: `${(i * 97) % 900}ms`, background: i % 5 === 0 ? "var(--mk-lilac)" : "rgba(237,236,232,0.55)" }}
          />
        ))}
      </div>
      <p className="mk-display mt-4 text-[44px] tabular-nums leading-none" style={{ color: "var(--mk-text)" }}>
        {formatTimer(elapsed)}
      </p>
      <p className="mt-3 text-[12.5px]" style={{ color: "var(--mk-faint)" }}>
        Tu écoutes le prof. ECO prend les notes.
      </p>
    </div>
  );
}

const STEPS = ["Audio envoyé", "Transcription du cours", "Rédaction de la fiche"];

function ProcessPhase({ step }: { step: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <p className="mk-display text-[26px]" style={{ color: "var(--mk-text)" }}>
        Ta fiche se prépare
      </p>
      <ul className="mt-6 w-full max-w-[260px] space-y-3 text-left">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex items-center gap-3 text-[13.5px]" style={{ color: done || current ? "var(--mk-text)" : "var(--mk-faint)" }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border" style={{ borderColor: done ? "transparent" : "var(--mk-line-strong)", background: done ? "var(--mk-text)" : "transparent" }}>
                {done ? <Check className="h-3 w-3" style={{ color: "#0A0A0B" }} strokeWidth={3} /> : current ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              </span>
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FichePhase() {
  return (
    <div className="h-full overflow-hidden px-5 py-5 sm:px-7 sm:py-6">
      <p className="hero-in text-[11.5px]" style={{ color: "var(--mk-faint)" }}>
        14 octobre · 58 min · avec le PDF du cours
      </p>
      <p className="hero-in mk-display mt-1.5 text-[22px] leading-tight sm:text-[26px]" style={{ color: "var(--mk-text)", animationDelay: "80ms" }}>
        La politique monétaire de la BCE face à l&apos;inflation
      </p>
      <div className="hero-in mt-4 flex gap-4 border-b text-[12px]" style={{ borderColor: "var(--mk-line)", animationDelay: "160ms" }}>
        {[
          ["Résumé", NotebookPen],
          ["Notions", FileText],
          ["Quiz", ListChecks],
          ["Flashcards", Layers],
        ].map(([label, Icon], i) => {
          const I = Icon as typeof NotebookPen;
          return (
            <span key={label as string} className="-mb-px flex items-center gap-1.5 border-b pb-2" style={{ borderColor: i === 0 ? "var(--mk-text)" : "transparent", color: i === 0 ? "var(--mk-text)" : "var(--mk-faint)" }}>
              <I className="h-3 w-3" /> {label as string}
            </span>
          );
        })}
      </div>
      <div className="mt-4 space-y-3 text-[12.5px] leading-relaxed sm:text-[13px]">
        <div className="hero-in" style={{ animationDelay: "320ms" }}>
          <p className="font-medium" style={{ color: "var(--mk-text)" }}>Introduction</p>
          <p style={{ color: "#B9B7B1" }}>Le cours explique comment la BCE utilise ses taux directeurs pour ramener l&apos;inflation vers sa cible de 2&nbsp;%.</p>
        </div>
        <div className="hero-in" style={{ animationDelay: "560ms" }}>
          <p className="font-medium" style={{ color: "var(--mk-text)" }}>Contenu</p>
          <ol className="mt-0.5 list-decimal space-y-1 pl-4" style={{ color: "#B9B7B1" }}>
            <li>Le mandat : stabilité des prix, cible symétrique de 2&nbsp;% à moyen terme.</li>
            <li>Les instruments : facilité de dépôt, refinancement, réserves obligatoires.</li>
            <li className="hidden sm:list-item">La transmission : effets sur les prix entre 12 et 24 mois après la décision.</li>
          </ol>
        </div>
        <div className="hero-in flex flex-wrap gap-1.5 pt-1" style={{ animationDelay: "820ms" }}>
          {["Taux directeur", "Assouplissement quantitatif", "Canal des anticipations"].map((n) => (
            <span key={n} className="rounded-full border px-2.5 py-1 text-[11.5px]" style={{ borderColor: "rgba(201,184,255,0.3)", color: "#DDD3FF", background: "rgba(201,184,255,0.06)" }}>
              {n}
            </span>
          ))}
        </div>
        <div className="hero-in hidden grid-cols-2 gap-3 pt-3 sm:grid" style={{ animationDelay: "1080ms" }}>
          {[
            [ListChecks, "Quiz prêt", "8 questions sur ce cours"],
            [Layers, "Flashcards", "12 cartes · export Anki"],
          ].map(([Icon, title, sub]) => {
            const I = Icon as typeof ListChecks;
            return (
              <div key={title as string} className="flex items-center gap-3 rounded-xl border px-3.5 py-3" style={{ borderColor: "var(--mk-line)", background: "rgba(255,255,255,0.02)" }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(201,184,255,0.1)", color: "var(--mk-lilac)" }}>
                  <I className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[12.5px] font-medium" style={{ color: "var(--mk-text)" }}>{title as string}</span>
                  <span className="block text-[11.5px]" style={{ color: "var(--mk-faint)" }}>{sub as string}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function HeroDemo() {
  const [phase, setPhase] = useState<Phase>("record");
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  // Pause quand la démo sort de l'écran (batterie, CPU).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("fiche");
      return;
    }
    if (!visible) return;
    const t = setTimeout(() => setPhase((p) => NEXT[p]), DURATIONS[phase]);
    return () => clearTimeout(t);
  }, [phase, visible]);

  // Minuteur accéléré : ~52 minutes de cours condensées en 4 secondes.
  useEffect(() => {
    if (phase !== "record" || !visible) return;
    setElapsed(0);
    const start = performance.now();
    const id = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / (DURATIONS.record - 400));
      setElapsed(Math.round(t * (52 * 60 + 14)));
    }, 50);
    return () => clearInterval(id);
  }, [phase, visible]);

  useEffect(() => {
    if (phase !== "process") return;
    setStep(0);
    const a = setTimeout(() => setStep(1), 700);
    const b = setTimeout(() => setStep(2), 1700);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [phase]);

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-[18px] border text-left shadow-[0_50px_140px_-30px_rgba(0,0,0,0.95)] sm:rounded-[22px]"
      style={{ borderColor: "var(--mk-line-strong)", background: "#0C0C0E" }}
      role="img"
      aria-label="Démonstration d'ECO : un cours est enregistré, transcrit, puis transformé en fiche avec résumé et notions."
    >
      <div className="flex h-10 items-center gap-3 border-b px-4" style={{ borderColor: "var(--mk-line)" }}>
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.09)" }} />
          ))}
        </span>
        <span className="mx-auto rounded-md px-3 py-0.5 text-[11.5px]" style={{ background: "rgba(255,255,255,0.04)", color: "var(--mk-faint)" }}>
          econewapp.com/app
        </span>
        <span className="w-[42px]" aria-hidden />
      </div>
      <div className="grid h-[400px] sm:h-[430px] md:grid-cols-[210px_1fr]">
        <aside className="hidden border-r px-3 py-4 md:block" style={{ borderColor: "var(--mk-line)", background: "#0E0E10" }}>
          <p className="px-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--mk-faint)" }}>
            Matières
          </p>
          <ul className="mt-2 space-y-0.5">
            {SUBJECTS.map((s) => (
              <li key={s.name} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px]" style={{ background: s.active ? "rgba(255,255,255,0.05)" : "transparent", color: s.active ? "var(--mk-text)" : "var(--mk-muted)" }}>
                <FolderClosed className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="tabular-nums" style={{ color: "var(--mk-faint)" }}>
                  {s.active && phase === "fiche" ? s.count + 1 : s.count}
                </span>
              </li>
            ))}
          </ul>
        </aside>
        <div className="relative min-w-0">
          <div key={phase} className="hero-phase absolute inset-0">
            {phase === "record" && <RecordPhase elapsed={elapsed} />}
            {phase === "process" && <ProcessPhase step={step} />}
            {phase === "fiche" && <FichePhase />}
          </div>
        </div>
      </div>
    </div>
  );
}
