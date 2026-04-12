"use client";

import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";

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
  // BUG 3 FIX: Ne montrer le warning qu'après 2 secondes si toujours non disponible
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (showMicroWarning && state === "recording") {
      // Attendre 2 secondes avant d'afficher le warning
      const timer = setTimeout(() => {
        setShowWarning(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowWarning(false);
    }
  }, [showMicroWarning, state]);
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
      ? undefined
      : state === "generating"
      ? undefined
      : undefined;

  return (
    <motion.div
      className="relative inline-flex items-center justify-center bg-transparent"
      style={{
        width: size,
        height: size,
        background: "transparent",
        outline: "none",
        boxShadow: "none",
      }}
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
      {/* Rendu identique à l'accueil : logo seul, aucun shape/overlay (glow très diffus uniquement) */}
      <motion.div
        className="w-full h-full flex items-center justify-center cursor-pointer select-none rounded-none border-0 overflow-visible"
        style={{
          background: "transparent",
          boxShadow: "none",
          outline: "none",
          ...(glowStyle ?? {}),
          ...(state === "recording" && typeof soundLevel === "number"
            ? { filter: `brightness(${0.92 + (soundLevel - 0.95) * 0.5})` }
            : {}),
        }}
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
              ? "0 0 80px rgba(184,232,208,0.12)"
              : state === "generating"
              ? "0 0 60px rgba(184,232,208,0.12)"
              : "none",
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
      >
        <Image
          src="/logo-eco.png"
          alt="ECO"
          width={size}
          height={size}
          priority={size >= 200}
          unoptimized
          className="bg-transparent block w-full h-full object-contain select-none"
        />
      </motion.div>
      {showWarning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute bottom-0 right-0 w-4 h-4 text-amber-400"
        >
          <AlertCircle className="w-full h-full" />
        </motion.div>
      )}
    </motion.div>
  );
}
