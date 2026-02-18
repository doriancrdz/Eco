"use client";

import { useEffect, useRef, useState } from "react";
import { Eco } from "@/types";
import { motion } from "framer-motion";
import { RefreshCw, Copy, Check } from "lucide-react";
import { pollRecordingStatus, generateSummary } from "@/lib/transcription";
import type { Summary } from "@/lib/transcription";
import Tabs from "@/components/ui/Tabs";

const POLL_INTERVAL_MS = 1000;

function RelancerButton({ recordingId, onSuccess }: { recordingId: string; onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const summary = await generateSummary(recordingId);
      if (summary) {
        const res = await fetch(`/api/eco/${recordingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: summary.titre, summary_text: JSON.stringify(summary) }),
        });
        if (res.ok) {
          window.dispatchEvent(new Event("eco-updated"));
          onSuccess?.();
        }
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={loading}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-800 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl hover:bg-white/15 hover:border-white/30 transition-all shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Relance en cours…" : "Relancer la génération"}
    </motion.button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.button
      onClick={handleCopy}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-800 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl hover:bg-white/15 hover:border-white/30 transition-all shadow-lg hover:shadow-xl"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          Copié
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          Copier
        </>
      )}
    </motion.button>
  );
}

interface EcoViewProps {
  eco: Eco | null;
  onRefresh?: () => void;
}

export default function EcoView({ eco, onRefresh }: EcoViewProps) {
  const [transcriptionFromPoll, setTranscriptionFromPoll] = useState<string | null>(null);
  const [summaryFromPoll, setSummaryFromPoll] = useState<Summary | null | undefined>(undefined);
  const [recordingStatus, setRecordingStatus] = useState<string>("");
  const [aiStatus, setAiStatus] = useState<string>("IDLE");
  const [aiError, setAiError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generateSummaryTriggeredRef = useRef(false);
  const lastEcoUpdatedDispatchRef = useRef<number>(0);
  const pollCountRef = useRef(0);

  const hasTranscription = !!(eco?.transcription_text && eco.transcription_text.length > 0);
  const hasSummary = !!eco?.summary_text;
  const needsPolling = eco?.id && (!hasTranscription || !hasSummary);

  useEffect(() => {
    if (!needsPolling) {
      setTranscriptionFromPoll(null);
      setSummaryFromPoll(undefined);
      setRecordingStatus("");
      setAiStatus("IDLE");
      setAiError(null);
      generateSummaryTriggeredRef.current = false;
      pollCountRef.current = 0;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    let pollInterval = POLL_INTERVAL_MS;
    let maxPolls = 60; // Max 60 polls = 60s avec interval de 1s
    let pollAttempts = 0;

    const poll = async () => {
      pollAttempts++;
      pollCountRef.current++;
      const t0 = performance.now();
      
      try {
        const result = await pollRecordingStatus(eco!.id);
        const duration = performance.now() - t0;
        console.log(`[EcoView.poll] #${pollCountRef.current} - ${duration.toFixed(0)}ms - status:${result.status} aiStatus:${result.aiStatus}`);
        
        setRecordingStatus(result.status);
        setAiStatus(result.aiStatus ?? "IDLE");
        setAiError(result.aiError ?? null);

        let shouldDispatchEcoUpdated = false;

        // Transcription reçue
        if (result.transcription && !transcriptionFromPoll) {
          console.log("[EcoView.poll] Transcription reçue");
          setTranscriptionFromPoll(result.transcription);
          try {
            const patchRes = await fetch(`/api/eco/${eco!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transcription_text: result.transcription }),
            });
            if (patchRes.ok) {
              shouldDispatchEcoUpdated = true;
            }
          } catch (error) {
            console.error("[EcoView.poll] Erreur PATCH transcription", error);
          }
        }

        // Démarrer génération résumé si transcription terminée
        if (result.status === "TRANSCRIBED" && !generateSummaryTriggeredRef.current) {
          console.log("[EcoView.poll] Démarrage génération résumé");
          generateSummaryTriggeredRef.current = true;
          generateSummary(eco!.id).catch((error) => {
            console.error("[EcoView.poll] Erreur generateSummary", error);
          });
        }

        // Résumé reçu
        if (result.aiStatus === "DONE" && result.summary) {
          console.log("[EcoView.poll] Résumé reçu");
          setSummaryFromPoll(result.summary);
          try {
            const patchRes = await fetch(`/api/eco/${eco!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: result.summary.titre || eco!.title,
                summary_text: JSON.stringify(result.summary),
              }),
            });
            if (patchRes.ok) {
              shouldDispatchEcoUpdated = true;
              // Arrêter le polling
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
              console.log("[EcoView.poll] Polling arrêté - résumé complet");
            }
          } catch (error) {
            console.error("[EcoView.poll] Erreur PATCH résumé", error);
          }
        }

        // Déclencher eco-updated UNE SEULE FOIS si nécessaire (debounced)
        if (shouldDispatchEcoUpdated) {
          const now = Date.now();
          const timeSinceLastDispatch = now - lastEcoUpdatedDispatchRef.current;
          // Ne dispatcher que si > 1s depuis le dernier dispatch
          if (timeSinceLastDispatch > 1000) {
            console.log("[EcoView.poll] Dispatch eco-updated");
            lastEcoUpdatedDispatchRef.current = now;
            window.dispatchEvent(new Event("eco-updated"));
            onRefresh?.();
          } else {
            console.log(`[EcoView.poll] Skip dispatch (trop récent: ${timeSinceLastDispatch}ms)`);
          }
        }

        // Arrêter après max polls
        if (pollAttempts >= maxPolls) {
          console.log(`[EcoView.poll] Arrêt après ${maxPolls} tentatives`);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (error) {
        const duration = performance.now() - t0;
        console.error(`[EcoView.poll] Erreur - ${duration.toFixed(0)}ms`, error);
      }
    };

    // Premier poll immédiat
    poll();
    
    // Puis polling avec interval
    pollRef.current = setInterval(poll, pollInterval);
    
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPolling, eco?.id]);

  if (!eco) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Sélectionnez un Eco pour voir les détails</p>
        </div>
      </div>
    );
  }

  // Parse summary data
  const summaryJson = eco.summary_text || (summaryFromPoll ? JSON.stringify(summaryFromPoll) : null);
  let summary: Summary | null = null;
  if (summaryJson) {
    try {
      summary = JSON.parse(summaryJson);
    } catch {
      // Legacy format, handled below
    }
  }

  const transcription = eco.transcription_text || transcriptionFromPoll || "";
  const isTranscribing = !transcription && (recordingStatus === "PROCESSING" || !recordingStatus);
  const isGenerating = !summaryJson && aiStatus !== "FAILED";
  const isFailed = aiStatus === "FAILED";

  // Tab 1: Résumé structuré (default)
  const summaryContent = (
    <div className="prose prose-base max-w-none">
      <div className="text-gray-700 leading-relaxed space-y-4">
        {isFailed ? (
          <div className="space-y-4">
            <p className="text-sm text-red-500/90">{aiError || "Erreur lors de la génération."}</p>
            <RelancerButton recordingId={eco.id} onSuccess={onRefresh} />
          </div>
        ) : isGenerating ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 bg-white/10 rounded-lg w-3/4 backdrop-blur-sm" />
            <div className="h-4 bg-white/10 rounded-lg w-full backdrop-blur-sm" />
            <div className="h-4 bg-white/10 rounded-lg w-5/6 backdrop-blur-sm" />
            <div className="h-5 bg-white/10 rounded-lg w-1/2 mt-6 backdrop-blur-sm" />
            <div className="space-y-2 ml-6">
              <div className="h-4 bg-white/10 rounded-lg w-full backdrop-blur-sm" />
              <div className="h-4 bg-white/10 rounded-lg w-4/5 backdrop-blur-sm" />
              <div className="h-4 bg-white/10 rounded-lg w-3/4 backdrop-blur-sm" />
            </div>
            <p className="text-sm text-gray-400 mt-4">Génération du résumé en cours…</p>
          </div>
        ) : summary && summary.titre && summary.resume ? (
          <>
            <h3 className="text-xl font-semibold mt-0 mb-4 text-gray-900">{summary.titre}</h3>
            <p className="mb-4 text-gray-700">{summary.resume}</p>
          </>
        ) : summaryJson ? (
          <div>
            {summaryJson.split("\n").map((line, index) => {
              if (line.startsWith("## ")) {
                return (
                  <h3 key={index} className="text-xl font-semibold mt-8 mb-4 text-gray-900 first:mt-0">
                    {line.replace("## ", "")}
                  </h3>
                );
              }
              if (line.startsWith("- ")) {
                return (
                  <li key={index} className="ml-6 mb-2 text-gray-700">
                    {line.replace("- ", "")}
                  </li>
                );
              }
              if (line.trim() === "") {
                return <br key={index} />;
              }
              return (
                <p key={index} className="mb-4 text-gray-700">
                  {line}
                </p>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400">Aucun résumé disponible</p>
        )}
      </div>
    </div>
  );

  // Tab 2: Transcription
  const transcriptionContent = (
    <div className="prose prose-base max-w-none">
      <div className="flex justify-end mb-6">
        {transcription && <CopyButton text={transcription} />}
      </div>
      {isTranscribing ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-white/10 rounded-lg w-full backdrop-blur-sm" />
          <div className="h-4 bg-white/10 rounded-lg w-5/6 backdrop-blur-sm" />
          <div className="h-4 bg-white/10 rounded-lg w-full backdrop-blur-sm" />
          <div className="h-4 bg-white/10 rounded-lg w-4/5 backdrop-blur-sm" />
          <p className="text-sm text-gray-400 mt-2">Transcription en cours…</p>
        </div>
      ) : (
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{transcription || "—"}</p>
      )}
    </div>
  );

  // Tab 3: Points clés
  const keyPointsContent = (
    <div className="prose prose-base max-w-none">
      {summary && summary.pointsCles && summary.pointsCles.length > 0 ? (
        <ul className="list-disc ml-6 space-y-3 text-gray-700">
          {summary.pointsCles.map((point: string, index: number) => (
            <li key={index} className="leading-relaxed">{point}</li>
          ))}
        </ul>
      ) : isGenerating ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-white/10 rounded-lg w-full backdrop-blur-sm" />
          <div className="h-4 bg-white/10 rounded-lg w-5/6 backdrop-blur-sm" />
          <div className="h-4 bg-white/10 rounded-lg w-4/5 backdrop-blur-sm" />
        </div>
      ) : (
        <p className="text-gray-400">Aucun point clé disponible</p>
      )}
    </div>
  );

  // Tab 4: Notions à retenir
  const notionsContent = (
    <div className="prose prose-base max-w-none">
      {summary && summary.notions && summary.notions.length > 0 ? (
        <div className="space-y-4">
          {summary.notions.map((notion: string, index: number) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              className="px-5 py-4 bg-white/8 backdrop-blur-xl rounded-xl border border-white/15 shadow-lg hover:bg-white/12 hover:border-white/25 hover:shadow-xl transition-all"
            >
              <p className="text-gray-900 font-medium">{notion}</p>
            </motion.div>
          ))}
        </div>
      ) : isGenerating ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-12 bg-white/10 rounded-xl w-full backdrop-blur-sm" />
          <div className="h-12 bg-white/10 rounded-xl w-5/6 backdrop-blur-sm" />
          <div className="h-12 bg-white/10 rounded-xl w-4/5 backdrop-blur-sm" />
        </div>
      ) : (
        <p className="text-gray-400">Aucune notion disponible</p>
      )}
    </div>
  );

  const tabs = [
    {
      id: "summary",
      label: "Résumé structuré",
      content: summaryContent,
    },
    {
      id: "transcription",
      label: "Transcription",
      content: transcriptionContent,
    },
    {
      id: "keypoints",
      label: "Points clés",
      content: keyPointsContent,
    },
    {
      id: "notions",
      label: "Notions à retenir",
      content: notionsContent,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex-1 overflow-y-auto p-4 md:p-8"
    >
      <div className="max-w-[1100px] mx-auto space-y-6">
        {/* Header avec aura */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative"
        >
          {/* Aura gradient flou derrière le header */}
          <div className="absolute -inset-4 bg-gradient-to-r from-aura-emerald/20 via-aura-blue/20 to-aura-sand/20 rounded-3xl blur-2xl opacity-60 -z-10" />
          
          {/* Glass card header */}
          <div className="relative bg-white/8 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl p-8 md:p-10">
            <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-2 tracking-[-0.02em]">
              {eco.title}
            </h1>
            <p className="text-gray-400 text-sm opacity-70">
              {new Date(eco.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </motion.div>

        {/* Tabs avec contenu dans glass card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative"
        >
          {/* Aura subtile derrière les tabs */}
          <div className="absolute -inset-2 bg-gradient-to-br from-aura-emerald/10 via-aura-blue/10 to-aura-sand/10 rounded-2xl blur-xl opacity-50 -z-10" />
          
          <div className="relative bg-white/8 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl overflow-hidden">
            <Tabs tabs={tabs} defaultTab="summary" />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
