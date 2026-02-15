"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play } from "lucide-react";
import AudioWave from "./AudioWave";
import RecordButton from "./RecordButton";
import Logo from "./Logo";

interface FocusModeProps {
  isActive: boolean;
  isRecording: boolean;
  isPaused?: boolean;
  onTogglePause?: () => void;
  soundLevel?: number;
  showMicroWarning?: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  showStopConfirm?: boolean;
  onConfirmStop?: () => void;
  onCancelStop?: () => void;
}

export default function FocusMode({
  isActive,
  isRecording,
  isPaused = false,
  onTogglePause,
  soundLevel = 1,
  showMicroWarning = false,
  onStartRecording,
  onStopRecording,
  showStopConfirm = false,
  onConfirmStop,
  onCancelStop,
}: FocusModeProps) {
  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="fixed inset-0 aura-gradient z-50 flex flex-col items-center justify-center"
      >
        {isRecording ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-center space-y-8"
          >
            <Logo
              state={isPaused ? "paused" : "recording"}
              soundLevel={soundLevel}
              size={120}
              showMicroWarning={showMicroWarning}
            />
            <AudioWave />
            <div className="flex items-center justify-center gap-4">
              {onTogglePause && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onTogglePause}
                  className="w-14 h-14 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 flex items-center justify-center text-gray-900 hover:bg-white/80 transition-all"
                >
                  {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
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
