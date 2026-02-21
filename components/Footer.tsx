import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-200 bg-white/50 backdrop-blur-sm mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <p>© 2026 ECO · Tous droits réservés</p>
          <div className="flex gap-6">
            <Link href="/legal/cgu" className="hover:text-gray-900 transition-colors">
              CGU
            </Link>
            <Link href="/legal/cgv" className="hover:text-gray-900 transition-colors">
              CGV
            </Link>
            <Link href="/legal/confidentialite" className="hover:text-gray-900 transition-colors">
              Confidentialité
            </Link>
            <Link href="/legal/mentions-legales" className="hover:text-gray-900 transition-colors">
              Mentions légales
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
