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

  const logoSize = isMobile ? 140 : 200;
  const waveformHeight = isMobile ? 48 : 80;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="fixed inset-0 aura-gradient z-50 overflow-auto"
      >
        <div className="flex flex-col items-center lg:justify-center w-full min-h-full px-4 pt-8 lg:pt-0 pb-8">
        {isRecording ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full flex flex-col items-center justify-center text-center gap-4 md:gap-8"
          >
            <div className="flex flex-col items-center gap-4 lg:gap-8 mb-4 lg:mb-10">
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
                className="flex items-center justify-center gap-4 w-full max-w-2xl h-12 lg:h-20"
              >
                {analyserRef ? (
                  <ScrollingWaveformBars
                    analyserRef={analyserRef}
                    isPaused={isPaused}
                    width={isMobile ? 280 : 320}
                    height={waveformHeight}
                  />
                ) : (
                  <div className={isMobile ? "w-[280px] h-12" : "w-[320px] h-20"} aria-hidden />
                )}
                <span className="text-3xl md:text-5xl font-bold tabular-nums text-gray-900 shrink-0 min-w-[3.5rem] md:min-w-[5rem]">
                  {formatTimer(recordingElapsedSeconds)}
                </span>
              </motion.div>
            </div>
            <div className="text-center mb-4 lg:mb-10">
              <p className="text-xs lg:text-base text-gray-500 mt-1 lg:mt-3">
                Enregistrement en cours...
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 lg:gap-5 mb-4 lg:mb-10">
              {onTogglePause && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onTogglePause}
                  className="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white font-medium bg-white/25 backdrop-blur-xl border border-white/40 shadow-[0_0_20px_rgba(34,211,238,0.2),inset_0_1px_0_rgba(255,255,255,0.3)] hover:bg-white/35 hover:border-white/50 transition-all bg-gradient-to-br from-cyan-500/80 via-violet-500/70 to-violet-600/80"
                >
                  {isPaused ? <Play className="w-5 h-5 md:w-8 md:h-8" /> : <Pause className="w-5 h-5 md:w-8 md:h-8" />}
                </motion.button>
              )}
              <div className="scale-[0.75] md:scale-100">
                <RecordButton
                  isRecording={true}
                  onStart={onStartRecording}
                  onStop={onStopRecording}
                />
              </div>
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
              className="text-gray-700 text-base font-medium"
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
              className="bg-white/90 backdrop-blur-2xl rounded-[3rem] border border-white/80 shadow-xl p-8 max-w-sm w-full"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">Terminer l&apos;enregistrement ?</h3>
              <p className="text-gray-600 text-sm mb-6">L&apos;enregistrement sera traité et généré.</p>
              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onConfirmStop}
                  className="flex-1 py-3 rounded-2xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-all"
                >
                  OUI, TERMINER
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onCancelStop}
                  className="flex-1 py-3 rounded-2xl bg-white/60 border border-white/50 text-gray-900 font-bold hover:bg-white/90 transition-all"
                >
                  CONTINUER
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
