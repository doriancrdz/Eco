"use client";

import { useEffect, useRef, useState } from "react";
import { Eco, QuizQuestion } from "@/types";
import { motion } from "framer-motion";
import { RefreshCw, Copy, Check } from "lucide-react";
import { generateSummary } from "@/lib/transcription";
import type { Summary } from "@/lib/transcription";
import Tabs from "@/components/ui/Tabs";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

const POLL_INTERVAL_MS = 8000;
// Jitter 0-800ms pour éviter le thundering herd si plusieurs users en simultané
const pollJitter = () => Math.floor(Math.random() * 800);

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

function renderResume(resume: string) {
  const sectionHeaders = ["Introduction:", "Contenu:", "Conclusion:"];
  const isLegacyFormat = sectionHeaders.some((h) => resume.includes(h));

  if (isLegacyFormat) {
    // Ancien format : rendu manuel bloc par bloc (rétrocompat)
    const blocks = resume.split(/\n{2,}/);
    const nodes: React.ReactNode[] = [];
    let key = 0;

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const lines = trimmed.split("\n");
      const firstLine = lines[0].trim();

      if (sectionHeaders.includes(firstLine)) {
        nodes.push(
          <p key={key++} className={`font-semibold text-gray-900 mb-2 ${nodes.length > 0 ? "mt-5" : "mt-0"}`}>
            {firstLine}
          </p>
        );
        const rest = lines.slice(1).map((l) => l.trim()).filter(Boolean).join(" ");
        if (rest) {
          nodes.push(<p key={key++} className="text-gray-700 leading-relaxed">{rest}</p>);
        }
      } else if (/^\d+\.\s/.test(firstLine)) {
        nodes.push(
          <div key={key++} className="mb-2">
            <span className="font-medium text-gray-800">{firstLine}</span>
            {lines.length > 1 && (
              <p className="text-gray-700 leading-relaxed mt-0.5">
                {lines.slice(1).map((l) => l.trim()).filter(Boolean).join(" ")}
              </p>
            )}
          </div>
        );
      } else {
        nodes.push(
          <p key={key++} className="text-gray-700 leading-relaxed mb-1">
            {lines.map((l) => l.trim()).filter(Boolean).join(" ")}
          </p>
        );
      }
    }
    return <div>{nodes}</div>;
  }

  // Nouveau format : markdown avec **titres** en gras → react-markdown
  return (
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      components={{
        p: ({ children }) => (
          <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="list-disc ml-6 space-y-2 text-gray-700 mb-4">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal ml-6 space-y-2 text-gray-700 mb-4">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      }}
    >
      {resume}
    </ReactMarkdown>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Transcription copiée");
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
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [lastSummaryStatus, setLastSummaryStatus] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [revealedOpen, setRevealedOpen] = useState<Set<number>>(new Set());
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [lastEcoFetch, setLastEcoFetch] = useState<{
    url: string;
    statusCode: number;
    hasTranscription: boolean;
    transcriptionLen: number;
    hasContent: boolean;
    contentLen: number;
    updatedAt: string | null;
  } | null>(null);
  useEffect(() => {
    setQuizAnswers({});
    setRevealedOpen(new Set());
    setQuizSubmitted(false);
  }, [eco?.id]);

  // Polling quiz en arrière-plan : poll toutes les 15s tant que résumé ok mais quiz manquant
  const isQuizPending = !!(eco?.summary_text && !eco?.quiz);
  useEffect(() => {
    if (!isQuizPending || !eco?.id) return;
    let quizPollCount = 0;
    const MAX_QUIZ_POLLS = 20;
    const interval = setInterval(() => {
      quizPollCount++;
      if (quizPollCount >= MAX_QUIZ_POLLS) {
        clearInterval(interval);
        if (process.env.NODE_ENV !== "production") {
          console.log("[EcoView.quizPoll] Max tentatives atteint — quiz indisponible");
        }
        return;
      }
      if (process.env.NODE_ENV !== "production") {
        console.log(`[EcoView.quizPoll] #${quizPollCount}/${MAX_QUIZ_POLLS}`);
      }
      onRefresh?.();
    }, 15000);
    return () => clearInterval(interval);
  }, [isQuizPending, eco?.id, onRefresh]);

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
    const maxPolls = 40; // 40 * 8s = 320s max

    const poll = async () => {
      pollAttempts++;
      pollCountRef.current++;
      const t0 = performance.now();
      try {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[EcoView.poll] #${pollAttempts}/${maxPolls} GET`, pollUrl);
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

            // Déclencher generate-summary une seule fois quand transcription prête mais pas le résumé
            if (hasTranscription && !hasContent && !generateSummaryTriggeredRef.current) {
              generateSummaryTriggeredRef.current = true;
              if (process.env.NODE_ENV !== "production") {
                console.log("[EcoView.poll] Trigger generate-summary", { ecoId });
              }
              fetch("/api/generate-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recordingId: ecoId }),
              })
                .then((r) => {
                  setLastSummaryStatus(r.status);
                  if (r.ok || r.status === 202) return;
                  if (r.status === 429) {
                    setSummaryError("Limite de résumés atteinte. Réessayez dans quelques minutes.");
                  } else {
                    setSummaryError("La génération du résumé a échoué. Cliquez sur Relancer.");
                  }
                })
                .catch(() => {
                  setSummaryError("La génération du résumé a échoué. Vérifiez votre connexion.");
                });
            }

            // Stop quand les deux sont remplis — rafraîchir le parent une seule fois
            if (hasTranscription && hasContent) {
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
              if (process.env.NODE_ENV !== "production") {
                console.log("[EcoView.poll] Stop — transcription + content OK");
              }
              // Notifier le parent une seule fois (pas de double-fetch en boucle)
              onRefresh?.();
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
          console.log("[EcoView.poll] #" + pollCountRef.current, { status: res.status, duration: duration.toFixed(0), hasTranscription, hasContent });
        }

        if (pollAttempts >= maxPolls) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          if (process.env.NODE_ENV !== "production") {
            console.warn("[EcoView.poll] Max tentatives atteint");
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
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS + pollJitter());
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
            <div className="prose prose-sm max-w-none">
              {renderResume(summary.resume)}
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
            {summaryError && (
              <>
                <p className="text-sm text-red-600">{summaryError}</p>
                <RelancerButton ecoId={eco.id} onSuccess={() => { setSummaryError(null); onRefresh?.(); }} />
              </>
            )}
            {!summaryError && showRetryHint && (
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

  // Tab 4: Quiz
  // Guard shape : s'assurer que c'est bien un tableau d'objets {type, question}
  const rawQuiz = eco?.quiz;
  const quizData: QuizQuestion[] | null | undefined = Array.isArray(rawQuiz) &&
    rawQuiz.length > 0 &&
    typeof (rawQuiz[0] as unknown as Record<string, unknown>)?.question === "string"
    ? (rawQuiz as QuizQuestion[])
    : null;
  const mcqCount = quizData?.filter((q) => q.type === "mcq").length ?? 0;
  const correctCount = quizSubmitted
    ? (quizData?.filter((q, i) => q.type === "mcq" && quizAnswers[i] === q.answer).length ?? 0)
    : 0;

  const quizContent = (
    <div>
      {isGenerating || isQuizPending ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="space-y-2">
                <div className="h-10 bg-white/10 rounded-lg" />
                <div className="h-10 bg-white/10 rounded-lg" />
                <div className="h-10 bg-white/10 rounded-lg" />
                <div className="h-10 bg-white/10 rounded-lg" />
              </div>
            </div>
          ))}
          <p className="text-sm text-gray-400">Quiz en cours de génération…</p>
        </div>
      ) : quizData && quizData.length > 0 ? (
        <div className="space-y-5">
          {quizSubmitted && mcqCount > 0 && (
            <div className={`p-4 rounded-xl border text-sm font-medium ${
              correctCount === mcqCount
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                : correctCount >= Math.ceil(mcqCount * 0.6)
                ? "bg-blue-50/80 border-blue-200 text-blue-800"
                : "bg-amber-50/80 border-amber-200 text-amber-800"
            }`}>
              {correctCount}/{mcqCount} QCM correctes —{" "}
              {correctCount === mcqCount
                ? "Parfait !"
                : correctCount >= Math.ceil(mcqCount * 0.6)
                ? "Bon travail !"
                : "Continuez à réviser !"}
            </div>
          )}

          {quizData.map((question, idx) => (
            <div key={idx} className="p-5 rounded-xl bg-white/5 border border-white/10">
              <p className="font-medium text-gray-900 mb-4 leading-relaxed">
                {idx + 1}. {question.question}
              </p>

              {question.type === "mcq" ? (
                <div className="space-y-2">
                  {(question.options ?? []).map((option) => {
                    const letter = option.charAt(0);
                    const isSelected = quizAnswers[idx] === letter;
                    const isCorrect = letter === question.answer;
                    let cls =
                      "w-full text-left px-4 py-3 rounded-lg border transition-all text-sm cursor-pointer ";
                    if (!quizSubmitted) {
                      cls += isSelected
                        ? "bg-emerald-100/80 border-emerald-400 text-emerald-900 font-medium"
                        : "bg-white/5 border-white/20 text-gray-700 hover:bg-white/10 hover:border-white/30";
                    } else {
                      if (isCorrect)
                        cls += "bg-emerald-100/80 border-emerald-400 text-emerald-900 font-medium";
                      else if (isSelected)
                        cls += "bg-red-100/80 border-red-400 text-red-900";
                      else cls += "bg-white/5 border-white/10 text-gray-400";
                    }
                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={quizSubmitted}
                        onClick={() =>
                          setQuizAnswers((prev) => ({ ...prev, [idx]: letter }))
                        }
                        className={cls}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={quizAnswers[idx] ?? ""}
                    onChange={(e) => setQuizAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                    placeholder="Écris ta réponse ici..."
                    rows={4}
                    className="w-full p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200 text-gray-800 text-sm leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-y min-h-[120px] transition-all"
                  />
                  {revealedOpen.has(idx) ? (
                    <div className="p-4 bg-white/5 rounded-lg border border-white/15 text-gray-700 text-sm leading-relaxed">
                      <p className="text-xs font-medium text-gray-500 mb-2">Réponse modèle</p>
                      {question.answer}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedOpen((prev) => new Set([...prev, idx]))
                      }
                      className="px-4 py-2.5 text-sm bg-white/5 border border-white/15 rounded-lg text-gray-500 hover:bg-white/10 hover:border-white/25 transition-all"
                    >
                      Voir la réponse modèle
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {mcqCount > 0 && !quizSubmitted && (
            <button
              type="button"
              onClick={() => setQuizSubmitted(true)}
              className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg"
            >
              Valider le quiz
            </button>
          )}
          {quizSubmitted && (
            <button
              type="button"
              onClick={() => {
                setQuizAnswers({});
                setRevealedOpen(new Set());
                setQuizSubmitted(false);
              }}
              className="w-full px-6 py-3 bg-white/10 border border-white/20 text-gray-700 rounded-xl font-medium hover:bg-white/15 transition-all"
            >
              Recommencer le quiz
            </button>
          )}
        </div>
      ) : (
        <p className="text-gray-400">Aucun quiz disponible</p>
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
      id: "keypoints",
      label: "Points clés",
      content: keyPointsContent,
    },
    {
      id: "quiz",
      label: "Quiz",
      content: quizContent,
    },
    {
      id: "transcription",
      label: "Transcription",
      content: transcriptionContent,
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
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
            >
              ← Retour à l&apos;accueil
            </button>
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-semibold text-gray-900 mb-2 tracking-[-0.02em]">
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
