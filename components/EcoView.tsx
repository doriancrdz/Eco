"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eco, QuizQuestion } from "@/types";
import { motion } from "framer-motion";
import { RefreshCw, Copy, Check } from "lucide-react";
import { generateSummary } from "@/lib/transcription";
import type { Summary } from "@/lib/transcription";
import Tabs from "@/components/ui/Tabs";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import Flashcards, { buildFlashcards } from "@/components/Flashcards";
import remarkBreaks from "remark-breaks";

const POLL_INTERVAL_MS = 8000;
const pollJitter = () => Math.floor(Math.random() * 800);

/* ─── RelancerButton ─────────────────────────────────────────────────── */
function RelancerButton({ ecoId, onSuccess }: { ecoId: string; onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      await generateSummary(ecoId);
      window.dispatchEvent(new Event("eco-updated"));
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La génération a échoué. Réessaie dans un instant.");
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
      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: "rgba(201,184,255,0.12)",
        border: "1px solid rgba(201,184,255,0.25)",
        color: "#C9B8FF",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,184,255,0.2)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(201,184,255,0.12)")}
    >
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Relance en cours…" : "Relancer la génération"}
    </motion.button>
  );
}

/* ─── renderResume ───────────────────────────────────────────────────── */
function renderResume(resume: string) {
  const sectionHeaders = ["Introduction:", "Contenu:", "Conclusion:"];
  const isLegacyFormat = sectionHeaders.some((h) => resume.includes(h));

  if (isLegacyFormat) {
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
          <p
            key={key++}
            className={`font-semibold mb-2 ${nodes.length > 0 ? "mt-6" : "mt-0"}`}
            style={{ color: "#EDECE8" }}
          >
            {firstLine}
          </p>
        );
        const rest = lines.slice(1).map((l) => l.trim()).filter(Boolean).join(" ");
        if (rest) {
          nodes.push(
            <p key={key++} className="leading-relaxed" style={{ color: "rgba(237,236,232,0.75)" }}>
              {rest}
            </p>
          );
        }
      } else if (/^\d+\.\s/.test(firstLine)) {
        nodes.push(
          <div key={key++} className="mb-2">
            <span className="font-medium" style={{ color: "rgba(237,236,232,0.9)" }}>{firstLine}</span>
            {lines.length > 1 && (
              <p className="leading-relaxed mt-0.5" style={{ color: "rgba(237,236,232,0.7)" }}>
                {lines.slice(1).map((l) => l.trim()).filter(Boolean).join(" ")}
              </p>
            )}
          </div>
        );
      } else {
        nodes.push(
          <p key={key++} className="leading-relaxed mb-1" style={{ color: "rgba(237,236,232,0.75)" }}>
            {lines.map((l) => l.trim()).filter(Boolean).join(" ")}
          </p>
        );
      }
    }
    return <div>{nodes}</div>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      components={{
        p: ({ children }) => (
          <p className="leading-relaxed mb-4" style={{ color: "rgba(237,236,232,0.75)" }}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold" style={{ color: "#EDECE8" }}>{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="list-disc ml-6 space-y-2 mb-4" style={{ color: "rgba(237,236,232,0.75)" }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal ml-6 space-y-2 mb-4" style={{ color: "rgba(237,236,232,0.75)" }}>{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      }}
    >
      {resume}
    </ReactMarkdown>
  );
}

/* ─── CopyButton ─────────────────────────────────────────────────────── */
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
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "rgba(237,236,232,0.65)",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
    >
      {copied ? (
        <><Check className="w-4 h-4" />Copié</>
      ) : (
        <><Copy className="w-4 h-4" />Copier</>
      )}
    </motion.button>
  );
}

/* ─── EcoView ────────────────────────────────────────────────────────── */
interface EcoViewProps {
  eco: Eco | null;
  onRefresh?: () => void;
  onBack?: () => void;
}

