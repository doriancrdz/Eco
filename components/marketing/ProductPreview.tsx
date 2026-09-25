"use client";

import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";

const SAMPLE = {
  title: "La politique monétaire de la BCE face à l'inflation",
  meta: "Macroéconomie · 58 min",
  sections: [
    {
      heading: "Le mandat de la BCE",
      body: "La Banque centrale européenne a pour objectif principal la stabilité des prix. Depuis la revue stratégique de 2021, cette cible est définie comme une inflation de 2 % à moyen terme, de manière symétrique : un écart à la baisse est jugé aussi indésirable qu'un écart à la hausse.",
    },
    {
      heading: "Les instruments conventionnels",
      list: [
        ["Taux de la facilité de dépôt", "rémunération des liquidités que les banques placent auprès de la BCE, devenu le principal taux directeur."],
        ["Opérations principales de refinancement", "coût auquel les banques empruntent des liquidités à une semaine."],
        ["Réserves obligatoires", "part des dépôts que les banques doivent conserver auprès de la banque centrale."],
      ],
    },
    {
      heading: "La transmission à l'économie réelle",
      body: "Une hausse des taux renchérit le crédit pour les ménages et les entreprises, ce qui freine l'investissement et la consommation. Le professeur insiste sur les délais : les effets sur les prix apparaissent généralement entre 12 et 24 mois après la décision.",
    },
  ],
  notions: [
    ["Taux directeur", "Taux d'intérêt fixé par la banque centrale, qui sert de référence au coût du crédit dans toute l'économie."],
    ["Assouplissement quantitatif (QE)", "Achats massifs de titres par la banque centrale pour faire baisser les taux longs et injecter des liquidités."],
    ["Canal des anticipations", "Mécanisme par lequel la politique monétaire agit à travers les attentes des agents sur l'inflation future."],
  ],
  quiz: {
    question: "Depuis 2021, comment la BCE définit-elle son objectif d'inflation ?",
    options: [
      "Inférieure mais proche de 2 %",
      "2 % à moyen terme, de manière symétrique",
      "Entre 1 % et 3 % chaque année",
      "Une inflation nulle sur le long terme",
    ],
    answer: 1,
  },
  transcript:
    "… donc ce qu'il faut bien retenir, c'est que depuis la revue stratégique de 2021, la BCE ne dit plus « inférieur mais proche de 2 % ». Elle dit 2 % à moyen terme, et c'est symétrique. Ça veut dire quoi, symétrique ? Ça veut dire qu'une inflation à 1 % pendant longtemps, c'est un problème au même titre qu'une inflation à 3 %. Et c'est important pour la suite, parce que quand on va parler des taux négatifs…",
};

const TABS = ["Résumé", "Notions", "Quiz", "Flashcards", "Transcription"] as const;
type Tab = (typeof TABS)[number];

