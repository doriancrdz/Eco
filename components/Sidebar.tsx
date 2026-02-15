"use client";

import { useState, useEffect } from "react";
import { getEcos } from "@/lib/storage";
import { Mic, Home, Library, CreditCard, Settings, LogOut, User } from "lucide-react";
import { motion } from "framer-motion";

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
}: SidebarProps) {
  const [, setRefresh] = useState(0);

  const loadData = () => {
    setRefresh((r) => r + 1);
  };

  const hasAnyEco = () => {
    const allEcos = getEcos();
    return allEcos.length > 0;
  };

  useEffect(() => {
    loadData();

    // Écouter les changements de stockage
    const handleStorageChange = () => {
      loadData();
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Écouter un événement personnalisé pour les changements dans le même onglet
    window.addEventListener("eco-updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("eco-updated", handleStorageChange);
    };
  }, []);

  return (
    <>
      {/* Mobile/Tablet overlay */}
      {(isOpen || false) && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      {/* Sidebar: fixe sur desktop (lg), drawer sur mobile/tablet */}
      <div
        className={`
          w-[280px] shrink-0 glass-panel rounded-r-3xl mr-6 h-full flex flex-col shadow-glass
          fixed lg:static inset-y-0 left-0 z-40 lg:z-auto
          transform transition-transform duration-300 ease-out
          ${!isOpen ? "-translate-x-full lg:translate-x-0" : "translate-x-0"}
        `}
      >
      <div className="p-6 border-b border-white/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#99f6e4] via-[#7dd3fc] to-[#a5b4fc] flex items-center justify-center shrink-0">
            <Mic className="w-3 h-3 text-gray-800" />
          </div>
          <span className="text-xl font-bold text-gray-800 tracking-tight">ECO</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {onNavigateHome && (
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { onNavigateHome(); onClose?.(); }}
            className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 text-gray-600 hover:bg-white/25 hover:text-gray-800 transition-all"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span className="font-medium">Accueil</span>
          </motion.button>
        )}
        <motion.button
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { onSelectFolder(null); onSelectEco(null); onClose?.(); }}
          className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 text-gray-600 hover:bg-white/25 hover:text-gray-800 transition-all"
        >
          <Library className="w-4 h-4 shrink-0" />
          <span className="font-medium">Bibliothèque</span>
        </motion.button>
        {onNavigatePricing && (
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { onNavigatePricing(); onClose?.(); }}
            className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 text-gray-600 hover:bg-white/25 hover:text-gray-800 transition-all"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span className="font-medium">Abonnement</span>
          </motion.button>
        )}
        {onOpenProfile && (
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { onOpenProfile(); onClose?.(); }}
            className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 text-gray-600 hover:bg-white/25 hover:text-gray-800 transition-all"
          >
            <User className="w-4 h-4 shrink-0" />
            <span className="font-medium">Profil</span>
          </motion.button>
        )}
        {onNavigateSettings && (
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { onNavigateSettings(); onClose?.(); }}
            className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 text-gray-600 hover:bg-white/25 hover:text-gray-800 transition-all"
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className="font-medium">Paramètres</span>
          </motion.button>
        )}
        <div className="pt-4 border-t border-white/10 mt-4">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 px-4 mb-2">Derniers ECOs</p>
          {getEcos()
            .slice(0, 5)
            .map((eco) => (
              <motion.button
                key={eco.id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onSelectEco(eco.id);
                  onSelectFolder(eco.folder);
                  onClose?.();
                }}
                className={`w-full text-left px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all ${
                  selectedEco === eco.id
                    ? "bg-gradient-to-r from-gray-800 to-gray-700 text-white shadow-lg"
                    : "text-gray-600 hover:bg-white/25 hover:text-gray-800"
                }`}
              >
                <Mic className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate flex-1">{eco.title}</span>
              </motion.button>
            ))}
          {!hasAnyEco() && (
            <p className="px-4 py-2 text-gray-500 text-sm">Aucun Eco</p>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 p-4 mt-auto shrink-0 flex flex-col gap-2">
          {userName && (
            <div className="flex items-center gap-3 px-4 py-2">
              {userImageUrl ? (
                <img src={userImageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-aura-emerald to-aura-blue flex items-center justify-center text-sm font-bold text-gray-800">
                  {userName.charAt(0)}
                </div>
              )}
              <span className="text-sm font-medium text-gray-800 truncate">{userName}</span>
            </div>
          )}
          {onSignOut && (
            <motion.button
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { onSignOut(); onClose?.(); }}
              className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 text-gray-600 hover:bg-white/25 hover:text-gray-800 transition-all"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="font-medium">Déconnexion</span>
            </motion.button>
          )}
        </div>
      </div>
    </>
  );
}
