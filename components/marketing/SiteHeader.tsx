"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import BrandMark from "./BrandMark";
import SpotlightTracker from "./SpotlightTracker";

const LINKS = [
  { label: "Produit", href: "/#produit" },
  { label: "Alternants", href: "/#alternants" },
  { label: "Comment ça marche", href: "/#comment" },
  { label: "Tarifs", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
];

export default function SiteHeader() {
  // Tant que Clerk n'a pas chargé, on affiche la version visiteur : c'est le cas de 99 % du trafic marketing.
  const { isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
    <SpotlightTracker />
    <header
      className="fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300"
      style={{
        background: scrolled || open ? "rgba(9,9,11,0.82)" : "transparent",
        borderBottom: `1px solid ${scrolled || open ? "var(--mk-line)" : "transparent"}`,
        backdropFilter: scrolled || open ? "saturate(140%) blur(14px)" : "none",
        WebkitBackdropFilter: scrolled || open ? "saturate(140%) blur(14px)" : "none",
      }}
    >
      <div className="mx-auto flex h-16 max-w-[76rem] items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="ECO — accueil" onClick={() => setOpen(false)}>
          <BrandMark />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navigation principale">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[14px] transition-colors hover:text-[var(--mk-text)]"
              style={{ color: "var(--mk-muted)" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {!isSignedIn ? (
            <>
            <Link
              href="/sign-in"
              className="px-3 text-[14px] transition-colors hover:text-[var(--mk-text)]"
              style={{ color: "var(--mk-muted)" }}
            >
              Se connecter
            </Link>
            <Link href="/sign-up" className="mk-btn mk-btn-primary !h-9 !px-4 !text-[14px]">
              Commencer gratuitement
            </Link>
            </>
          ) : (
            <Link href="/app" className="mk-btn mk-btn-primary !h-9 !px-4 !text-[14px]">
              Ouvrir l&apos;app
            </Link>
          )}
        </div>

        <button
          type="button"
          className="-mr-2 rounded-full p-2 md:hidden"
          style={{ color: "var(--mk-text)" }}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="h-[calc(100dvh-4rem)] px-5 pb-8 pt-4 md:hidden" style={{ background: "var(--mk-bg)" }}>
          <nav className="flex flex-col" aria-label="Navigation mobile">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b py-4 text-[17px]"
                style={{ borderColor: "var(--mk-line)", color: "var(--mk-text)" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 flex flex-col gap-3">
            {!isSignedIn ? (
              <>
              <Link href="/sign-up" onClick={() => setOpen(false)} className="mk-btn mk-btn-primary w-full">
                Commencer gratuitement
              </Link>
              <Link href="/sign-in" onClick={() => setOpen(false)} className="mk-btn mk-btn-ghost w-full">
                Se connecter
              </Link>
              </>
            ) : (
              <Link href="/app" onClick={() => setOpen(false)} className="mk-btn mk-btn-primary w-full">
                Ouvrir l&apos;app
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
    </>
  );
}
