"use client";

import { useState, useEffect } from "react";
import { Home, CreditCard, Settings, LogOut } from "lucide-react";
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
    // Normaliser : folder vide => null (unfiled)
    onSelectFolder(eco.folder && eco.folder !== "" ? eco.folder : null);
    onClose?.();
  };

  return (
    <>
      {/* Mobile/Tablet overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
            onClick={onClose}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Sidebar: largeur animée 0 | 280 */}
      <motion.div
        className="shrink-0 h-full flex flex-col fixed lg:static inset-y-0 left-0 z-40 lg:z-auto overflow-hidden"
        animate={{ width: isOpen ? 280 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="w-[280px] h-full flex flex-col bg-white/10 backdrop-blur-xl border-r border-white/20"
          style={{ minWidth: 280 }}
        >
          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full min-w-[280px]"
              >
                {/* Logo ECO -> Accueil (même action que flèche retour) */}
                <button
                  type="button"
                  onClick={() => {
                    if (process.env.NODE_ENV !== "production") console.log("[NAV] logo click -> goHome", { location: "sidebar" });
                    onNavigateHome?.("logo");
                    onClose?.();
                  }}
                  className="w-full px-4 py-4 flex items-center gap-2 shrink-0 bg-transparent border-0 cursor-pointer hover:opacity-90 transition-opacity text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 focus-visible:ring-inset"
                  aria-label="Retour à l'accueil"
                >
                  <div className="w-5 h-5 relative shrink-0 bg-transparent border-0 pointer-events-none">
                    <Image src="/logo-eco.png" alt="" width={20} height={20} className="bg-transparent block object-contain pointer-events-none" />
                  </div>
                  <span className="font-bold text-gray-900 pointer-events-none">ECO</span>
                </button>

                {/* Nav */}
                <div className="px-2 py-2 space-y-0.5">
                  {onNavigateHome && (
                    <motion.button
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { onNavigateHome("sidebar"); onClose?.(); }}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/20 transition-all cursor-pointer"
                    >
                      <Home className="w-4 h-4 shrink-0" />
                      Accueil
                    </motion.button>
                  )}
                  {onNavigatePricing && (
                    <motion.button
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { onNavigatePricing(); onClose?.(); }}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/20 transition-all cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4 shrink-0" />
                      Abonnement
                    </motion.button>
                  )}
                  {/* Paramètres seulement si connecté */}
                  {isSignedIn && onNavigateSettings && (
                    <motion.button
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { onNavigateSettings(); onClose?.(); }}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/20 transition-all cursor-pointer"
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      Paramètres
                    </motion.button>
                  )}
                </div>

                <FolderList
                  onSelectEco={handleEcoClick}
                  onClose={onClose}
                  selectedEcoId={selectedEco}
                  expandFolderId={selectedFolder}
                />

                <div className="flex-1 min-h-0 flex flex-col">
                  <EcoHistory
                    selectedEcoId={selectedEco}
                    onSelectEco={handleEcoClick}
                    onClose={onClose}
                    refreshKey={refreshKey}
                  />
                </div>

                {/* Bottom: avatar, name, Déconnexion (seulement si connecté) */}
                {isSignedIn && (
                  <div className="border-t border-white/20 mt-auto pt-4 pb-4 shrink-0">
                    {onOpenProfile && (
                      <motion.button
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { onOpenProfile(); onClose?.(); }}
                        className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-700 hover:bg-white/20 transition-all cursor-pointer mb-2"
                      >
                        <UserAvatar size="sm" />
                        <span className="text-sm font-medium text-gray-800 truncate flex-1">
                          {userName || "Utilisateur"}
                        </span>
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowLogoutConfirm(true)}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/20 transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      Déconnexion
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 z-[101] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 px-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-confirm-title-sidebar"
            >
              <div className="bg-white rounded-3xl p-8 shadow-2xl border border-white/40">
                <h3 id="logout-confirm-title-sidebar" className="text-xl font-bold text-gray-900 mb-4">
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
                    onClick={async () => {
                      await signOut({ redirectUrl: '/sign-in' });
                      onClose?.();
                    }}
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
    </>
  );
}
