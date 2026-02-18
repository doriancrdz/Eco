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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white/60 border border-gray-200/50 rounded-xl hover:bg-white/80 transition-all shadow-sm"
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
    </button>
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
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const result = await pollRecordingStatus(eco!.id);
        setRecordingStatus(result.status);
        setAiStatus(result.aiStatus ?? "IDLE");
        setAiError(result.aiError ?? null);

        if (result.transcription) {
          setTranscriptionFromPoll(result.transcription);
          fetch(`/api/eco/${eco!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcription_text: result.transcription }),
          }).then((r) => r.ok && window.dispatchEvent(new Event("eco-updated")));
          onRefresh?.();
        }

        if (result.status === "TRANSCRIBED" && !generateSummaryTriggeredRef.current) {
          generateSummaryTriggeredRef.current = true;
          generateSummary(eco!.id).catch(() => {});
        }

        if (result.aiStatus === "DONE" && result.summary) {
          setSummaryFromPoll(result.summary);
          fetch(`/api/eco/${eco!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: result.summary.titre || eco!.title,
              summary_text: JSON.stringify(result.summary),
            }),
          }).then((r) => r.ok && window.dispatchEvent(new Event("eco-updated")));
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

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPolling, eco?.id, eco?.summary_text, eco?.title, onRefresh]);

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
            <p className="text-sm text-red-600">{aiError || "Erreur lors de la génération."}</p>
            <RelancerButton recordingId={eco.id} onSuccess={onRefresh} />
          </div>
        ) : isGenerating ? (
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
        ) : summary && summary.titre && summary.resume ? (
          <>
            <h3 className="text-xl font-semibold mt-0 mb-4 text-gray-900">{summary.titre}</h3>
            <p className="mb-4">{summary.resume}</p>
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
            })}
          </div>
        ) : (
          <p className="text-gray-500">Aucun résumé disponible</p>
        )}
      </div>
    </div>
  );

  // Tab 2: Transcription
  const transcriptionContent = (
    <div className="prose prose-base max-w-none">
      <div className="flex justify-end mb-4">
        {transcription && <CopyButton text={transcription} />}
      </div>
      {isTranscribing ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-4/5" />
          <p className="text-sm text-gray-500 mt-2">Transcription en cours…</p>
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
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-4/5" />
        </div>
      ) : (
        <p className="text-gray-500">Aucun point clé disponible</p>
      )}
    </div>
  );

  // Tab 4: Notions à retenir
  const notionsContent = (
    <div className="prose prose-base max-w-none">
      {summary && summary.notions && summary.notions.length > 0 ? (
        <div className="space-y-4">
          {summary.notions.map((notion: string, index: number) => (
            <div
              key={index}
              className="px-4 py-3 bg-white/20 rounded-xl border border-white/10 shadow-sm"
            >
              <p className="text-gray-900 font-medium">{notion}</p>
            </div>
          ))}
        </div>
      ) : isGenerating ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-12 bg-gray-200 rounded-xl w-full" />
          <div className="h-12 bg-gray-200 rounded-xl w-5/6" />
          <div className="h-12 bg-gray-200 rounded-xl w-4/5" />
        </div>
      ) : (
        <p className="text-gray-500">Aucune notion disponible</p>
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

          <Tabs tabs={tabs} defaultTab="summary" />
        </motion.div>
      </div>
    </motion.div>
  );
}