function Summary() {
  return (
    <div className="space-y-7">
      {SAMPLE.sections.map((s) => (
        <div key={s.heading}>
          <h4 className="text-[15px] font-semibold" style={{ color: "var(--mk-text)" }}>
            {s.heading}
          </h4>
          {s.body && (
            <p className="mt-2 text-[14.5px] leading-[1.7]" style={{ color: "#B9B7B1" }}>
              {s.body}
            </p>
          )}
          {s.list && (
            <ul className="mt-2 space-y-2">
              {s.list.map(([term, def]) => (
                <li key={term} className="flex gap-3 text-[14.5px] leading-[1.7]" style={{ color: "#B9B7B1" }}>
                  <span className="mt-[11px] h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--mk-lilac)" }} />
                  <span>
                    <span style={{ color: "var(--mk-text)" }}>{term}</span> : {def}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Notions() {
  return (
    <dl className="divide-y" style={{ borderColor: "var(--mk-line)" }}>
      {SAMPLE.notions.map(([term, def]) => (
        <div key={term} className="grid gap-1 py-4 first:pt-0 sm:grid-cols-[200px_1fr] sm:gap-6" style={{ borderColor: "var(--mk-line)" }}>
          <dt className="text-[14.5px] font-medium" style={{ color: "var(--mk-text)" }}>
            {term}
          </dt>
          <dd className="text-[14.5px] leading-[1.7]" style={{ color: "#B9B7B1" }}>
            {def}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Quiz() {
  const [picked, setPicked] = useState<number | null>(null);
  const { question, options, answer } = SAMPLE.quiz;
  return (
    <div>
      <p className="text-[12px]" style={{ color: "var(--mk-faint)" }}>
        Question 1 sur 8 · QCM
      </p>
      <p className="mt-2 text-[16px] font-medium leading-snug" style={{ color: "var(--mk-text)" }}>
        {question}
      </p>
      <div className="mt-5 space-y-2">
        {options.map((opt, i) => {
          const isAnswer = i === answer;
          const isPicked = i === picked;
          const revealed = picked !== null;
          let border = "var(--mk-line)";
          let bg = "transparent";
          let color = "#B9B7B1";
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
              onClick={() => setPicked(i)}
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[14.5px] transition-colors enabled:hover:bg-white/[0.03]"
              style={{ borderColor: border, background: bg, color }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px]"
                style={{ borderColor: "var(--mk-line-strong)" }}
              >
                {revealed && isAnswer ? <Check className="h-3.5 w-3.5" /> : revealed && isPicked ? <X className="h-3.5 w-3.5" /> : "ABCD"[i]}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex h-6 items-center justify-between text-[13px]" style={{ color: "var(--mk-muted)" }}>
        <span>{picked === null ? "Choisis une réponse." : picked === answer ? "Bonne réponse." : "Pas tout à fait. La bonne réponse est en vert."}</span>
        {picked !== null && (
          <button type="button" onClick={() => setPicked(null)} className="inline-flex items-center gap-1.5 hover:text-[var(--mk-text)]">
            <RotateCcw className="h-3.5 w-3.5" /> Recommencer
          </button>
        )}
      </div>
    </div>
  );
}

function Flashcards() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [term, def] = SAMPLE.notions[index];
  const next = () => {
    setFlipped(false);
    setIndex((i) => (i + 1) % SAMPLE.notions.length);
  };
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="relative h-[190px] w-full max-w-md [perspective:1200px]"
        aria-label={flipped ? "Voir le terme" : "Voir la définition"}
      >
        <span
          className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
        >
          <span
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border px-8 text-center [backface-visibility:hidden]"
            style={{ borderColor: "var(--mk-line-strong)", background: "var(--mk-surface-2)" }}
          >
            <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--mk-faint)" }}>
              Notion
            </span>
            <span className="mk-display mt-3 text-[30px]" style={{ color: "var(--mk-text)" }}>
              {term}
            </span>
          </span>
          <span
            className="absolute inset-0 flex items-center justify-center rounded-2xl border px-8 text-center text-[15px] leading-relaxed [backface-visibility:hidden] [transform:rotateY(180deg)]"
            style={{ borderColor: "rgba(201,184,255,0.35)", background: "#18161F", color: "#D6D3CD" }}
          >
            {def}
          </span>
        </span>
      </button>
      <div className="mt-5 flex w-full max-w-md items-center justify-between text-[13px]" style={{ color: "var(--mk-muted)" }}>
        <span>
          Carte {index + 1} / {SAMPLE.notions.length} · clique pour retourner
        </span>
        <button type="button" onClick={next} className="hover:text-[var(--mk-text)]">
          Suivante →
        </button>
      </div>
    </div>
  );
}

function Transcript() {
  return (
    <p className="text-[14.5px] leading-[1.8]" style={{ color: "#B9B7B1" }}>
      <span className="mr-2 font-mono text-[12px]" style={{ color: "var(--mk-faint)" }}>
        23:41
      </span>
      {SAMPLE.transcript}
    </p>
  );
}

export default function ProductPreview() {
  const [tab, setTab] = useState<Tab>("Résumé");

  return (
    <div
      className="overflow-hidden rounded-[22px] border shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
      style={{ borderColor: "var(--mk-line-strong)", background: "var(--mk-surface)" }}
    >
      <div className="border-b px-5 pb-0 pt-5 sm:px-8 sm:pt-7" style={{ borderColor: "var(--mk-line)" }}>
        <p className="text-[12.5px]" style={{ color: "var(--mk-faint)" }}>
          {SAMPLE.meta}
        </p>
        <h3 className="mt-1.5 text-[19px] font-semibold leading-snug tracking-[-0.01em] sm:text-[22px]" style={{ color: "var(--mk-text)" }}>
          {SAMPLE.title}
        </h3>
        <div role="tablist" aria-label="Contenu généré" className="scrollbar-hide -mb-px mt-5 flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="shrink-0 border-b-2 pb-3 text-[14px] transition-colors"
              style={{
                borderColor: tab === t ? "var(--mk-text)" : "transparent",
                color: tab === t ? "var(--mk-text)" : "var(--mk-muted)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" className="min-h-[380px] px-5 py-7 sm:px-8 sm:py-8">
        {tab === "Résumé" && <Summary />}
        {tab === "Notions" && <Notions />}
        {tab === "Quiz" && <Quiz />}
        {tab === "Flashcards" && <Flashcards />}
        {tab === "Transcription" && <Transcript />}
      </div>
    </div>
  );
}
