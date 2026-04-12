"use client";

import { useState, useRef, useEffect } from "react";
import { BookOpen, Mic, FileText, FolderTree, Sparkles, X, BarChart2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white/20 rounded-lg transition-colors"
        aria-label="Guide d'utilisation"
      >
        <BookOpen className="w-4 h-4" />
        <span className="hidden sm:inline">Guide d&apos;utilisation</span>
      </button>

      {isOpen && (
        <>
          {/* Overlay mobile : fermer au clic */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          {/* Dropdown : modal full-width sur mobile, position absolute sur desktop */}
          <div className="fixed inset-x-4 top-20 md:top-full md:left-0 md:right-auto md:inset-x-auto md:mt-2 w-auto md:w-80 max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
              <h3 className="font-bold text-lg text-gray-900">Comment utiliser ECO</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Mic className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">1. Enregistrer un audio</h4>
                  <p className="text-sm text-gray-600">
                    Clique sur le micro pour commencer. Parle clairement (cours, conférence, vidéo YouTube). Clique sur
                    &quot;Terminer&quot; quand tu as fini.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">2. Obtenir ton résumé</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Transcription automatique en 1-2 minutes</li>
                    <li>• Résumé structuré (intro/dév/conclu)</li>
                    <li>• Points clés détaillés</li>
                    <li>• Notions importantes avec définitions</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <FolderTree className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">3. Organiser tes ECOs</h4>
                  <p className="text-sm text-gray-600">
                    Crée des dossiers pour classer tes enregistrements. Recherche par titre ou contenu. Archive ou
                    supprime ce dont tu n&apos;as plus besoin.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-1.5"><BarChart2 className="w-4 h-4 text-violet-600" />Limites par plan</h4>
              <div className="space-y-1 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Free :</span>
                  <span className="font-medium">10 min/mois</span>
                </div>
                <div className="flex justify-between">
                  <span>Student :</span>
                  <span className="font-medium">800 min/mois</span>
                </div>
                <div className="flex justify-between">
                  <span>Pro :</span>
                  <span className="font-medium">2000 min/mois</span>
                </div>
                <div className="flex justify-between">
                  <span>Business :</span>
                  <span className="font-medium">6000 min/mois</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  router.push("/pricing");
                  setIsOpen(false);
                }}
                className="mt-3 w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2 rounded-lg hover:shadow-lg transition-all"
              >
                Voir tous les plans
              </button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
