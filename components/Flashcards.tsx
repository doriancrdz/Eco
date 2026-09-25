"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, RotateCcw, Shuffle } from "lucide-react";
import type { QuizQuestion } from "@/types";

export interface Flashcard {
  front: string;
  back: string;
  kind: "Notion" | "Question";
}

type RawNotion = { terme?: string; definition?: string } | string;

/** Construit le paquet à partir de ce qui a déjà été généré (notions + questions ouvertes) : aucun appel IA. */
export function buildFlashcards(notions: RawNotion[] | undefined, quiz: QuizQuestion[] | null | undefined): Flashcard[] {
  const cards: Flashcard[] = [];
  for (const n of notions ?? []) {
    if (typeof n === "string") {
      const idx = n.indexOf(":");
      if (idx > 0) cards.push({ front: n.slice(0, idx).trim(), back: n.slice(idx + 1).trim(), kind: "Notion" });
    } else if (n?.terme && n?.definition) {
      cards.push({ front: n.terme.trim(), back: n.definition.trim(), kind: "Notion" });
    }
  }
  for (const q of quiz ?? []) {
    if (q.type === "open" && q.question && q.answer) {
      cards.push({ front: q.question.trim(), back: q.answer.replace(/^Réponse modèle\s*:\s*/i, "").trim(), kind: "Question" });
    }
  }
  return cards.filter((c) => c.front && c.back);
}

function toAnkiText(cards: Flashcard[]) {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();
  return ["#separator:tab", "#html:false", ...cards.map((c) => `${clean(c.front)}\t${clean(c.back)}`)].join("\n");
}

function slugify(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "eco"
  );
}

export default function Flashcards({ cards, title }: { cards: Flashcard[]; title: string }) {
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());

  useEffect(() => {
    setOrder(cards.map((_, i) => i));
    setPos(0);
    setFlipped(false);
    setKnown(new Set());
  }, [cards]);

  const remaining = useMemo(() => order.filter((i) => !known.has(i)), [order, known]);
  const current = remaining[Math.min(pos, remaining.length - 1)];
  const card = current !== undefined ? cards[current] : null;

  const go = useCallback(
    (delta: number) => {
      if (remaining.length === 0) return;
      setFlipped(false);
      setPos((p) => (p + delta + remaining.length) % remaining.length);
    },
    [remaining.length]
  );

  const markKnown = () => {
    if (current === undefined) return;
    setFlipped(false);
    setKnown((prev) => new Set(prev).add(current));
    setPos((p) => (remaining.length <= 1 ? 0 : p % (remaining.length - 1)));
  };

  const shuffle = () => {
    const next = [...order];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setOrder(next);
    setPos(0);
    setFlipped(false);
  };

  const restart = () => {
    setKnown(new Set());
    setPos(0);
    setFlipped(false);
  };

  const exportAnki = () => {
    const blob = new Blob([toAnkiText(cards)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(title)}-flashcards-anki.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (cards.length === 0) {
    return <p style={{ color: "rgba(237,236,232,0.35)" }}>Aucune flashcard disponible pour ce cours.</p>;
  }

  const btn =
    "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition-colors hover:bg-white/[0.08]";
  const btnStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(237,236,232,0.75)" };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-5 flex w-full max-w-xl items-center justify-between text-sm" style={{ color: "rgba(237,236,232,0.45)" }}>
        <span>
          {remaining.length > 0
            ? `Carte ${Math.min(pos, remaining.length - 1) + 1} / ${remaining.length}`
            : "Paquet terminé"}
          {known.size > 0 && ` · ${known.size} maîtrisée${known.size > 1 ? "s" : ""}`}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={shuffle} className={btn} style={btnStyle} aria-label="Mélanger">
            <Shuffle className="h-4 w-4" />
          </button>
          <button type="button" onClick={exportAnki} className={btn} style={btnStyle}>
            <Download className="h-4 w-4" /> Anki
          </button>
        </div>
      </div>

      {card ? (
        <>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="relative h-[240px] w-full max-w-xl [perspective:1400px]"
            aria-label={flipped ? "Voir le recto" : "Voir le verso"}
          >
            <span
              className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]"
              style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
            >
              <span
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl px-8 text-center [backface-visibility:hidden]"
                style={{ background: "#141619", border: "1px solid rgba(255,255,255,0.10)" }}
              >
                <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "rgba(237,236,232,0.35)" }}>
                  {card.kind}
                </span>
                <span className="mt-3 text-xl font-semibold leading-snug md:text-2xl" style={{ color: "#EDECE8" }}>
                  {card.front}
                </span>
              </span>
              <span
                className="absolute inset-0 flex items-center justify-center overflow-y-auto rounded-2xl px-8 py-6 text-center text-[15px] leading-relaxed [backface-visibility:hidden] [transform:rotateY(180deg)]"
                style={{ background: "#17151F", border: "1px solid rgba(201,184,255,0.30)", color: "rgba(237,236,232,0.85)" }}
              >
                {card.back}
              </span>
            </span>
          </button>
          <p className="mt-3 text-xs" style={{ color: "rgba(237,236,232,0.3)" }}>
            Clique ou appuie sur Espace pour retourner · ← → pour naviguer
          </p>
          <div className="mt-6 flex w-full max-w-xl items-center justify-between gap-3">
            <button type="button" onClick={() => go(-1)} className={btn} style={btnStyle} aria-label="Carte précédente">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => go(1)} className={btn} style={btnStyle}>
                À revoir
              </button>
              <button
                type="button"
                onClick={markKnown}
                className={btn}
                style={{ background: "rgba(134,239,172,0.10)", border: "1px solid rgba(134,239,172,0.30)", color: "#BBF7D0" }}
              >
                Je savais
              </button>
            </div>
            <button type="button" onClick={() => go(1)} className={btn} style={btnStyle} aria-label="Carte suivante">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-lg font-medium" style={{ color: "#EDECE8" }}>
            Tu maîtrises les {cards.length} cartes de ce cours.
          </p>
          <button type="button" onClick={restart} className={btn} style={btnStyle}>
            <RotateCcw className="h-4 w-4" /> Recommencer
          </button>
        </div>
      )}
    </div>
  );
}
