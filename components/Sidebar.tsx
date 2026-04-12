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

  // Bloquer le scroll du body quand la sidebar est ouverte (mobile/tablet uniquement)
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
          className="w-[280px] max-w-[85vw] h-full flex flex-col bg-white dark:bg-[#1A1D2E] lg:bg-white/10 dark:lg:bg-[#1A1D2E]/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700/50 lg:border-white/20 relative"
          style={{ minWidth: 280 }}
        >
          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full min-w-[280px] min-h-0"
              >
                {/* HEADER MOBILE : Profil + Déconnexion en haut (mobile uniquement) */}
                {isSignedIn && (
                  <div className="lg:hidden flex-shrink-0 relative p-6 pb-4 border-b border-gray-200 bg-gradient-to-br from-aura-emerald/20 via-aura-blue/20 to-aura-sand/20">
                    <button
                      type="button"
                      onClick={onClose}
                      className="absolute top-4 right-4 p-2 rounded-lg text-gray-600 hover:bg-white/50 transition-colors z-10"
                      aria-label="Fermer le menu"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 mb-4">
                      <UserAvatar size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">
                          {userName || "Utilisateur"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-xl border border-gray-200 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Se déconnecter
                    </button>
                  </div>
                )}

                {/* Bouton fermer desktop (si pas de header mobile) */}
                {onClose && !isSignedIn && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="lg:hidden absolute top-4 right-4 p-2 rounded-lg text-gray-600 hover:bg-white/20 transition-colors z-10"
                    aria-label="Fermer le menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}

                {/* Logo ECO -> Accueil */}
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
                    <Image src="/logo-eco.png" alt="" width={20} height={20} unoptimized className="bg-transparent block object-contain pointer-events-none" />
                  </div>
                  <span className="font-bold text-gray-900 pointer-events-none">ECO</span>
                </button>

                {/* Nav */}
                <div className="px-2 py-2 space-y-0.5 shrink-0">
                  {onNavigateHome && (
                    <motion.button
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { onNavigateHome("sidebar"); onClose?.(); }}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 lg:hover:bg-white/20 transition-all cursor-pointer"
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
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 lg:hover:bg-white/20 transition-all cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4 shrink-0" />
                      Abonnement
                    </motion.button>
                  )}
                  {isSignedIn && onNavigateSettings && (
                    <motion.button
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { onNavigateSettings(); onClose?.(); }}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 lg:hover:bg-white/20 transition-all cursor-pointer"
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      Paramètres
                    </motion.button>
                  )}
                </div>

                {/* Zone scrollable : dossiers + ECOs */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
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

                {/* Bottom: avatar, name, Déconnexion (desktop uniquement) */}
                {isSignedIn && (
                  <div className="hidden lg:flex flex-col border-t border-white/20 pt-4 pb-4 shrink-0">
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

      {/* Modale de confirmation de déconnexion — responsive mobile */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLogoutConfirm(false)}
            className="fixed inset-0 min-h-[100dvh] bg-black/50 z-[100] flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
            aria-hidden="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-confirm-title-sidebar"
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <h3 id="logout-confirm-title-sidebar" className="text-xl font-bold text-gray-900 mb-2">
                Déconnexion
              </h3>
              <p className="text-gray-600 mb-6">
                Êtes-vous sûr de vouloir vous déconnecter ?
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-6 py-3 min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut({ redirectUrl: "/sign-in" });
                    onClose?.();
                  }}
                  className="flex-1 px-6 py-3 min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
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
