"use client";

import React, { useState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, LogOut, Sparkles, CreditCard } from "lucide-react";
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
          // silent
        }
      };
      fetchPlan();
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/sign-in" });
    onClose();
  };

  const planLabel =
    userPlan === "free" ? "Free" :
    userPlan === "student" ? "Student" :
    userPlan === "pro" ? "Pro" :
    userPlan === "business" ? "Business" :
    userPlan;

  const menuItems = [
    {
      icon: Settings,
      label: "Paramètres",
      action: () => { router.push("/settings/preferences"); onClose(); },
    },
    userPlan === "free" ? {
      icon: Sparkles,
      label: "Passer au forfait supérieur",
      action: () => { router.push("/pricing"); onClose(); },
      highlight: true,
    } : {
      icon: CreditCard,
      label: "Gérer mon abonnement",
      action: () => { router.push("/settings"); onClose(); },
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment key="profile-view">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          />

          {/* Panel — slide from top-right */}
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-50 rounded-2xl"
            style={{
              top: 68,
              right: 16,
              width: 280,
              background: "#141619",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors z-10"
              style={{ color: "rgba(237,236,232,0.35)" }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "rgba(237,236,232,0.7)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "rgba(237,236,232,0.35)";
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>

            {/* User header */}
            <div
              className="flex items-center gap-3 p-4 pb-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="shrink-0">
                <UserAvatar size="md" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate text-sm" style={{ color: "#EDECE8" }}>
                  {userName || "Utilisateur"}
                </p>
                <div
                  className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: "rgba(139,92,246,0.15)",
                    color: "#A78BFA",
                    border: "1px solid rgba(139,92,246,0.2)",
                  }}
                >
                  <Sparkles style={{ width: 10, height: 10 }} />
                  {planLabel}
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="p-2">
              {menuItems.map((item) => (
                <motion.button
                  key={item.label}
                  whileTap={{ scale: 0.97 }}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                  style={{
                    color: item.highlight ? "#A78BFA" : "rgba(237,236,232,0.65)",
                    background: item.highlight ? "rgba(139,92,246,0.08)" : "transparent",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = item.highlight
                      ? "rgba(139,92,246,0.15)"
                      : "rgba(255,255,255,0.06)";
                    e.currentTarget.style.color = item.highlight ? "#C4B5FD" : "#EDECE8";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = item.highlight ? "rgba(139,92,246,0.08)" : "transparent";
                    e.currentTarget.style.color = item.highlight ? "#A78BFA" : "rgba(237,236,232,0.65)";
                  }}
                >
                  <item.icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                  {item.label}
                </motion.button>
              ))}
            </div>

            {/* Divider + Logout */}
            <div
              className="p-2 pt-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left mt-2"
                style={{ color: "rgba(239,68,68,0.6)" }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                  e.currentTarget.style.color = "#EF4444";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(239,68,68,0.6)";
                }}
              >
                <LogOut style={{ width: 15, height: 15, flexShrink: 0 }} />
                Déconnexion
              </motion.button>
            </div>
          </motion.div>

          {/* Logout confirm */}
          <AnimatePresence>
            {showLogoutConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLogoutConfirm(false)}
                className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
                aria-hidden="true"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="logout-confirm-title"
                  className="w-full max-w-sm rounded-2xl p-6"
                  style={{
                    background: "#141619",
                    border: "1px solid rgba(255,255,255,0.10)",
                    boxShadow: "0 32px 64px rgba(0,0,0,0.8)",
                  }}
                >
                  <h3
                    id="logout-confirm-title"
                    className="text-lg font-bold mb-1.5"
                    style={{ color: "#EDECE8" }}
                  >
                    Déconnexion
                  </h3>
                  <p className="text-sm mb-6" style={{ color: "rgba(237,236,232,0.5)" }}>
                    Êtes-vous sûr de vouloir vous déconnecter ?
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        color: "rgba(237,236,232,0.7)",
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        color: "#EF4444",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.25)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
                    >
                      Se déconnecter
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
