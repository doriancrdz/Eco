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
          <p className="text-[#8b8884]">© 2026 ECO · Tous droits réservés</p>
          <div className="flex gap-6">
            <Link href="/blog" className="text-[#8b8884] hover:text-white transition-colors">Blog</Link>
            <Link href="/legal/cgu" className="text-[#8b8884] hover:text-white transition-colors">CGU</Link>
            <Link href="/legal/cgv" className="text-[#8b8884] hover:text-white transition-colors">CGV</Link>
            <Link href="/legal/confidentialite" className="text-[#8b8884] hover:text-white transition-colors">Confidentialité</Link>
            <Link href="/legal/mentions-legales" className="text-[#8b8884] hover:text-white transition-colors">Mentions légales</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