export default function EcoView({ eco, onRefresh, onBack }: EcoViewProps) {
  const [showRetryHint, setShowRetryHint] = useState(false);
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

  const [quizTimedOut, setQuizTimedOut] = useState(false);
  useEffect(() => setQuizTimedOut(false), [eco?.id]);
  // Le quiz est généré ~20s après le résumé : inutile de poller sur un ancien ECO qui n'en a pas.
  const isRecentEco = !!eco?.created_at && Date.now() - new Date(eco.created_at).getTime() < 15 * 60 * 1000;
  const isQuizPending = !!(eco?.summary_text && !eco?.quiz) && isRecentEco && !quizTimedOut;
  useEffect(() => {
    if (!isQuizPending || !eco?.id) return;
    let quizPollCount = 0;
    const MAX_QUIZ_POLLS = 8;
    const interval = setInterval(() => {
      quizPollCount++;
      if (quizPollCount >= MAX_QUIZ_POLLS) {
        clearInterval(interval);
        setQuizTimedOut(true);
        return;
      }
      onRefresh?.();
    }, 15000);
    return () => clearInterval(interval);
  }, [isQuizPending, eco?.id, onRefresh]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const hasTranscription = !!(eco?.transcription_text && eco.transcription_text.length > 0);
  const hasSummary = !!eco?.summary_text;
  const hasFailed = eco?.ai_status === "FAILED" || eco?.processing_status === "ERROR";
  const needsPolling = eco?.id && (!hasTranscription || !hasSummary) && !hasFailed;

  useEffect(() => {
    if (!needsPolling) { setShowRetryHint(false); return; }
    const t = setTimeout(() => setShowRetryHint(true), 30000);
    return () => clearTimeout(t);
  }, [needsPolling]);

  useEffect(() => {
    if (eco) {
      const url = `/api/ecos/${eco.id}`;
      const transcriptionLen = eco.transcription_text?.length ?? 0;
      const contentLen = eco.summary_text?.length ?? 0;
      setLastEcoFetch({
        url, statusCode: 200,
        hasTranscription: transcriptionLen > 0, transcriptionLen,
        hasContent: contentLen > 0, contentLen,
        updatedAt: eco.created_at || null,
      });
    }
  }, [eco]);

  useEffect(() => {
    if (!needsPolling || !eco?.id) {
      pollCountRef.current = 0;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const ecoId = eco.id;
    const pollUrl = `/api/ecos/${ecoId}`;
    let pollAttempts = 0;
    const maxPolls = 40;

    const poll = async () => {
      pollAttempts++;
      pollCountRef.current++;
      const t0 = performance.now();
      try {
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
            setLastEcoFetch({ url: pollUrl, statusCode: res.status, hasTranscription, transcriptionLen: tLen, hasContent, contentLen: cLen, updatedAt });

            const failed = e.ai_status === "FAILED" || e.processing_status === "ERROR";
            if ((hasTranscription && hasContent) || failed) {
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
              onRefresh?.();
              return;
            }
          }
        } else {
          setLastEcoFetch({ url: pollUrl, statusCode: res.status, hasTranscription: false, transcriptionLen: 0, hasContent: false, contentLen: 0, updatedAt: null });
        }

        if (process.env.NODE_ENV !== "production") {
          console.log("[EcoView.poll] #" + pollCountRef.current, { status: res.status, duration: duration.toFixed(0), hasTranscription, hasContent });
        }

        if (pollAttempts >= maxPolls) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch {
        setLastEcoFetch({ url: pollUrl, statusCode: 0, hasTranscription: false, transcriptionLen: 0, hasContent: false, contentLen: 0, updatedAt: null });
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS + pollJitter());
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [needsPolling, eco?.id, onRefresh]);

  const summaryJson = eco?.summary_text ?? null;
  const transcription = eco?.transcription_text ?? "";
  const isTranscribing = needsPolling && !(eco?.transcription_text && eco.transcription_text.length > 0);
  const isGenerating = needsPolling && !!(eco?.transcription_text && eco.transcription_text.length > 0) && !(eco?.summary_text && eco.summary_text.length > 0);

  const quizKey = JSON.stringify(eco?.quiz ?? null);
  const flashcards = useMemo(() => {
    let parsed: Summary | null = null;
    if (eco?.summary_text) {
      try { parsed = JSON.parse(eco.summary_text); } catch { /* ancien format texte */ }
    }
    const quiz = Array.isArray(eco?.quiz) ? (eco.quiz as QuizQuestion[]) : null;
    return buildFlashcards(parsed?.notions, quiz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eco?.summary_text, quizKey]);

  if (!eco) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-base" style={{ color: "rgba(237,236,232,0.35)" }}>
          Sélectionnez un ECO pour voir les détails
        </p>
      </div>
    );
  }

  let summary: Summary | null = null;
  if (summaryJson) {
    try { summary = JSON.parse(summaryJson); } catch { /* legacy */ }
  }

  /* ── Tab 1: Résumé ─────────────────────────────────────────── */
  const summaryContent = (
    <div className="prose prose-base max-w-none">
      <div className="space-y-4">
        {isGenerating ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 rounded-lg eco-skeleton w-3/4" />
            <div className="h-4 rounded-lg eco-skeleton w-full" />
            <div className="h-4 rounded-lg eco-skeleton w-5/6" />
            <div className="h-5 rounded-lg eco-skeleton w-1/2 mt-6" />
            <div className="space-y-2 ml-6">
              <div className="h-4 rounded-lg eco-skeleton w-full" />
              <div className="h-4 rounded-lg eco-skeleton w-4/5" />
              <div className="h-4 rounded-lg eco-skeleton w-3/4" />
            </div>
            <p className="text-sm mt-4" style={{ color: "rgba(237,236,232,0.35)" }}>
              Génération du résumé en cours…
            </p>
          </div>
        ) : summary && summary.titre && summary.resume ? (
          <div className="prose prose-sm max-w-none">
            {renderResume(summary.resume)}
          </div>
        ) : summaryJson ? (
          <div>
            {summaryJson.split("\n").map((line, index) => {
              if (line.startsWith("## ")) {
                return (
                  <h3
                    key={index}
                    className="text-xl font-semibold mt-8 mb-4 first:mt-0"
                    style={{ color: "#EDECE8" }}
                  >
                    {line.replace("## ", "")}
                  </h3>
                );
              }
              if (line.startsWith("- ")) {
                return (
                  <li key={index} className="ml-6 mb-2 leading-relaxed" style={{ color: "rgba(237,236,232,0.75)" }}>
                    {line.replace("- ", "")}
                  </li>
                );
              }
              if (line.trim() === "") return <br key={index} />;
              return (
                <p key={index} className="mb-4 leading-relaxed" style={{ color: "rgba(237,236,232,0.75)" }}>
                  {line}
                </p>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <p style={{ color: "rgba(237,236,232,0.35)" }}>Aucun résumé disponible</p>
            {hasFailed && (
              <>
                <p className="text-sm" style={{ color: "rgba(239,68,68,0.8)" }}>
                  {eco.processing_status === "ERROR"
                    ? eco.processing_error || "Le traitement de l'audio a échoué."
                    : "La génération du résumé a échoué."}
                </p>
                {hasTranscription && <RelancerButton ecoId={eco.id} onSuccess={onRefresh} />}
              </>
            )}
            {!hasFailed && showRetryHint && (
              <>
                <p className="text-sm" style={{ color: "rgba(245,158,11,0.8)" }}>Traitement en cours ou échoué.</p>
                <RelancerButton ecoId={eco.id} onSuccess={onRefresh} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  /* ── Tab 2: Transcription ──────────────────────────────────── */
  const transcriptionContent = (
    <div className="prose prose-base max-w-none">
      <div className="flex justify-end mb-6">
        {transcription && <CopyButton text={transcription} />}
      </div>
      {isTranscribing ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 rounded-lg eco-skeleton w-full" />
          <div className="h-4 rounded-lg eco-skeleton w-5/6" />
          <div className="h-4 rounded-lg eco-skeleton w-full" />
          <div className="h-4 rounded-lg eco-skeleton w-4/5" />
          <p className="text-sm mt-2" style={{ color: "rgba(237,236,232,0.35)" }}>Transcription en cours…</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(237,236,232,0.75)" }}>
            {transcription || "—"}
          </p>
          {showRetryHint && !transcription && (
            <p className="text-sm" style={{ color: "rgba(245,158,11,0.7)" }}>
              Transcription en cours ou échouée. Rafraîchir la page ou réessayer plus tard.
            </p>
          )}
        </div>
      )}
    </div>
  );

  /* ── Tab 3: Points clés ────────────────────────────────────── */
  const keyPointsContent = (
    <div className="prose prose-base max-w-none">
      {summary && summary.pointsCles && summary.pointsCles.length > 0 ? (
        <ul className="space-y-3">
          {summary.pointsCles.map((point: string, index: number) => (
            <li
              key={index}
              className="flex items-start gap-3 leading-relaxed"
            >
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: "#C9B8FF" }}
              />
              <span style={{ color: "rgba(237,236,232,0.8)" }}>{point}</span>
            </li>
          ))}
        </ul>
      ) : isGenerating ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 rounded-lg eco-skeleton w-full" />
          <div className="h-4 rounded-lg eco-skeleton w-5/6" />
          <div className="h-4 rounded-lg eco-skeleton w-4/5" />
        </div>
      ) : (
        <p style={{ color: "rgba(237,236,232,0.35)" }}>Aucun point clé disponible</p>
      )}
    </div>
  );

  /* ── Tab 4: Quiz ───────────────────────────────────────────── */
  const rawQuiz = eco?.quiz;
  const quizData: QuizQuestion[] | null | undefined =
    Array.isArray(rawQuiz) && rawQuiz.length > 0 &&
    typeof (rawQuiz[0] as unknown as Record<string, unknown>)?.question === "string"
      ? (rawQuiz as QuizQuestion[])
      : null;

  /* ── Notions + Flashcards (dérivés du résumé et du quiz déjà générés) ── */
  const notionList = (summary?.notions ?? [])
    .map((n) => {
      if (typeof n === "string") {
        const idx = n.indexOf(":");
        return idx > 0 ? { terme: n.slice(0, idx).trim(), definition: n.slice(idx + 1).trim() } : { terme: n.trim(), definition: "" };
      }
      return { terme: n.terme?.trim() ?? "", definition: n.definition?.trim() ?? "" };
    })
    .filter((n) => n.terme);

  const notionsContent = notionList.length > 0 ? (
    <dl>
      {notionList.map((n, i) => (
        <div
          key={`${n.terme}-${i}`}
          className="grid gap-1 py-4 first:pt-0 md:grid-cols-[220px_1fr] md:gap-6"
          style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)" }}
        >
          <dt className="font-medium" style={{ color: "#EDECE8" }}>{n.terme}</dt>
          <dd className="leading-relaxed" style={{ color: "rgba(237,236,232,0.7)" }}>{n.definition || "—"}</dd>
        </div>
      ))}
    </dl>
  ) : isGenerating ? (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 rounded-lg eco-skeleton w-full" />
      <div className="h-4 rounded-lg eco-skeleton w-4/5" />
    </div>
  ) : (
    <p style={{ color: "rgba(237,236,232,0.35)" }}>Aucune notion disponible</p>
  );
  const mcqCount = quizData?.filter((q) => q.type === "mcq").length ?? 0;
  const correctCount = quizSubmitted
    ? (quizData?.filter((q, i) => q.type === "mcq" && quizAnswers[i] === q.answer).length ?? 0)
    : 0;

  const quizContent = (
    <div>
      {isGenerating || isQuizPending ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-xl space-y-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="h-4 rounded eco-skeleton w-3/4" />
              <div className="space-y-2">
                {[0,1,2,3].map(j => <div key={j} className="h-10 rounded-lg eco-skeleton" />)}
              </div>
            </div>
          ))}
          <p className="text-sm" style={{ color: "rgba(237,236,232,0.35)" }}>Quiz en cours de génération…</p>
        </div>
      ) : quizData && quizData.length > 0 ? (
        <div className="space-y-5">
          {quizSubmitted && mcqCount > 0 && (
            <div
              className="p-4 rounded-xl border text-sm font-medium"
              style={
                correctCount === mcqCount
                  ? { background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.25)", color: "#6EE7B7" }
                  : correctCount >= Math.ceil(mcqCount * 0.6)
                  ? { background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.25)", color: "#93C5FD" }
                  : { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)", color: "#FCD34D" }
              }
            >
              {correctCount}/{mcqCount} QCM correctes —{" "}
              {correctCount === mcqCount ? "Parfait !" : correctCount >= Math.ceil(mcqCount * 0.6) ? "Bon travail !" : "Continuez à réviser !"}
            </div>
          )}

          {quizData.map((question, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="font-medium mb-4 leading-relaxed" style={{ color: "#EDECE8" }}>
                {idx + 1}. {question.question}
              </p>

              {question.type === "mcq" ? (
                <div className="space-y-2">
                  {(question.options ?? []).map((option) => {
                    const letter = option.charAt(0);
                    const isSelected = quizAnswers[idx] === letter;
                    const isCorrect = letter === question.answer;
                    let style: React.CSSProperties = {
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(237,236,232,0.7)",
                    };
                    if (!quizSubmitted) {
                      if (isSelected) style = {
                        background: "rgba(201,184,255,0.15)",
                        border: "1px solid rgba(201,184,255,0.4)",
                        color: "#EDECE8",
                      };
                    } else {
                      if (isCorrect) style = {
                        background: "rgba(16,185,129,0.12)",
                        border: "1px solid rgba(16,185,129,0.35)",
                        color: "#6EE7B7",
                      };
                      else if (isSelected) style = {
                        background: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        color: "#FCA5A5",
                      };
                      else style = {
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "rgba(237,236,232,0.3)",
                      };
                    }
                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={quizSubmitted}
                        onClick={() => setQuizAnswers((prev) => ({ ...prev, [idx]: letter }))}
                        className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all cursor-pointer disabled:cursor-default"
                        style={style}
                        onMouseEnter={e => {
                          if (!quizSubmitted && !isSelected) {
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                          }
                        }}
                        onMouseLeave={e => {
                          if (!quizSubmitted && !isSelected) {
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                          }
                        }}
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
                    className="w-full p-4 rounded-xl text-sm leading-relaxed resize-y min-h-[120px] transition-all outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(237,236,232,0.8)",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(201,184,255,0.35)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
                  />
                  {revealedOpen.has(idx) ? (
                    <div
                      className="p-4 rounded-xl text-sm leading-relaxed"
                      style={{ background: "rgba(201,184,255,0.08)", border: "1px solid rgba(201,184,255,0.15)" }}
                    >
                      <p className="text-xs font-medium mb-2" style={{ color: "rgba(201,184,255,0.7)" }}>Réponse modèle</p>
                      <p style={{ color: "rgba(237,236,232,0.75)" }}>{question.answer}</p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRevealedOpen((prev) => new Set([...prev, idx]))}
                      className="px-4 py-2 text-sm rounded-xl transition-all"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        color: "rgba(237,236,232,0.5)",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.09)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
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
              className="app-btn app-btn-primary w-full"
            >
              Valider le quiz
            </button>
          )}
          {quizSubmitted && (
            <button
              type="button"
              onClick={() => { setQuizAnswers({}); setRevealedOpen(new Set()); setQuizSubmitted(false); }}
              className="w-full px-6 py-3 rounded-xl font-medium text-sm transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(237,236,232,0.65)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            >
              Recommencer le quiz
            </button>
          )}
        </div>
      ) : (
        <p style={{ color: "rgba(237,236,232,0.35)" }}>Aucun quiz disponible</p>
      )}
    </div>
  );

  const tabs = [
    { id: "summary", label: "Résumé", content: summaryContent },
    { id: "keypoints", label: "Points clés", content: keyPointsContent },
    { id: "notions", label: "Notions", content: notionsContent },
    { id: "quiz", label: "Quiz", content: quizContent },
    { id: "flashcards", label: "Flashcards", content: <Flashcards cards={flashcards} title={eco.title} /> },
    { id: "transcription", label: "Transcription", content: transcriptionContent },
  ];

  const durationLabel =
    eco.duration_seconds != null && eco.duration_seconds > 0
      ? `${Math.max(1, Math.round(eco.duration_seconds / 60))} min`
      : null;
  const dateLabel = new Date(eco.created_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const copySummary = async () => {
    if (!summary?.resume) return;
    const text = [summary.titre, "", summary.resume.replace(/\*\*/g, ""), "", "Points clés :", ...(summary.pointsCles ?? []).map((p) => `- ${p}`)].join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Fiche copiée");
  };

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="mx-auto w-full max-w-[860px] px-5 pb-24 pt-8 md:pt-12">
      {process.env.NODE_ENV !== "production" && (
        <div className="mb-6 rounded-xl border p-3 font-mono text-xs" style={{ borderColor: "rgba(245,158,11,0.2)", color: "rgba(245,158,11,0.8)" }}>
          ecoId: {eco.id} · ai_status: {eco.ai_status ?? "—"} · transcription: {lastEcoFetch?.transcriptionLen ?? 0} · contenu: {lastEcoFetch?.contentLen ?? 0}
        </div>
      )}

      <header>
        <p className="text-[13px] first-letter:uppercase" style={{ color: "var(--mk-faint)" }}>
          {dateLabel}
          {durationLabel && <> · {durationLabel}</>}
          {eco.source_type === "screen" ? " · son d'un onglet" : ""}
          {eco.has_pdf_context ? " · avec le PDF du cours" : ""}
        </p>
        <h1 className="mk-display mt-2 text-[34px] leading-[1.08] sm:text-[44px]">{eco.title}</h1>
        {summary?.resume && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={copySummary} className="app-btn app-btn-ghost !h-8 !rounded-lg !px-3 !text-[13px]">
              <Copy className="h-3.5 w-3.5" /> Copier la fiche
            </button>
          </div>
        )}
      </header>

      <div className="mt-8">
        <Tabs tabs={tabs} defaultTab="summary" />
      </div>
    </div>
  );
}
