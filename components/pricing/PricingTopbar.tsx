"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function PricingTopbar() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  return (
    <div className="sticky top-0 z-50 backdrop-blur-md bg-white/60 border-b border-white/40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between relative">
        {/* Bouton retour - tout à gauche */}
        <Link href="/" className="flex items-center gap-2 group transition-transform duration-200 hover:-translate-x-0.5">
          <div className="flex items-center gap-2">
            <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-colors" />
            <span className="font-medium text-gray-700 group-hover:text-gray-900 transition-colors">ECO</span>
          </div>
        </Link>

        {/* Logo + ECO centré - position absolue */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <Image
            src="/logo-eco.png"
            alt="ECO"
            width={32}
            height={32}
            className="w-8 h-8"
            priority
            quality={90}
          />
          <span className="text-lg font-bold text-gray-900">ECO</span>
        </div>

        {/* Bouton connexion si non connecté - à droite */}
        {!isSignedIn ? (
          <button
            onClick={() => router.push("/sign-in?redirect_url=/pricing")}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Se connecter
          </button>
        ) : (
          <div className="w-20" />
        )}
      </div>
    </div>
  );
}
