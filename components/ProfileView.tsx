"use client";

import React, { useState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, LogOut, Sparkles } from "lucide-react";
import UserAvatar from "./UserAvatar";

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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

  const handleSignOut = async () => {
    await signOut({ redirectUrl: '/sign-in' });
    onClose();
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
            <div className="rounded-full border-4 border-white/80 shadow-lg">
              <UserAvatar size="xl" />
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

            {userPlan === "free" && (
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
            )}

            {userPlan !== "free" && (
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  router.push("/settings");
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/60 border border-white/50 text-gray-900 font-medium hover:bg-white/90 transition-all"
              >
                <Settings className="w-5 h-5" />
                Gérer mon abonnement
              </motion.button>
            )}

            <motion.button
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Modale de confirmation de déconnexion */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 z-[61] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 px-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-confirm-title"
            >
              <div className="bg-white rounded-3xl p-8 shadow-2xl border border-white/40">
                <h3 id="logout-confirm-title" className="text-xl font-bold text-gray-900 mb-4">
                  Se déconnecter ?
                </h3>
                <p className="text-gray-600 mb-6">
                  Êtes-vous sûr de vouloir vous déconnecter ?
                </p>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 rounded-xl font-medium text-gray-900 hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSignOut}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                  >
                    Oui, déconnecter
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
