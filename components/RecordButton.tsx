"use client";

import { Mic, Square } from "lucide-react";
import { motion } from "framer-motion";

interface RecordButtonProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function RecordButton({
  isRecording,
  onStart,
  onStop,
}: RecordButtonProps) {
  if (isRecording) {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        onClick={onStop}
        aria-label="Arrêter l'enregistrement"
        className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-white font-medium z-10 bg-white/25 backdrop-blur-xl border border-white/40 shadow-[0_0_20px_rgba(244,114,182,0.2),inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-white/35 hover:border-white/50 transition-all bg-gradient-to-br from-rose-300/80 via-pink-400/70 to-violet-500/70"
      >
        <Square className="w-7 h-7" />
      </motion.button>
    );
  }

  return (
    <div className="aura-ring">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onStart}
        className="relative w-24 h-24 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-2xl hover:bg-gray-700 transition-all z-10"
      >
        <Mic className="w-10 h-10" />
      </motion.button>
    </div>
  );
}
