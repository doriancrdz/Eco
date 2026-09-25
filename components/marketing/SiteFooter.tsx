import Link from "next/link";
import BrandMark from "./BrandMark";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/#produit" },
      { label: "Tarifs", href: "/pricing" },
      { label: "Blog", href: "/blog" },
      { label: "Créer un compte", href: "/sign-up" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "CGU", href: "/legal/cgu" },
      { label: "CGV", href: "/legal/cgv" },
      { label: "Confidentialité", href: "/legal/confidentialite" },
      { label: "Mentions légales", href: "/legal/mentions-legales" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="mk relative border-t" style={{ borderColor: "var(--mk-line)" }}>
      <div className="mx-auto grid max-w-[76rem] gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <BrandMark />
          <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
            Enregistre tes cours. Révise avec des fiches, des notions et des quiz générés à partir de ce que ton prof a vraiment dit.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-[13px] font-medium" style={{ color: "var(--mk-text)" }}>
              {col.title}
            </p>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[14px] transition-colors hover:text-[var(--mk-text)]"
                    style={{ color: "var(--mk-muted)" }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="text-[13px] font-medium" style={{ color: "var(--mk-text)" }}>
            Contact
          </p>
          <ul className="mt-4 space-y-3">
            <li>
              <a
                href="mailto:support@econewapp.com"
                className="text-[14px] transition-colors hover:text-[var(--mk-text)]"
                style={{ color: "var(--mk-muted)" }}
              >
                support@econewapp.com
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t" style={{ borderColor: "var(--mk-line)" }}>
        <div className="mx-auto flex max-w-[76rem] flex-col gap-2 px-5 py-6 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:px-8" style={{ color: "var(--mk-faint)" }}>
          <p>© {new Date().getFullYear()} ECO. Tous droits réservés.</p>
          <p>Paiement sécurisé par Stripe</p>
        </div>
      </div>
    </footer>
  );
}
