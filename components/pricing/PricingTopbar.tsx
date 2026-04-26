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
    <div
      className="sticky top-0 z-50"
      style={{
        background: "rgba(8,10,15,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between relative">
        <Link
          href="/"
          className="flex items-center gap-2 group transition-colors"
          style={{ color: "rgba(237,236,232,0.45)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(237,236,232,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(237,236,232,0.45)")}
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-medium text-sm">ECO</span>
        </Link>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <Image
            src="/logo-eco.png"
            alt="ECO"
            width={28}
            height={28}
            className="w-7 h-7"
            priority
            quality={90}
          />
          <span className="text-base font-bold" style={{ color: "#EDECE8", letterSpacing: "-0.02em" }}>ECO</span>
        </div>

        {!isSignedIn ? (
          <button
            onClick={() => router.push("/sign-in?redirect_url=/pricing")}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)", color: "white" }}
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
