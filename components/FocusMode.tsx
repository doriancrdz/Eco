"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play } from "lucide-react";
import AudioWave from "./AudioWave";
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
}: FocusModeProps) {
  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="fixed inset-0 aura-gradient z-50 w-full flex flex-col items-center justify-center"
      >
        {isRecording ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full flex flex-col items-center justify-center text-center gap-10 px-4"
          >
            <div className="flex flex-col items-center gap-8">
              {/* Même wrapper que page d'accueil : aucun fond / shape derrière le logo */}
              <div className="relative bg-transparent">
                <Logo
                  state={isPaused ? "paused" : "recording"}
                  soundLevel={soundLevel}
                  size={175}
                  showMicroWarning={showMicroWarning}
                />
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-center gap-4 w-full max-w-md"
              >
                <AudioWave frequencyData={frequencyData} isPaused={isPaused} />
                <span className="text-sm font-semibold tabular-nums text-gray-700 shrink-0 min-w-[3rem]">
                  {formatTimer(recordingElapsedSeconds)}
                </span>
              </motion.div>
            </div>
            <div className="flex items-center justify-center gap-5">
              {onTogglePause && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onTogglePause}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-medium bg-white/25 backdrop-blur-xl border border-white/40 shadow-[0_0_20px_rgba(34,211,238,0.2),inset_0_1px_0_rgba(255,255,255,0.3)] hover:bg-white/35 hover:border-white/50 transition-all bg-gradient-to-br from-cyan-500/80 via-violet-500/70 to-violet-600/80"
                >
                  {isPaused ? <Play className="w-7 h-7" /> : <Pause className="w-7 h-7" />}
                </motion.button>
              )}
              <RecordButton
                isRecording={true}
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
              Enregistrement en cours...
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-center space-y-6"
          >
            <RecordButton
              isRecording={false}
              onStart={onStartRecording}
              onStop={onStopRecording}
            />
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
