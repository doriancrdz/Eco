"use client";

import { motion } from "framer-motion";

const BAR_COUNT = 32;
const MIN_HEIGHT = 3;
const MAX_HEIGHT = 56;

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
    <div className="flex items-end justify-center gap-0.5 h-14">
      {values.map((raw, i) => {
        const normalized = isPaused ? 0 : Math.min(255, Math.max(0, raw));
        const t = normalized / 255;
        const height = MIN_HEIGHT + Math.pow(t, 0.85) * (MAX_HEIGHT - MIN_HEIGHT);
        return (
          <motion.div
            key={i}
            className="w-1 rounded-full flex-shrink-0 bg-gradient-to-t from-cyan-500/90 via-violet-500/90 to-cyan-400/90 shadow-[0_0_6px_rgba(125,211,252,0.4)]"
            animate={{ height: `${height}px` }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            style={{
              minHeight: `${MIN_HEIGHT}px`,
            }}
          />
        );
      })}
    </div>
  );
}
