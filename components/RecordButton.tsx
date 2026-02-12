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
      <div className="aura-ring aura-ring-recording relative">
        <motion.button
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          onClick={onStop}
          className="relative w-24 h-24 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-2xl hover:bg-gray-700 transition-colors z-10"
        >
          <Square className="w-10 h-10" />
        </motion.button>
      </div>
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
