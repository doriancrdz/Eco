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
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        onClick={onStop}
        className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-white font-medium z-10 border border-rose-400/30 bg-gradient-to-br from-rose-500 via-rose-600 to-red-600 hover:from-rose-400 hover:to-red-500 shadow-[0_0_24px_rgba(244,63,94,0.4),0_0_12px_rgba(190,18,60,0.3)] transition-all"
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
