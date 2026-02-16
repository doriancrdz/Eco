"use client";

import React, { useState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, LogOut, Sparkles } from "lucide-react";

interface ProfileViewProps {
  isOpen: boolean;
  onClose: () => void;
  userImageUrl?: string;
  userName?: string;
}

export default function ProfileView({
  isOpen,
  onClose,
  userImageUrl,
  userName,
}: ProfileViewProps) {
  const { signOut } = useClerk();
  const router = useRouter();
  const [userPlan, setUserPlan] = useState<string>("free");
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchPlan = async () => {
        try {
          const res = await fetch("/api/billing/me", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            setUserPlan(data.plan || "free");
          }
        } catch {
          // Erreur silencieuse
        }
      };
      fetchPlan();
    }
  }, [isOpen]);

  const handleSignOut = () => {
    signOut();
    onClose();
  };

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Erreur silencieuse
    } finally {
      setIsLoadingPortal(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment key="profile-view">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
      />
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white/90 backdrop-blur-2xl border-l border-white/80 shadow-xl z-50 rounded-l-[3rem]"
      >
        <div className="p-8 pt-12">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden border-4 border-white/80 shadow-lg">
              {userImageUrl ? (
                <img
                  src={userImageUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-aura-emerald to-aura-blue flex items-center justify-center text-2xl font-bold text-gray-700">
                  {userName?.charAt(0) || "?"}
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {userName || "Utilisateur"}
            </h2>
          </div>

          <div className="space-y-2">
            <motion.button
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                router.push("/settings/preferences");
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/60 border border-white/50 text-gray-900 font-medium hover:bg-white/90 transition-all"
            >
              <Settings className="w-5 h-5" />
              Paramètres
            </motion.button>

            {userPlan === "free" ? (
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  router.push("/pricing");
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/60 border border-white/50 text-gray-900 font-medium hover:bg-white/90 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                Passer au forfait supérieur
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleManageSubscription}
                disabled={isLoadingPortal}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/60 border border-white/50 text-gray-900 font-medium hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingPortal ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                    />
                    Chargement...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Gérer mon abonnement
                  </>
                )}
              </motion.button>
            )}

            <motion.button
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </motion.button>
          </div>
        </div>
      </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
