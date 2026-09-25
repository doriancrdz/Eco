"use client";

import { Mic, Square } from "lucide-react";

interface RecordButtonProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function RecordButton({ isRecording, onStart, onStop }: RecordButtonProps) {
  if (isRecording) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="Terminer l'enregistrement"
        className="inline-flex h-14 items-center gap-3 rounded-full px-7 text-[15px] font-medium transition-transform active:scale-[0.98]"
        style={{ background: "#EDECE8", color: "#0A0A0B" }}
      >
        <Square className="h-4 w-4" fill="currentColor" />
        Terminer
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onStart}
      aria-label="Démarrer l'enregistrement"
      className="flex h-20 w-20 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
      style={{ background: "#EDECE8", color: "#0A0A0B" }}
    >
      <Mic className="h-8 w-8" />
    </button>
  );
}
