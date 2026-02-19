"use client";

import { PanelLeft, Share2, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import PlanBadge from "./PlanBadge";

interface HeaderProps {
  onGoHome: (from?: "back" | "logo" | "sidebar") => void;
  onToggleSidebar?: () => void;
  isDetailView?: boolean;
  onShare?: () => void;
  onAvatarClick?: () => void;
  userImageUrl?: string;
  userName?: string;
}

export default function Header({
  onGoHome,
  onToggleSidebar,
  isDetailView,
  onShare,
  onAvatarClick,
  userImageUrl,
  userName,
}: HeaderProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  return (
    <header className="h-[72px] px-4 flex items-center justify-between relative bg-white/10 backdrop-blur-sm border-b border-white/10 sticky top-0 z-20">
      {/* Left: logo ECO seul (sans texte) + toggle */}
      <div className="flex items-center gap-2 min-w-[44px] shrink-0">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (process.env.NODE_ENV !== "production") console.log("[NAV] logo click -> goHome", { location: "header-left" });
            onGoHome("logo");
          }}
          className="p-0 bg-transparent border-0 rounded-none hover:opacity-90 transition-opacity shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 focus-visible:ring-offset-2"
          aria-label="Retour à l'accueil"
        >
          <Image src="/logo-eco.png" alt="" width={40} height={40} className="bg-transparent block h-10 w-10 object-contain select-none pointer-events-none" />
        </motion.button>
        {onToggleSidebar && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggleSidebar}
            className="p-2 rounded-xl hover:bg-white/20 transition-all"
            aria-label="Ouvrir / fermer le menu"
          >
            <PanelLeft className="w-5 h-5 text-gray-800" />
          </motion.button>
        )}
        {isDetailView && (
          <>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onGoHome("back")}
              className="p-2 rounded-xl hover:bg-white/20 transition-colors shrink-0"
              aria-label="Retour"
            >
              <ArrowLeft className="w-5 h-5 text-gray-800" />
            </motion.button>
            {onShare && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onShare}
                className="p-2 rounded-xl hover:bg-white/20 transition-colors"
                aria-label="Partager"
              >
                <Share2 className="w-5 h-5 text-gray-800" />
              </motion.button>
            )}
          </>
        )}
      </div>

      {/* Center: logo h-9 w-9 + texte ECO, cliquable comme la flèche retour */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          if (process.env.NODE_ENV !== "production") console.log("[NAV] logo click -> goHome", { location: "header-center" });
          onGoHome("logo");
        }}
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-transparent p-0 border-0 z-[25] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 focus-visible:ring-offset-2 min-w-[100px] justify-center"
        aria-label="Retour à l'accueil"
      >
        <Image src="/logo-eco.png" alt="" width={36} height={36} className="bg-transparent block h-9 w-9 object-contain select-none pointer-events-none" />
        <span className="font-bold text-gray-900 text-lg pointer-events-none">ECO</span>
      </motion.button>

      {/* Right: PlanBadge + avatar ou bouton Connexion */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        {isSignedIn && <PlanBadge />}
        {isSignedIn && onAvatarClick ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAvatarClick}
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/30 shadow-md shrink-0 flex items-center justify-center bg-gradient-to-br from-aura-emerald to-aura-blue"
            aria-label="Profil utilisateur"
          >
            {userImageUrl ? (
              <img
                src={userImageUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-gray-800">
                {userName?.charAt(0) || "?"}
              </span>
            )}
          </motion.button>
        ) : !isSignedIn ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/sign-in")}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors shadow-md"
          >
            Connexion
          </motion.button>
        ) : null}
      </div>
    </header>
  );
}
