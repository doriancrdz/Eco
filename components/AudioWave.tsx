"use client";

import { motion } from "framer-motion";

const BAR_COUNT = 20;
const MIN_HEIGHT = 6;
const MAX_HEIGHT = 52;

interface AudioWaveProps {
  frequencyData?: number[];
  isPaused?: boolean;
}

export default function AudioWave({ frequencyData = [], isPaused = false }: AudioWaveProps) {
  const values =
    frequencyData.length >= BAR_COUNT
      ? frequencyData.slice(0, BAR_COUNT)
      : [...frequencyData, ...Array.from({ length: BAR_COUNT - frequencyData.length }, () => 0)];

  return (
    <div className="flex items-center justify-center gap-1.5 h-32 px-2 py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-[0_0_30px_rgba(125,211,252,0.15),inset_0_1px_0_rgba(255,255,255,0.2)]">
      {values.map((raw, i) => {
        const normalized = isPaused ? 0 : Math.min(255, Math.max(0, raw));
        const height = MIN_HEIGHT + (normalized / 255) * (MAX_HEIGHT - MIN_HEIGHT);
        return (
          <motion.div
            key={i}
            className="w-1.5 rounded-full flex-shrink-0 bg-gradient-to-t from-cyan-500 via-violet-500 to-cyan-400 shadow-[0_0_12px_rgba(125,211,252,0.5),0_0_4px_rgba(139,92,246,0.4)]"
            animate={{ height: `${height}px` }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{
              minHeight: `${MIN_HEIGHT}px`,
            }}
          />
        );
      })}
    </div>
  );
}
