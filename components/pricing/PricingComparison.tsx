import { AudioLines, FileText, FolderClosed, Layers, ListChecks, MonitorSpeaker, NotebookPen, ScrollText } from "lucide-react";

const INCLUDED = [
  { icon: NotebookPen, label: "Résumé structuré par thème" },
  { icon: ListChecks, label: "Points clés et notions définies" },
  { icon: Layers, label: "Quiz, flashcards et export Anki" },
  { icon: ScrollText, label: "Transcription complète" },
  { icon: FileText, label: "PDF du prof comme contexte" },
  { icon: MonitorSpeaker, label: "Son d'un onglet (visio dans Chrome)" },
  { icon: FolderClosed, label: "Dossiers par matière et recherche" },
  { icon: AudioLines, label: "Enregistrement depuis le navigateur" },
];

export default function PricingComparison() {
  return (
    <div className="mk-card p-7 sm:p-10">
      <p className="text-[15px] font-medium" style={{ color: "var(--mk-text)" }}>
        Inclus dans tous les plans, même gratuit
      </p>
      <p className="mt-1 text-[14px]" style={{ color: "var(--mk-muted)" }}>
        Les plans ne diffèrent que par le nombre de minutes. Aucune fonctionnalité n&apos;est bloquée.
      </p>
      <ul className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {INCLUDED.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-3 text-[14px]" style={{ color: "#C9C6C0" }}>
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} style={{ color: "var(--mk-lilac)" }} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
