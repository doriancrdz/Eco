"use client";

import { useState, useRef, useEffect } from "react";
import { BookOpen, Mic, FileText, FolderTree, Sparkles, X, BarChart2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function GuideDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none"
        style={{ color: "rgba(237,236,232,0.45)" }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(255,255,255,0.07)";
          e.currentTarget.style.color = "rgba(237,236,232,0.8)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "rgba(237,236,232,0.45)";
        }}
        aria-label="Guide d'utilisation"
      >
        <BookOpen style={{ width: 15, height: 15 }} />
        <span className="hidden sm:inline text-xs">Guide</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              onClick={() => setIsOpen(false)}
              aria-hidden
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-4 top-16 md:absolute md:top-full md:left-0 md:right-auto md:inset-x-auto md:mt-2 w-auto md:w-80 max-h-[80vh] rounded-2xl overflow-y-auto z-50 scrollbar-hide"
              style={{
                background: "#141619",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
              }}
            >
              {/* Header */}
              <div
                className="sticky top-0 px-5 py-4 flex items-center justify-between"
                style={{
                  background: "#141619",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.2)" }}
                  >
                    <Sparkles style={{ width: 14, height: 14, color: "#A78BFA" }} />
                  </div>
                  <h3 className="font-bold text-base" style={{ color: "#EDECE8" }}>
                    Comment utiliser ECO
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "rgba(237,236,232,0.35)" }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                    e.currentTarget.style.color = "rgba(237,236,232,0.7)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(237,236,232,0.35)";
                  }}
                  aria-label="Fermer"
                >
                  <X style={{ width: 15, height: 15 }} />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}
                  >
                    <Mic style={{ width: 15, height: 15, color: "#818CF8" }} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1" style={{ color: "#EDECE8" }}>
                      1. Enregistrer un audio
                    </h4>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(237,236,232,0.5)" }}>
                      Clique sur le micro pour commencer. Parle clairement (cours, conférence, vidéo YouTube). Clique sur &quot;Terminer&quot; quand tu as fini.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}
                  >
                    <FileText style={{ width: 15, height: 15, color: "#A78BFA" }} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1" style={{ color: "#EDECE8" }}>
                      2. Obtenir ton résumé
                    </h4>
                    <ul className="text-xs leading-relaxed space-y-1" style={{ color: "rgba(237,236,232,0.5)" }}>
                      <li>• Transcription automatique en 1-2 minutes</li>
                      <li>• Résumé structuré (intro/dév/conclu)</li>
                      <li>• Points clés détaillés</li>
                      <li>• Notions importantes avec définitions</li>
                    </ul>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.2)" }}
                  >
                    <FolderTree style={{ width: 15, height: 15, color: "#5EEAD4" }} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1" style={{ color: "#EDECE8" }}>
                      3. Organiser tes ECOs
                    </h4>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(237,236,232,0.5)" }}>
                      Crée des dossiers pour classer tes enregistrements. Recherche par titre ou contenu. Archive ou supprime ce dont tu n&apos;as plus besoin.
                    </p>
                  </div>
                </div>

                {/* Plans */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(139,92,246,0.08)",
                    border: "1px solid rgba(139,92,246,0.15)",
                  }}
                >
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-1.5" style={{ color: "#EDECE8" }}>
                    <BarChart2 style={{ width: 14, height: 14, color: "#A78BFA" }} />
                    Limites par plan
                  </h4>
                  <div className="space-y-1.5 text-xs" style={{ color: "rgba(237,236,232,0.6)" }}>
                    {[
                      { plan: "Free", min: "10 min/mois" },
                      { plan: "Student", min: "800 min/mois" },
                      { plan: "Pro", min: "2000 min/mois" },
                      { plan: "Business", min: "6000 min/mois" },
                    ].map(({ plan, min }) => (
                      <div key={plan} className="flex justify-between">
                        <span>{plan}</span>
                        <span className="font-medium" style={{ color: "rgba(237,236,232,0.8)" }}>{min}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => { router.push("/pricing"); setIsOpen(false); }}
                    className="mt-3 w-full py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)",
                      color: "white",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    Voir tous les plans
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
