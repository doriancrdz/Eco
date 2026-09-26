"use client";

import { useState } from "react";
import { Briefcase, GraduationCap, Loader2, Shuffle, Sparkles } from "lucide-react";
import Dialog from "@/components/ui/Dialog";

export type Segment = "etudiant" | "alternant" | "salarie" | "autre";

export const SEGMENTS: Array<{ id: Segment; label: string; hint: string; icon: typeof GraduationCap }> = [
  { id: "etudiant", label: "Étudiant", hint: "Cours en amphi, en TD ou en visio", icon: GraduationCap },
  { id: "alternant", label: "Alternant", hint: "Des cours à l'école et des réunions en entreprise", icon: Shuffle },
  { id: "salarie", label: "Salarié ou indépendant", hint: "Réunions, formations, conférences", icon: Briefcase },
  { id: "autre", label: "Autre", hint: "Podcasts, conférences, usage perso", icon: Sparkles },
];

interface OnboardingModalProps {
  open: boolean;
  onSelect: (segment: Segment) => Promise<void>;
  onSkip: () => void;
}

/** Une seule question à la première connexion : sert à adapter l'accueil et à mesurer qui utilise ECO. */
export default function OnboardingModal({ open, onSelect, onSkip }: OnboardingModalProps) {
  const [saving, setSaving] = useState<Segment | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !saving && onSkip()}
      title="Bienvenue sur ECO"
      description="Une seule question pour adapter ton espace : tu vas surtout enregistrer quoi ?"
    >
      <div className="mt-2 grid gap-2">
        {SEGMENTS.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            type="button"
            disabled={!!saving}
            onClick={async () => {
              setSaving(id);
              try {
                await onSelect(id);
              } finally {
                setSaving(null);
              }
            }}
            className="flex w-full items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition-colors enabled:hover:border-white/[0.18] enabled:hover:bg-white/[0.03] disabled:opacity-60"
            style={{ borderColor: "rgba(255,255,255,0.10)" }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(201,184,255,0.1)", color: "#C9B8FF" }}>
              {saving === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" strokeWidth={1.75} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-medium" style={{ color: "#EDECE8" }}>
                {label}
              </span>
              <span className="block text-[12.5px]" style={{ color: "#9A9893" }}>
                {hint}
              </span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onSkip} disabled={!!saving} className="mt-4 w-full text-center text-[12.5px] underline-offset-4 hover:underline" style={{ color: "#7C7A76" }}>
        Passer cette question
      </button>
    </Dialog>
  );
}
