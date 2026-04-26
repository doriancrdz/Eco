"use client";

import { useState, useEffect } from "react";
import { Home, CreditCard, Settings, LogOut, X } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, useClerk } from "@clerk/nextjs";
import FolderList from "./FolderList";
import EcoHistory from "./EcoHistory";
import UserAvatar from "./UserAvatar";

interface SidebarProps {
  selectedFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
  selectedEco: string | null;
  onSelectEco: (ecoId: string | null) => void;
  onClose?: () => void;
  isOpen?: boolean;
  onNavigateHome?: (from?: "back" | "logo" | "sidebar") => void;
  onNavigatePricing?: () => void;
  onNavigateSettings?: () => void;
  onSignOut?: () => void;
  onOpenProfile?: () => void;
  userName?: string;
  userImageUrl?: string;
  refreshKey?: number;
}

const navItems = [
  { icon: Home, label: "Accueil", key: "home" },
  { icon: CreditCard, label: "Abonnement", key: "pricing" },
  { icon: Settings, label: "Paramètres", key: "settings" },
];

export default function Sidebar({
  selectedFolder,
  onSelectFolder,
  selectedEco,
  onSelectEco,
  onClose,
  isOpen = false,
  onNavigateHome,
  onNavigatePricing,
  onNavigateSettings,
  onSignOut,
  onOpenProfile,
  userName,
  userImageUrl,
  refreshKey = 0,
}: SidebarProps) {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [, setRefresh] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => setRefresh((r) => r + 1);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("eco-updated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("eco-updated", handleStorageChange);
    };
  }, []);

  const handleEcoClick = (eco: { id: string; folder: string }) => {
    onSelectEco(eco.id);
    onSelectFolder(eco.folder && eco.folder !== "" ? eco.folder : null);
    onClose?.();
  };

  useEffect(() => {
    if (isOpen && typeof window !== "undefined" && window.innerWidth < 1024) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={onClose}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        className="shrink-0 h-full flex flex-col fixed lg:static inset-y-0 left-0 z-40 lg:z-auto overflow-hidden"
        animate={{ width: isOpen ? 264 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="w-[264px] max-w-[85vw] h-full flex flex-col relative overflow-hidden"
          style={{
            minWidth: 264,
            background: "#0D0E14",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full min-w-[264px] min-h-0"
              >
                {/* Glow accent top */}
                <div
                  className="absolute top-0 left-0 w-48 h-48 pointer-events-none"
                  style={{
                    background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
                    transform: "translate(-30%, -30%)",
                  }}
                />

                {/* Mobile header */}
                {isSignedIn && (
                  <div className="lg:hidden flex-shrink-0 relative px-4 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <button
                      type="button"
                      onClick={onClose}
                      className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors z-10"
                      style={{ color: "rgba(237,236,232,0.4)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      aria-label="Fermer le menu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3">
                      <UserAvatar size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" style={{ color: "#EDECE8", fontSize: 14 }}>
                          {userName || "Utilisateur"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Logo */}
                <button
                  type="button"
                  onClick={() => {
                    onNavigateHome?.("logo");
                    onClose?.();
                  }}
                  className="w-full px-4 py-4 flex items-center gap-2.5 shrink-0 bg-transparent border-0 cursor-pointer hover:opacity-90 transition-opacity text-left focus:outline-none"
                  aria-label="Retour à l'accueil"
                >
                  <Image
                    src="/logo-eco.png"
                    alt=""
                    width={22}
                    height={22}
                    unoptimized
                    className="bg-transparent block object-contain pointer-events-none"
                  />
                  <span className="font-bold pointer-events-none" style={{ color: "#EDECE8", fontSize: 15, letterSpacing: "-0.02em" }}>ECO</span>
                </button>

                {/* Nav */}
                <div className="px-2 space-y-0.5 shrink-0">
                  {onNavigateHome && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { onNavigateHome("sidebar"); onClose?.(); }}
                      className="eco-nav-item"
                    >
                      <Home style={{ width: 16, height: 16, flexShrink: 0 }} />
                      Accueil
                    </motion.button>
                  )}
                  {onNavigatePricing && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { onNavigatePricing(); onClose?.(); }}
                      className="eco-nav-item"
                    >
                      <CreditCard style={{ width: 16, height: 16, flexShrink: 0 }} />
                      Abonnement
                    </motion.button>
                  )}
                  {isSignedIn && onNavigateSettings && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { onNavigateSettings(); onClose?.(); }}
                      className="eco-nav-item"
                    >
                      <Settings style={{ width: 16, height: 16, flexShrink: 0 }} />
                      Paramètres
                    </motion.button>
                  )}
                </div>

                {/* Divider */}
                <div className="mx-4 mt-3 mb-2" style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

                {/* Scrollable zone */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
                  <FolderList
                    onSelectEco={handleEcoClick}
                    onClose={onClose}
                    selectedEcoId={selectedEco}
                    expandFolderId={selectedFolder}
                  />
                  <EcoHistory
                    selectedEcoId={selectedEco}
                    onSelectEco={handleEcoClick}
                    onClose={onClose}
                    refreshKey={refreshKey}
                  />
                </div>

                {/* Bottom — desktop */}
                {isSignedIn && (
                  <div
                    className="hidden lg:flex flex-col shrink-0 pt-2 pb-3 px-2"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {onOpenProfile && (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { onOpenProfile(); onClose?.(); }}
                        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer"
                        style={{ color: "rgba(237,236,232,0.6)" }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                          e.currentTarget.style.color = "#EDECE8";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "rgba(237,236,232,0.6)";
                        }}
                      >
                        <UserAvatar size="sm" />
                        <span className="text-sm font-medium truncate flex-1">
                          {userName || "Utilisateur"}
                        </span>
                      </motion.button>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setShowLogoutConfirm(true)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer"
                      style={{ color: "rgba(237,236,232,0.4)" }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                        e.currentTarget.style.color = "rgba(239,68,68,0.8)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "rgba(237,236,232,0.4)";
                      }}
                    >
                      <LogOut style={{ width: 15, height: 15, flexShrink: 0 }} />
                      Déconnexion
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Logout confirm modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLogoutConfirm(false)}
            className="fixed inset-0 min-h-[100dvh] z-[100] flex items-center justify-center p-4"
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
              aria-labelledby="logout-confirm-title-sidebar"
              className="w-full max-w-sm rounded-2xl p-6"
              style={{
                background: "#141619",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 32px 64px rgba(0,0,0,0.6)",
              }}
            >
              <h3
                id="logout-confirm-title-sidebar"
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
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
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
                  onClick={async () => {
                    await signOut({ redirectUrl: "/sign-in" });
                    onClose?.();
                  }}
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
    </>
  );
}
