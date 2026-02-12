"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PricingTopbar() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-50 backdrop-blur-md bg-white/60 border-b border-white/40"
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo ECO + Retour */}
        <Link href="/" className="flex items-center gap-3 group">
          <motion.div
            whileHover={{ x: -2 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600 group-hover:text-gray-900 transition-colors" />
            <span className="text-xl font-bold text-gray-900">ECO</span>
          </motion.div>
        </Link>

        {/* Bouton connexion si non connecté */}
        {!isSignedIn && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/sign-in?redirect_url=/pricing")}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Se connecter
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
