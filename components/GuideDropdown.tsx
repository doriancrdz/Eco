"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CircleHelp, FileText, FolderClosed, Layers, Mic, MonitorSpeaker, X } from "lucide-react";
import { MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";

const STEPS = [
  {
    icon: Mic,
    title: "Enregistre ton cours",
    body: `Clique sur « Enregistrer » au début du cours et garde l'écran allumé. Jusqu'à ${MAX_RECORDING_DURATION_MINUTES} minutes par enregistrement.`,
  },
  {
    icon: MonitorSpeaker,
    title: "Cours en visio",
    body: "Sur ordinateur, avec Chrome ou Edge, choisis « Son d'un onglet » puis l'onglet de Teams, Meet ou Zoom, en cochant « Partager l'audio ».",
  },
  {
    icon: FileText,
    title: "Ajoute le PDF du prof",
    body: "Avant d'enregistrer, joins le support du cours : les notions et le quiz reprendront son vocabulaire.",
  },
  {
    icon: Layers,
    title: "Révise",
    body: "Quelques minutes après la fin : résumé par thème, points clés, notions, quiz, flashcards (export Anki) et transcription.",
  },
  {
    icon: FolderClosed,
    title: "Range par matière",
    body: "Crée une matière dans la barre latérale, puis déplace tes cours dedans avec le menu « … ».",
  },
];

export default function GuideDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setIsOpen((o) => !o)} className="app-icon-btn" aria-label="Guide d'utilisation" aria-expanded={isOpen}>
        <CircleHelp className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-3 top-14 z-50 max-h-[80vh] overflow-y-auto rounded-2xl border md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-[360px]"
            style={{ background: "#161618", borderColor: "rgba(255,255,255,0.09)", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
            role="dialog"
            aria-label="Guide d'utilisation"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <p className="text-[15px] font-medium" style={{ color: "#EDECE8" }}>
                Bien utiliser ECO
              </p>
              <button type="button" onClick={() => setIsOpen(false)} className="app-icon-btn app-icon-btn-sm" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="space-y-4 px-5 pb-4 pt-2">
              {STEPS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: "#C9B8FF" }} />
                  <div>
                    <p className="text-[13.5px] font-medium" style={{ color: "#EDECE8" }}>
                      {title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: "#9A9893" }}>
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t px-5 py-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push("/pricing");
                }}
                className="text-[13px] underline-offset-4 hover:underline"
                style={{ color: "#9A9893" }}
              >
                Voir les offres et les minutes incluses →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
