"use client";

import { useState, useEffect } from "react";
import { Home, CreditCard, Settings, LogOut } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import FolderList from "./FolderList";
import EcoHistory from "./EcoHistory";

interface SidebarProps {
  selectedFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
  selectedEco: string | null;
  onSelectEco: (ecoId: string | null) => void;
  onClose?: () => void;
  isOpen?: boolean;
  onNavigateHome?: () => void;
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
  const [, setRefresh] = useState(0);

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
                {/* Logo ECO */}
                <div className="px-4 py-4 flex items-center gap-2 shrink-0 bg-transparent">
                  <div className="w-5 h-5 relative shrink-0 bg-transparent border-0">
                    <Image src="/logo-eco.png" alt="" width={20} height={20} className="bg-transparent block object-contain" />
                  </div>
                  <span className="font-bold text-gray-900">ECO</span>
                </div>

                {/* Nav */}
                <div className="px-2 py-2 space-y-0.5">
                  {onNavigateHome && (
                    <motion.button
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { onNavigateHome(); onClose?.(); }}
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
                  {onNavigateSettings && (
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

                {/* Bottom: avatar, name, Déconnexion */}
                <div className="border-t border-white/20 mt-auto pt-4 pb-4 shrink-0">
                  {onOpenProfile && (
                    <motion.button
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { onOpenProfile(); onClose?.(); }}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-700 hover:bg-white/20 transition-all cursor-pointer mb-2"
                    >
                      {userImageUrl ? (
                        <img
                          src={userImageUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-aura-emerald to-aura-blue flex items-center justify-center text-sm font-bold text-gray-800 shrink-0">
                          {userName?.charAt(0) || "?"}
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-800 truncate flex-1">
                        {userName || "Utilisateur"}
                      </span>
                    </motion.button>
                  )}
                  {onSignOut && (
                    <motion.button
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { onSignOut(); onClose?.(); }}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/20 transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      Déconnexion
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
