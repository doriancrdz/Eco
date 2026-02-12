"use client";

import { Home, Mic } from "lucide-react";
import { motion } from "framer-motion";
import QuotaIndicator from "./QuotaIndicator";

interface HeaderProps {
  onGoHome: () => void;
  onStartRecording: () => void;
  isDemoMode?: boolean;
}

export default function Header({ onGoHome, onStartRecording, isDemoMode }: HeaderProps) {
  return (
    <header className="h-20 glass-panel border-b border-white/30 flex items-center justify-between px-4 md:px-8 z-40">
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGoHome}
          className="flex items-center gap-3 text-gray-800 hover:text-gray-900 transition-colors group"
        >
          <Home className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span className="text-2xl font-semibold tracking-tight">ECO</span>
        </motion.button>
        
        {isDemoMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-2.5 py-1 bg-amber-100/80 text-amber-700 text-xs font-medium rounded-md border border-amber-200/50"
          >
            Mode démo
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <QuotaIndicator />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStartRecording}
          className="flex items-center gap-2.5 px-4 md:px-5 py-2.5 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-all shadow-lg hover:shadow-xl"
        >
          <Mic className="w-4 h-4" />
          <span className="font-medium text-sm hidden sm:inline">Nouvel enregistrement</span>
          <span className="font-medium text-sm sm:hidden">Nouveau</span>
        </motion.button>
      </div>
    </header>
  );
}
