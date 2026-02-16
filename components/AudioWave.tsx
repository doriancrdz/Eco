"use client";

const BAR_COUNT = 20;
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 48;

interface AudioWaveProps {
  frequencyData?: number[];
  isPaused?: boolean;
}

export default function AudioWave({ frequencyData = [], isPaused = false }: AudioWaveProps) {
  const values = frequencyData.length >= BAR_COUNT
    ? frequencyData.slice(0, BAR_COUNT)
    : [...frequencyData, ...Array.from({ length: BAR_COUNT - frequencyData.length }, () => 0)];

  return (
    <div className="flex items-center justify-center gap-1 h-32">
      {values.map((raw, i) => {
        const normalized = isPaused ? 0 : Math.min(255, Math.max(0, raw));
        const height = MIN_HEIGHT + (normalized / 255) * (MAX_HEIGHT - MIN_HEIGHT);
        return (
          <div
            key={i}
            className="w-1 bg-gray-900 rounded-full flex-shrink-0"
            style={{
              height: `${height}px`,
              minHeight: `${MIN_HEIGHT}px`,
              transition: "height 80ms ease-out",
            }}
          />
        );
      })}
    </div>
  );
}
