"use client";

import { Menu, Share2, Mic, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import PlanBadge from "./PlanBadge";

interface HeaderProps {
  onGoHome: () => void;
  onStartRecording?: () => void;
  isDemoMode?: boolean;
  onMenuClick?: () => void;
  isDetailView?: boolean;
  onShare?: () => void;
  onAvatarClick?: () => void;
  userImageUrl?: string;
  userName?: string;
}

export default function Header({
  onGoHome,
  onStartRecording,
  isDemoMode,
  onMenuClick,
  isDetailView,
  onShare,
  onAvatarClick,
  userImageUrl,
  userName,
}: HeaderProps) {
  return (
    <header className="h-[72px] px-6 py-0 flex items-center justify-between gap-4 bg-white/40 backdrop-blur-xl sticky top-0 z-20 border-b border-white/20">
      {/* Left: hamburger (mobile), ArrowLeft (detail), Logo ECO */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        {isDetailView && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onGoHome}
            className="p-2 rounded-xl hover:bg-white/50 transition-colors shrink-0"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </motion.button>
        )}
        {onMenuClick && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl hover:bg-white/50 transition-colors shrink-0"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5 text-gray-800" />
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGoHome}
          className="flex items-center gap-2 text-gray-900 group shrink-0"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#99f6e4] via-[#7dd3fc] to-[#a5b4fc] flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4 text-gray-800" />
          </div>
          <span className="text-xl font-bold tracking-tight hidden sm:inline">ECO</span>
        </motion.button>
        {isDemoMode && (
          <span className="px-2.5 py-1 bg-amber-100/80 text-amber-700 text-xs font-medium rounded-md border border-amber-200/50">
            Mode démo
          </span>
        )}
      </div>

      {/* Center: PlanBadge */}
      <div className="flex-1 flex justify-center min-w-0">
        <PlanBadge />
      </div>

      {/* Right: Share (detail only), avatar */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        {isDetailView && onShare && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onShare}
            className="p-2 rounded-xl hover:bg-white/50 transition-colors"
            aria-label="Partager"
          >
            <Share2 className="w-5 h-5 text-gray-800" />
          </motion.button>
        )}
        {onStartRecording && !isDetailView && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStartRecording}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg"
          >
            <Mic className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Nouvel enregistrement</span>
            <span className="text-sm sm:hidden">Nouveau</span>
          </motion.button>
        )}
        {onAvatarClick && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAvatarClick}
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/60 shadow-md shrink-0 flex items-center justify-center bg-gradient-to-br from-aura-emerald to-aura-blue"
          >
            {userImageUrl ? (
              <img
                src={userImageUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-gray-800">
                {userName?.charAt(0) || "?"}
              </span>
            )}
          </motion.button>
        )}
      </div>
    </header>
  );
}
