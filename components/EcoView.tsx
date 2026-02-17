"use client";

import { useEffect, useRef, useState } from "react";
import { Eco } from "@/types";
import { motion } from "framer-motion";
import { Download, RefreshCw } from "lucide-react";
import { pollRecordingStatus, generateSummary } from "@/lib/transcription";
import { updateEco } from "@/lib/storage";
import type { Summary } from "@/lib/transcription";

const POLL_INTERVAL_MS = 1000;

function RelancerButton({ recordingId, onSuccess }: { recordingId: string; onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const summary = await generateSummary(recordingId);
      if (summary) {
        updateEco(recordingId, {
          title: summary.titre,
          summary_text: JSON.stringify(summary),
        });
        onSuccess?.();
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white/80 border border-gray-200 rounded-xl hover:bg-white transition-colors disabled:opacity-60"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Relance en cours…" : "Relancer la génération"}
    </button>
  );
}

interface EcoViewProps {
  eco: Eco | null;
  onRefresh?: () => void;
}

export default function EcoView({ eco, onRefresh }: EcoViewProps) {
  const [summaryFromPoll, setSummaryFromPoll] = useState<Summary | null | undefined>(undefined);
  const [aiStatus, setAiStatus] = useState<string>("IDLE");
  const [aiError, setAiError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling quand pas de résumé et eco a un id (= recordingId)
  useEffect(() => {
    if (!eco?.id || eco.summary_text) {
      setSummaryFromPoll(undefined);
      setAiStatus("IDLE");
      setAiError(null);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const result = await pollRecordingStatus(eco.id);
        setAiStatus(result.aiStatus ?? "IDLE");
        setAiError(result.aiError ?? null);

        if (result.aiStatus === "DONE" && result.summary) {
          setSummaryFromPoll(result.summary);
          updateEco(eco.id, {
            title: result.summary.titre || eco.title,
            summary_text: JSON.stringify(result.summary),
          });
          onRefresh?.();
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // Ignore poll errors
      }
    };

    poll(); // Premier appel immédiat
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [eco?.id, eco?.summary_text, eco?.title, onRefresh]);
  if (!eco) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Sélectionnez un Eco pour voir les détails</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex-1 overflow-y-auto p-4 md:p-8"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="floating-card rounded-card border border-white/40 p-10 mb-8"
        >
          <div className="mb-8 pb-6 border-b border-gray-200/30">
            <h1 className="text-4xl font-semibold text-gray-900 mb-3 tracking-tight">{eco.title}</h1>
            <p className="text-gray-500 text-sm">
              {new Date(eco.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Enregistrement audio</h2>
                <a
                  href={eco.audio_url}
                  download={`${eco.title.replace(/\s+/g, "_")}.webm`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white/60 rounded-xl transition-all shadow-sm border border-gray-200/50"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </a>
              </div>
              <audio
                controls
                src={eco.audio_url}
                className="w-full rounded-xl"
                style={{
                  outline: "none",
                }}
              >
                Votre navigateur ne supporte pas l&apos;élément audio.
              </audio>
            </div>

            <div className="pt-6 border-t border-gray-200/30">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Transcription</h2>
              <div className="prose prose-base max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {eco.transcription_text}
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/30">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Résumé structuré</h2>
              <div className="prose prose-base max-w-none">
                <div className="text-gray-700 leading-relaxed space-y-4">
                  {(() => {
                    const summaryJson = eco.summary_text || (summaryFromPoll ? JSON.stringify(summaryFromPoll) : null);
                    const isGenerating = !summaryJson && aiStatus !== "FAILED";
                    const isFailed = aiStatus === "FAILED";

                    if (isFailed) {
                      return (
                        <div className="space-y-4">
                          <p className="text-sm text-red-600">{aiError || "Erreur lors de la génération."}</p>
                          <RelancerButton recordingId={eco.id} onSuccess={onRefresh} />
                        </div>
                      );
                    }

                    if (isGenerating) {
                      return (
                        <div className="space-y-4 animate-pulse">
                          <div className="h-6 bg-gray-200 rounded w-3/4" />
                          <div className="h-4 bg-gray-200 rounded w-full" />
                          <div className="h-4 bg-gray-200 rounded w-5/6" />
                          <div className="h-5 bg-gray-200 rounded w-1/2 mt-6" />
                          <div className="space-y-2 ml-6">
                            <div className="h-4 bg-gray-200 rounded w-full" />
                            <div className="h-4 bg-gray-200 rounded w-4/5" />
                            <div className="h-4 bg-gray-200 rounded w-3/4" />
                          </div>
                          <p className="text-sm text-gray-500 mt-4">Génération du résumé en cours…</p>
                        </div>
                      );
                    }

                    if (!summaryJson) return null;

                    try {
                      const summary = JSON.parse(summaryJson);
                      if (summary.titre && summary.resume) {
                        // Format JSON structuré
                        return (
                          <>
                            <h3 className="text-xl font-semibold mt-8 mb-4 text-gray-900 first:mt-0">
                              {summary.titre}
                            </h3>
                            <p className="mb-4">{summary.resume}</p>
                            {summary.pointsCles && summary.pointsCles.length > 0 && (
                              <>
                                <h4 className="text-lg font-semibold mt-6 mb-3 text-gray-900">
                                  Points clés
                                </h4>
                                <ul className="list-disc ml-6 space-y-2">
                                  {summary.pointsCles.map((point: string, index: number) => (
                                    <li key={index}>{point}</li>
                                  ))}
                                </ul>
                              </>
                            )}
                            {summary.notions && summary.notions.length > 0 && (
                              <>
                                <h4 className="text-lg font-semibold mt-6 mb-3 text-gray-900">
                                  Notions importantes
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {summary.notions.map((notion: string, index: number) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                                    >
                                      {notion}
                                    </span>
                                  ))}
                                </div>
                              </>
                            )}
                          </>
                        );
                      }
                    } catch {
                      // Format markdown legacy
                    }
                    return summaryJson.split("\n").map((line, index) => {
                      if (line.startsWith("## ")) {
                        return (
                          <h3 key={index} className="text-xl font-semibold mt-8 mb-4 text-gray-900 first:mt-0">
                            {line.replace("## ", "")}
                          </h3>
                        );
                      }
                      if (line.startsWith("- ")) {
                        return (
                          <li key={index} className="ml-6 mb-2">
                            {line.replace("- ", "")}
                          </li>
                        );
                      }
                      if (line.trim() === "") {
                        return <br key={index} />;
                      }
                      return (
                        <p key={index} className="mb-4">
                          {line}
                        </p>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
