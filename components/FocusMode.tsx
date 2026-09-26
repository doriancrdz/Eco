"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play } from "lucide-react";
import ScrollingWaveformBars from "./ScrollingWaveformBars";
import RecordButton from "./RecordButton";
import Logo from "./Logo";

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface FocusModeProps {
  isActive: boolean;
  isRecording: boolean;
  isPaused?: boolean;
  onTogglePause?: () => void;
  soundLevel?: number;
  frequencyData?: number[];
  showMicroWarning?: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  showStopConfirm?: boolean;
  onConfirmStop?: () => void;
  onCancelStop?: () => void;
  recordingElapsedSeconds?: number;
  /** Arrêt automatique (60 min, ou minutes restantes si c'est moins). */
  limitSeconds?: number;
  isQuotaLimited?: boolean;
  analyserRef?: React.RefObject<AnalyserNode | null>;
}

export default function FocusMode({
  isActive,
  isRecording,
  isPaused = false,
  onTogglePause,
  soundLevel = 1,
  frequencyData = [],
  showMicroWarning = false,
  onStartRecording,
  onStopRecording,
  showStopConfirm = false,
  onConfirmStop,
  onCancelStop,
  recordingElapsedSeconds = 0,
  limitSeconds,
  isQuotaLimited = false,
  analyserRef,
}: FocusModeProps) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (isActive) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [isActive]);

  if (!isActive) return null;

  const logoSize = isMobile ? 140 : 180;
  const waveformHeight = isMobile ? 48 : 64;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="fixed inset-0 eco-focus-bg z-50 overflow-auto"
      >
        <div className="flex flex-col items-center w-full min-h-full px-4 pt-8 lg:pt-24 pb-8">
        {isRecording ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full flex flex-col items-center justify-center text-center gap-4 md:gap-8"
          >
            <div className="flex flex-col items-center gap-4 lg:gap-6 mb-6 lg:mb-8">
              <div className="relative bg-transparent">
                <Logo
                  state={isPaused ? "paused" : "recording"}
                  soundLevel={soundLevel}
                  size={logoSize}
                  showMicroWarning={showMicroWarning}
                />
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-center gap-4 w-full max-w-2xl h-12 lg:h-16"
              >
                {analyserRef ? (
                  <ScrollingWaveformBars
                    analyserRef={analyserRef}
                    isPaused={isPaused}
                    width={isMobile ? 280 : 320}
                    height={waveformHeight}
                  />
                ) : (
                  <div className={isMobile ? "w-[280px] h-12" : "w-[320px] h-16"} aria-hidden />
                )}
                <span className="text-3xl lg:text-2xl font-bold tabular-nums shrink-0 min-w-[3.5rem] md:min-w-[5rem]" style={{ color: "#EDECE8", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
                  {formatTimer(recordingElapsedSeconds)}
                </span>
              </motion.div>
            </div>
            <div className="text-center mb-6 lg:mb-8">
              <div className="flex items-center justify-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isPaused ? "bg-[#6E6C68]" : "animate-pulse bg-[#F87171]"}`} />
                <span className="text-[13px]" style={{ color: isPaused ? "#9A9893" : "#FCA5A5" }}>
                  {isPaused ? "En pause" : "Enregistrement en cours · garde cette page ouverte"}
                </span>
              </div>
              {limitSeconds !== undefined && Number.isFinite(limitSeconds) && (
                <p className="mt-2 text-[12.5px]" style={{ color: limitSeconds - recordingElapsedSeconds <= 120 ? "#FCD34D" : "#7C7A76" }}>
                  {isQuotaLimited
                    ? `Il te reste ${Math.floor(limitSeconds / 60)} min : arrêt automatique à ${formatTimer(limitSeconds)}, ta fiche sera quand même créée.`
                    : `Arrêt automatique à ${formatTimer(limitSeconds)}, ta fiche sera créée.`}
                </p>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 lg:gap-4 mb-6 lg:mb-8">
              {onTogglePause && (
                <button
                  type="button"
                  onClick={onTogglePause}
                  aria-label={isPaused ? "Reprendre l'enregistrement" : "Mettre l'enregistrement en pause"}
                  className="inline-flex h-14 items-center gap-2 rounded-full border px-6 text-[15px] font-medium transition-colors hover:bg-white/[0.06]"
                  style={{ borderColor: "rgba(255,255,255,0.16)", color: "#EDECE8" }}
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {isPaused ? "Reprendre" : "Pause"}
                </button>
              )}
              <RecordButton isRecording={true} onStart={onStartRecording} onStop={onStopRecording} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-center space-y-4 md:space-y-6"
          >
            <div className="scale-[0.75] md:scale-100">
              <RecordButton
                isRecording={false}
                onStart={onStartRecording}
                onStop={onStopRecording}
              />
            </div>
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3, ease: "easeOut" }}
              className="text-base font-medium"
              style={{ color: "rgba(237,236,232,0.4)" }}
            >
              Prêt à enregistrer
            </motion.p>
          </motion.div>
        )}
        </div>
      </motion.div>

      {/* Modale confirmation stop */}
      <AnimatePresence>
        {showStopConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={onCancelStop}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="app-card w-full max-w-sm p-6"
              role="dialog"
              aria-modal="true"
            >
              <h3 className="text-[17px] font-medium" style={{ color: "#EDECE8" }}>Terminer l&apos;enregistrement ?</h3>
              <p className="mt-1.5 text-[14px]" style={{ color: "#9A9893" }}>ECO va transcrire le cours et préparer ta fiche.</p>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={onCancelStop} className="app-btn app-btn-ghost">
                  Continuer
                </button>
                <button type="button" onClick={onConfirmStop} className="app-btn app-btn-primary">
                  Terminer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
