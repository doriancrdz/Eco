"use client";

import { motion } from "framer-motion";

export default function AudioWave() {
  const bars = Array.from({ length: 20 }, (_, i) => i);

  return (
    <div className="flex items-center justify-center gap-1 h-32">
      {bars.map((i) => (
        <motion.div
          key={i}
          className="w-1 bg-black rounded-full"
          animate={{
            height: [
              Math.random() * 20 + 10,
              Math.random() * 60 + 30,
              Math.random() * 20 + 10,
            ],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.05,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
