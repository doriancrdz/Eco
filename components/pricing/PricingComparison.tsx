import { Check, Minus } from "lucide-react";
import { MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";

type Cell = boolean | string;

const COLUMNS = ["Gratuit", "Student", "Pro", "Business"] as const;

const GROUPS: Array<{ title: string; rows: Array<{ label: string; cells: [Cell, Cell, Cell, Cell] }> }> = [
  {
    title: "Minutes",
    rows: [
      { label: "Minutes par mois", cells: ["10 min", "800 min", "2 000 min", "Sur mesure"] },
      { label: "Heures de cours, environ", cells: ["—", "13 h", "33 h", "Sur mesure"] },
      { label: "Durée max par enregistrement", cells: Array(4).fill(`${MAX_RECORDING_DURATION_MINUTES} min`) as [Cell, Cell, Cell, Cell] },
      { label: "Packs de minutes en plus", cells: [true, true, true, true] },
    ],
  },
  {
    title: "Chaque cours",
    rows: [
      { label: "Fiche structurée : intro, contenu, conclusion", cells: [true, true, true, true] },
      { label: "Points clés et notions définies", cells: [true, true, true, true] },
      { label: "Quiz et flashcards", cells: [true, true, true, true] },
      { label: "Export Anki", cells: [true, true, true, true] },
      { label: "Transcription complète", cells: [true, true, true, true] },
      { label: "PDF du prof comme contexte", cells: [true, true, true, true] },
      { label: "Son d'un onglet (visio dans Chrome ou Edge)", cells: [true, true, true, true] },
      { label: "Matières et recherche", cells: [true, true, true, true] },
    ],
  },
  {
    title: "Révisions",
    rows: [
      { label: "Réviser par matière : quiz mélangé de tous tes cours", cells: [false, false, true, true] },
      { label: "Toutes les notions d'une matière en flashcards", cells: [false, false, true, true] },
      { label: "Export PDF des fiches", cells: [false, false, true, true] },
    ],
  },
  {
    title: "Accompagnement",
    rows: [
      { label: "Support par e-mail", cells: [true, true, true, true] },
      { label: "Support prioritaire", cells: [false, false, true, true] },
      { label: "Comptes pour tout un groupe, facture unique", cells: [false, false, false, true] },
    ],
  },
];

function CellValue({ value, highlight }: { value: Cell; highlight: boolean }) {
  if (value === true) return <Check className="mx-auto h-4 w-4" strokeWidth={2} style={{ color: highlight ? "var(--mk-lilac)" : "var(--mk-text)" }} aria-label="Inclus" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4" strokeWidth={1.5} style={{ color: "#4A4946" }} aria-label="Non inclus" />;
  return <span style={{ color: "var(--mk-text)" }}>{value}</span>;
}

export default function PricingComparison() {
  return (
    <div className="mk-card overflow-hidden">
      <div className="px-7 pt-8 sm:px-10">
        <p className="text-[15px] font-medium" style={{ color: "var(--mk-text)" }}>
          Comparer les offres
        </p>
        <p className="mt-1 text-[14px]" style={{ color: "var(--mk-muted)" }}>
          L&apos;essentiel est inclus partout, même en gratuit. Pro ajoute les outils pour réviser une matière entière.
        </p>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[14px]">
          <thead>
            <tr>
              <th className="w-[40%] px-7 py-3 text-left font-normal sm:px-10" />
              {COLUMNS.map((c) => (
                <th key={c} className="px-3 py-3 text-center text-[13px] font-medium" style={{ color: c === "Pro" ? "var(--mk-lilac)" : "var(--mk-text)" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          {GROUPS.map((group) => (
            <tbody key={group.title}>
              <tr>
                <th colSpan={5} className="px-7 pb-2 pt-7 text-left text-[11.5px] font-medium uppercase tracking-[0.08em] sm:px-10" style={{ color: "var(--mk-faint)" }}>
                  {group.title}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label} className="border-t" style={{ borderColor: "var(--mk-line)" }}>
                  <td className="px-7 py-3 sm:px-10" style={{ color: "#C9C6C0" }}>
                    {row.label}
                  </td>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="px-3 py-3 text-center tabular-nums" style={i === 2 ? { background: "rgba(201,184,255,0.035)" } : undefined}>
                      <CellValue value={cell} highlight={i === 2} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <div className="h-6" />
    </div>
  );
}
