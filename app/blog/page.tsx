import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Clock, ArrowRight } from "lucide-react";
import { articles, formatDate } from "@/lib/blog/articles";

export const metadata: Metadata = {
  title: "Blog — ECO | Conseils pour mieux réviser",
  description: "Conseils, méthodes et guides pour mieux enregistrer tes cours et réviser plus efficacement grâce à l'IA.",
  alternates: { canonical: "https://econewapp.com/blog" },
  robots: { index: true, follow: true },
};

export default function BlogPage() {
  return (
    <div className="min-h-screen" style={{ background: "#080A0F" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 border-b border-white/8 backdrop-blur-xl"
        style={{ background: "rgba(8,10,15,0.90)" }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-eco-v2.png" alt="ECO" width={24} height={24} className="rounded-md" />
            <span className="font-bold text-[#EDECE8] text-base">ECO</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-[#8b8884] hover:text-[#EDECE8] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Accueil
          </Link>
        </div>
      </nav>

      {/* Header */}
      <header className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-400 mb-3">Blog</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#EDECE8] mb-4 tracking-tight">
          Blog ECO
        </h1>
        <p className="text-lg text-[#8b8884] max-w-xl">
          Conseils pour mieux réviser et tirer le meilleur de tes cours.
        </p>
      </header>

      {/* Articles grid */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
        {articles.length === 0 ? (
          <p className="text-[#8b8884]">Aucun article pour l&apos;instant.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="group block rounded-2xl border border-white/10 p-6 transition-all hover:border-white/20 hover:-translate-y-0.5"
                style={{ background: "#141619" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="text-xs px-2.5 py-1 rounded-full border border-white/10 font-medium"
                    style={{ background: "rgba(255,255,255,0.04)", color: "#8b8884" }}
                  >
                    Guide
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#8b8884]">
                    <Clock className="w-3 h-3" />
                    {article.readTime}
                  </span>
                </div>

                <h2 className="text-base font-semibold text-[#EDECE8] leading-snug mb-2 group-hover:text-white transition-colors">
                  {article.title}
                </h2>
                <p className="text-sm text-[#8b8884] leading-relaxed mb-5 line-clamp-3">
                  {article.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8b8884]">{formatDate(article.date)}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-teal-400 group-hover:text-teal-300 transition-colors">
                    Lire <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
