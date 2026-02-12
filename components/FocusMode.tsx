"use client";

import { motion, AnimatePresence } from "framer-motion";
import AudioWave from "./AudioWave";
import RecordButton from "./RecordButton";

interface FocusModeProps {
  isActive: boolean;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export default function FocusMode({
  isActive,
  isRecording,
  onStartRecording,
  onStopRecording,
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
            <AudioWave />
            <div>
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
    </AnimatePresence>
  );
}
