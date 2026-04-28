"use client";

import { PanelLeft, Share2, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import PlanBadge from "./PlanBadge";
import GuideDropdown from "./GuideDropdown";
import UserAvatar from "./UserAvatar";

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
    <header className="h-[60px] px-4 flex items-center justify-between relative sticky top-0 z-20"
      style={{
        background: "rgba(8, 10, 15, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-1 min-w-[44px] shrink-0">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onGoHome("logo")}
          className="p-0 bg-transparent border-0 rounded-none transition-opacity shrink-0 cursor-pointer focus:outline-none lg:hidden"
          aria-label="Retour à l'accueil"
        >
          <Image
            src="/logo-eco-v2.png"
            alt=""
            width={36}
            height={36}
            unoptimized
            className="bg-transparent block h-9 w-9 object-contain select-none pointer-events-none"
          />
        </motion.button>

        {onToggleSidebar && (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onToggleSidebar}
            className="p-2 rounded-lg transition-all cursor-pointer focus:outline-none"
            style={{ color: "rgba(237,236,232,0.5)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            aria-label="Ouvrir / fermer le menu"
          >
            <PanelLeft className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
          </motion.button>
        )}

        <GuideDropdown />

        {isDetailView && (
          <>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onGoHome("back")}
              className="p-2 rounded-lg transition-all shrink-0 focus:outline-none"
              style={{ color: "rgba(237,236,232,0.5)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              aria-label="Retour"
            >
              <ArrowLeft style={{ width: 18, height: 18 }} />
            </motion.button>
            {onShare && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onShare}
                className="p-2 rounded-lg transition-all focus:outline-none"
                style={{ color: "rgba(237,236,232,0.5)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                aria-label="Partager"
              >
                <Share2 style={{ width: 18, height: 18 }} />
              </motion.button>
            )}
          </>
        )}
      </div>

      {/* Center */}
      <button
        type="button"
        onClick={() => onGoHome("logo")}
        className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-2 bg-transparent p-0 border-0 z-[25] cursor-pointer focus:outline-none min-w-[100px] justify-center"
        aria-label="Retour à l'accueil"
      >
        <Image
          src="/logo-eco-v2.png"
          alt=""
          width={28}
          height={28}
          unoptimized
          className="w-7 h-7 bg-transparent block object-contain select-none pointer-events-none lg:hidden"
        />
        <span className="text-base font-bold pointer-events-none" style={{ color: "#EDECE8", letterSpacing: "-0.02em" }}>ECO</span>
      </button>

      {/* Right */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        {isSignedIn && <PlanBadge />}
        {isSignedIn && onAvatarClick ? (
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={onAvatarClick}
            className="shrink-0 focus:outline-none rounded-full"
            style={{ boxShadow: "0 0 0 2px rgba(139,92,246,0.0)" }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(139,92,246,0.5)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(139,92,246,0)")}
            aria-label="Profil utilisateur"
          >
            <UserAvatar size="md" />
          </motion.button>
        ) : !isSignedIn ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/sign-in")}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)",
              color: "white",
            }}
          >
            Connexion
          </motion.button>
        ) : null}
      </div>
    </header>
  );
}
