import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="w-full mt-16"
      style={{
        background: "#080A0F",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <p style={{ color: "#8b8884" }}>© 2026 ECO · Tous droits réservés</p>
          <div className="flex gap-6">
            {[
              { href: "/legal/cgu", label: "CGU" },
              { href: "/legal/cgv", label: "CGV" },
              { href: "/legal/confidentialite", label: "Confidentialité" },
              { href: "/legal/mentions-legales", label: "Mentions légales" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="transition-colors"
                style={{ color: "#8b8884" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#EDECE8")}
                onMouseLeave={e => (e.currentTarget.style.color = "#8b8884")}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
