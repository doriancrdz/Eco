"use client";

import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Clock } from "lucide-react";

interface PackCardProps {
  name: string;
  minutes: number;
  price: number;
  onSelect: () => void;
  isLoading?: boolean;
  index?: number;
}

function PackCard({
  name,
  minutes,
  price,
  onSelect,
  isLoading = false,
  index = 0,
}: PackCardProps) {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const pricePerMinute = (price / minutes).toFixed(3);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.4,
            delay: index * 0.05,
            ease: [0.22, 1, 0.36, 1],
          },
        },
      }}
      whileHover={isMobile ? {} : {
        y: -6,
        scale: 1.02,
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
      }}
      style={{ willChange: isMobile ? 'auto' : 'transform' }}
      className="floating-card rounded-card border border-white/40 p-7 hover:border-white/60 hover:shadow-xl transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 mb-2"
          >
            <motion.div
              whileHover={isMobile ? {} : { rotate: 5 }}
              transition={{ duration: 0.2 }}
              style={{ willChange: isMobile ? 'auto' : 'transform' }}
            >
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500/20" />
            </motion.div>
            <h4 className="text-xl font-bold text-gray-900">{name}</h4>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="text-right ml-4"
        >
          <div className="text-3xl font-bold text-gray-900">{price}€</div>
          <div className="text-xs text-gray-500 font-medium">one-time</div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mb-6 p-4 bg-gradient-to-br from-amber-50/50 to-orange-50/50 rounded-lg border border-amber-100/50"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-700">
            <span className="text-2xl font-bold text-gray-900">+{minutes}</span>
            <span className="text-sm">minutes</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">~{pricePerMinute}€/min</div>
            <div className="text-xs text-emerald-600 font-medium">Ajoutées immédiatement</div>
          </div>
        </div>
      </motion.div>

      <motion.button
        whileHover={isMobile || isLoading ? {} : {
          scale: 1.02,
          y: -2,
        }}
        whileTap={{ scale: 0.98 }}
        onClick={onSelect}
        disabled={isLoading}
        style={{ willChange: isMobile ? 'auto' : 'transform' }}
        className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all bg-gradient-to-r from-gray-800 to-gray-700 text-white hover:from-gray-700 hover:to-gray-600 shadow-lg relative overflow-hidden ${
          isLoading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            />
            Chargement...
          </span>
        ) : (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-10 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Acheter ce pack
          </motion.span>
        )}
        {!isLoading && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: "-100%" }}
            whileHover={{ x: "100%" }}
            transition={{ duration: 0.6 }}
          />
        )}
      </motion.button>
    </motion.div>
  );
}

export default memo(PackCard);
