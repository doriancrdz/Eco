import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import BrandMark from "./BrandMark";

const POINTS = [
  "Résumé structuré, notions et quiz après chaque cours",
  "Flashcards prêtes à réviser, export Anki inclus",
  "10 minutes offertes, sans carte bancaire",
];

export default function AuthShell({ children, mode }: { children: React.ReactNode; mode: "sign-in" | "sign-up" }) {
  return (
    <div className="mk grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r lg:flex lg:flex-col lg:justify-between lg:p-12" style={{ borderColor: "var(--mk-line)" }}>
        <div aria-hidden className="pointer-events-none absolute -left-40 top-1/3 h-[620px] w-[620px] opacity-25 blur-[90px]">
          <Image src="/logo-eco-v2.png" alt="" fill sizes="620px" className="object-contain" />
        </div>
        <div className="mk-grain" aria-hidden />
        <Link href="/" className="relative" aria-label="ECO — accueil">
          <BrandMark />
        </Link>
        <div className="relative max-w-md">
          <h1 className="mk-display text-[52px]">
            {mode === "sign-up" ? (
              <>
                Ton prochain cours,
                <br />
                <span className="italic mk-iris">déjà révisé.</span>
              </>
            ) : (
              <>
                Content de
                <br />
                <span className="italic mk-iris">te revoir.</span>
              </>
            )}
          </h1>
          <ul className="mt-10 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px]" style={{ color: "#C9C6C0" }}>
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--mk-lilac)" }} />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[13px]" style={{ color: "var(--mk-faint)" }}>
          En continuant, tu acceptes nos{" "}
          <Link href="/legal/cgu" className="underline underline-offset-4 hover:text-[var(--mk-text)]">
            CGU
          </Link>{" "}
          et notre{" "}
          <Link href="/legal/confidentialite" className="underline underline-offset-4 hover:text-[var(--mk-text)]">
            politique de confidentialité
          </Link>
          .
        </p>
      </aside>
      <main className="flex flex-col items-center justify-center px-5 py-12">
        <Link href="/" className="mb-10 lg:hidden" aria-label="ECO — accueil">
          <BrandMark />
        </Link>
        {children}
      </main>
    </div>
  );
}
