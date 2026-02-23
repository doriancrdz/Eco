"use client";

import { useEffect, useRef, useState } from "react";
import { Eco } from "@/types";
import { motion } from "framer-motion";
import { RefreshCw, Copy, Check, ArrowLeft } from "lucide-react";
import { generateSummary } from "@/lib/transcription";
import type { Summary } from "@/lib/transcription";
import Tabs from "@/components/ui/Tabs";

const POLL_INTERVAL_MS = 2000;

function RelancerButton({ ecoId, onSuccess }: { ecoId: string; onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const summary = await generateSummary(ecoId);
      if (summary) {
        const res = await fetch(`/api/ecos/${ecoId}`, {
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
  onBack?: () => void;
}

export default function EcoView({ eco, onRefresh, onBack }: EcoViewProps) {
  const [showRetryHint, setShowRetryHint] = useState(false);
  const [lastSummaryStatus, setLastSummaryStatus] = useState<number | null>(null);
  const [lastEcoFetch, setLastEcoFetch] = useState<{
    url: string;
    statusCode: number;
    hasTranscription: boolean;
    transcriptionLen: number;
    hasContent: boolean;
    contentLen: number;
    updatedAt: string | null;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generateSummaryTriggeredRef = useRef(false);
  const pollCountRef = useRef(0);

  const hasTranscription = !!(eco?.transcription_text && eco.transcription_text.length > 0);
  const hasSummary = !!eco?.summary_text;
  const needsPolling = eco?.id && (!hasTranscription || !hasSummary);

  // Après 30s sans contenu, afficher "Traitement en cours ou échoué" + Relancer
  useEffect(() => {
    if (!needsPolling) {
      setShowRetryHint(false);
      return;
    }
    const t = setTimeout(() => setShowRetryHint(true), 30000);
    return () => clearTimeout(t);
  }, [needsPolling]);

  // Mise à jour lastEcoFetch quand eco change (prop venant du parent)
  useEffect(() => {
    if (eco) {
      const url = `/api/ecos/${eco.id}`;
      const transcriptionLen = eco.transcription_text?.length ?? 0;
      const contentLen = eco.summary_text?.length ?? 0;
      setLastEcoFetch({
        url,
        statusCode: 200,
        hasTranscription: transcriptionLen > 0,
        transcriptionLen,
        hasContent: contentLen > 0,
        contentLen,
        updatedAt: eco.created_at || null,
      });
      if (process.env.NODE_ENV !== "production") {
        console.log("[DEBUG EcoView] Données ECO reçues:", { id: eco.id, url, transcriptionLen, contentLen });
      }
    }
  }, [eco]);

  // Polling unique : GET /api/ecos/[id] toutes les 2s. Stop quand transcriptionText et content non vides.
  useEffect(() => {
    if (!needsPolling || !eco?.id) {
      generateSummaryTriggeredRef.current = false;
      pollCountRef.current = 0;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const ecoId = eco.id;
    const pollUrl = `/api/ecos/${ecoId}`;
    let pollAttempts = 0;
    const maxPolls = 90; // 90 * 2s = 3 min max

    const poll = async () => {
      pollAttempts++;
      pollCountRef.current++;
      const t0 = performance.now();
      try {
        if (process.env.NODE_ENV !== "production") {
          console.log("[DEBUG EcoView.poll] GET", { url: pollUrl, ecoId });
        }
        const res = await fetch(pollUrl, { cache: "no-store" });
        const duration = performance.now() - t0;

        let hasTranscription = false;
        let hasContent = false;
        let updatedAt: string | null = null;

        if (res.ok) {
          const data = await res.json();
          const e = data?.eco;
          if (e) {
            const tLen = e.transcription_text?.length ?? 0;
            const cLen = e.summary_text?.length ?? 0;
            hasTranscription = tLen > 0;
            hasContent = cLen > 0;
            updatedAt = e.created_at || null;
            setLastEcoFetch({
              url: pollUrl,
              statusCode: res.status,
              hasTranscription,
              transcriptionLen: tLen,
              hasContent,
              contentLen: cLen,
              updatedAt,
            });

            // Rafraîchir le parent pour qu'il mette à jour currentEco (une seule source de vérité)
            onRefresh?.();

            // Déclencher generate-summary une seule fois quand transcription prête mais pas le résumé
            if (hasTranscription && !hasContent && !generateSummaryTriggeredRef.current) {
              generateSummaryTriggeredRef.current = true;
              if (process.env.NODE_ENV !== "production") {
                console.log("[DEBUG EcoView.poll] Trigger generate-summary", { ecoId });
              }
              fetch("/api/generate-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recordingId: ecoId }),
              })
                .then((r) => {
                  setLastSummaryStatus(r.status);
                  if (r.ok || r.status === 202) return;
                  throw new Error(`Status ${r.status}`);
                })
                .catch((err) => {
                  if (process.env.NODE_ENV === "development") {
                    console.error("[EcoView.poll] generate-summary error", err);
                  }
                });
            }

            // Stop quand les deux sont remplis
            if (hasTranscription && hasContent) {
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
              if (process.env.NODE_ENV !== "production") {
                console.log("[EcoView.poll] Stop — transcription + content OK");
              }
            }
          }
        } else {
          setLastEcoFetch({
            url: pollUrl,
            statusCode: res.status,
            hasTranscription: false,
            transcriptionLen: 0,
            hasContent: false,
            contentLen: 0,
            updatedAt: null,
          });
        }

        if (process.env.NODE_ENV !== "production") {
          console.log("[EcoView.poll] #" + pollCountRef.current, { url: pollUrl, status: res.status, duration: duration.toFixed(0), hasTranscription, hasContent });
        }

        if (pollAttempts >= maxPolls) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[EcoView.poll] Erreur", error);
        }
        setLastEcoFetch({
          url: pollUrl,
          statusCode: 0,
          hasTranscription: false,
          transcriptionLen: 0,
          hasContent: false,
          contentLen: 0,
          updatedAt: null,
        });
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [needsPolling, eco?.id, onRefresh]);

  // Affichage : une seule source de vérité (Eco)
  const summaryJson = eco?.summary_text ?? null;
  const transcription = eco?.transcription_text ?? "";

  // États dérivés uniquement des champs Eco + polling actif
  const isTranscribing = needsPolling && !(eco?.transcription_text && eco.transcription_text.length > 0);
  const isGenerating = needsPolling && !!(eco?.transcription_text && eco.transcription_text.length > 0) && !(eco?.summary_text && eco.summary_text.length > 0);
  const isFailed = false; // On ne lit plus aiStatus du Recording ; en cas d'échec, showRetryHint après 30s

  useEffect(() => {
    if (!eco) return;
    if (process.env.NODE_ENV !== "production") {
      console.log("[EcoView] État affichage:", {
        hasTranscription: !!transcription && transcription.length > 0,
        hasSummary: !!summaryJson,
        isTranscribing,
        isGenerating,
        needsPolling,
      });
    }
  }, [eco, transcription, summaryJson, isTranscribing, isGenerating, needsPolling]);

  if (!eco) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Sélectionnez un Eco pour voir les détails</p>
        </div>
      </div>
    );
  }

  // Parse summary object (après le return conditionnel, pour le rendu uniquement)
  let summary: Summary | null = null;
  if (summaryJson) {
    try {
      summary = JSON.parse(summaryJson);
    } catch {
      // Legacy format, handled below
    }
  }

  // Tab 1: Résumé structuré (default)
  const summaryContent = (
    <div className="prose prose-base max-w-none">
      <div className="text-gray-700 leading-relaxed space-y-4">
        {isGenerating ? (
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
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-line text-gray-700 leading-relaxed">{summary.resume}</p>
            </div>
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
          <div className="space-y-3">
            <p className="text-gray-400">Aucun résumé disponible</p>
            {showRetryHint && (
              <>
                <p className="text-sm text-amber-600">Traitement en cours ou échoué.</p>
                <RelancerButton ecoId={eco.id} onSuccess={onRefresh} />
              </>
            )}
          </div>
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
        <div className="space-y-3">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{transcription || "—"}</p>
          {showRetryHint && !transcription && (
            <p className="text-sm text-amber-600">Transcription en cours ou échouée. Rafraîchir la page ou réessayer plus tard.</p>
          )}
        </div>
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
          {summary.notions.map((notion: { terme: string; definition: string } | string, index: number) => {
            // Gérer les deux formats : ancien (string) et nouveau ({ terme, definition })
            const terme = typeof notion === "string" ? notion : notion.terme;
            const definition = typeof notion === "string" ? "" : notion.definition;
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                className="px-5 py-4 bg-white/50 backdrop-blur-xl rounded-xl border border-white/15 shadow-lg hover:bg-white/60 hover:border-white/25 hover:shadow-xl transition-all"
              >
                <h4 className="font-bold text-gray-900">{terme}</h4>
                {definition && (
                  <p className="text-sm text-gray-600 mt-1">{definition}</p>
                )}
              </motion.div>
            );
          })}
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
        {/* Panneau DEBUG (DEV ONLY) */}
        {process.env.NODE_ENV !== "production" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-amber-50/80 backdrop-blur-xl rounded-xl border border-amber-200/50 shadow-lg p-4 text-xs font-mono"
          >
            <div className="font-bold text-amber-900 mb-2">🔍 DEBUG PANEL</div>
            <div className="space-y-1 text-amber-800">
              <div>ecoId: <span className="font-semibold">{eco.id}</span></div>
              <div>lastSummaryStatus: <span className="font-semibold">{lastSummaryStatus ?? "—"}</span></div>
              <div>lastEcoFetch: {lastEcoFetch ? (
                <span className="font-semibold block mt-1">
                  URL: {lastEcoFetch.url}<br />
                  statusCode: {lastEcoFetch.statusCode} | hasTranscription: {lastEcoFetch.hasTranscription ? "✅" : "❌"} ({lastEcoFetch.transcriptionLen}) | hasContent: {lastEcoFetch.hasContent ? "✅" : "❌"} ({lastEcoFetch.contentLen}) | updatedAt: {lastEcoFetch.updatedAt ? new Date(lastEcoFetch.updatedAt).toLocaleTimeString() : "—"}
                </span>
              ) : "—"}</div>
            </div>
          </motion.div>
        )}
        
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
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Retour à l&apos;accueil</span>
              </button>
            )}
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
            {eco.duration_seconds != null && eco.duration_seconds > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Durée : {Math.floor(eco.duration_seconds / 60)} min {Math.round(eco.duration_seconds % 60)} s
              </p>
            )}
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
