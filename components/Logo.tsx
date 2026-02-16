"use client";

import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

export type LogoState = "idle" | "recording" | "paused" | "generating";

interface LogoProps {
  state?: LogoState;
  soundLevel?: number;
  size?: number;
  onClick?: () => void;
  isClickable?: boolean;
  showMicroWarning?: boolean;
}

export default function Logo({
  state = "idle",
  soundLevel = 1,
  size = 120,
  onClick,
  isClickable = false,
  showMicroWarning = false,
}: LogoProps) {
  const scale =
    state === "recording"
      ? 0.97 + (soundLevel - 0.95) * 1.2
      : state === "generating"
      ? undefined
      : state === "paused"
      ? 1
      : undefined;

  const rotation =
    state === "idle"
      ? 20
      : state === "recording"
      ? 8
      : state === "paused"
      ? 0
      : state === "generating"
      ? 3
      : 20;

  const glowStyle =
    state === "paused"
      ? { boxShadow: "0 0 40px rgba(251,191,36,0.25)" }
      : state === "generating"
      ? undefined
      : undefined;

  return (
    <motion.div
      className="relative inline-flex items-center justify-center bg-transparent"
      style={{ width: size, height: size }}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable && onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Pas de shape : uniquement logo + glow via boxShadow (rendu identique à l'accueil) */}
      <motion.div
        className="w-full h-full flex items-center justify-center cursor-pointer select-none bg-transparent rounded-none border-0 shadow-none"
        animate={{
          rotate: state === "paused" ? 0 : 360,
          y: state === "recording" ? [0, -4, 0] : state === "paused" ? 0 : undefined,
          scale:
            state === "idle"
              ? [1, 1.03, 1]
              : state === "recording"
              ? scale ?? 1
              : state === "generating"
              ? [0.95, 1.1, 0.95]
              : 1,
          boxShadow:
            state === "recording"
              ? "0 0 50px rgba(184,232,208,0.2), 0 0 90px rgba(184,216,232,0.15)"
              : state === "generating"
              ? "0 0 40px rgba(184,232,208,0.2), 0 0 60px rgba(184,216,232,0.15)"
              : undefined,
        }}
        transition={
          state === "idle"
            ? {
                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
              }
            : state === "recording"
            ? {
                rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                y: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
                scale: { type: "spring", stiffness: 220, damping: 22 },
              }
            : state === "paused"
            ? { duration: 0.3 }
            : state === "generating"
            ? {
                rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              }
            : {}
        }
        style={{
          ...glowStyle,
          ...(state === "recording" && typeof soundLevel === "number"
            ? { filter: `brightness(${0.92 + (soundLevel - 0.95) * 0.5})` }
            : {}),
        }}
      >
        <img
          src="/logo-eco.png"
          alt="ECO"
          className="bg-transparent block w-full h-full object-contain select-none"
        />
      </motion.div>
      {showMicroWarning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-0 right-0 w-4 h-4 text-amber-400"
        >
          <AlertCircle className="w-full h-full" />
        </motion.div>
      )}
    </motion.div>
  );
}
