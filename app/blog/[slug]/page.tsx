import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Clock, ChevronRight } from "lucide-react";
import { articles, getArticleBySlug, formatDate } from "@/lib/blog/articles";
import BlogContent from "./BlogContent";

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getArticleBySlug(params.slug);
  if (!article) return {};
  return {
    title: `${article.title} — Blog ECO`,
    description: article.description,
    alternates: { canonical: `https://econewapp.com/blog/${article.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `https://econewapp.com/blog/${article.slug}`,
      type: "article",
      publishedTime: article.date,
      siteName: "ECO",
    },
  };
}

export default function ArticlePage({ params }: Props) {
  const article = getArticleBySlug(params.slug);
  if (!article) notFound();

  return (
    <div className="min-h-screen" style={{ background: "#080A0F" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 border-b border-white/8 backdrop-blur-xl"
        style={{ background: "rgba(8,10,15,0.90)" }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-eco-v2.png" alt="ECO" width={24} height={24} className="rounded-md" />
            <span className="font-bold text-[#EDECE8] text-base">ECO</span>
          </Link>
          <Link
            href="/blog"
            className="flex items-center gap-1.5 text-sm text-[#8b8884] hover:text-[#EDECE8] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Blog
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-24">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#8b8884] mb-8">
          <Link href="/blog" className="hover:text-[#EDECE8] transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-[#EDECE8] truncate max-w-[240px]">{article.title}</span>
        </nav>

        {/* Article header */}
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#EDECE8] leading-tight tracking-tight mb-5">
            {article.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-[#8b8884]">
            <time dateTime={article.date}>{formatDate(article.date)}</time>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {article.readTime} de lecture
            </span>
          </div>
        </header>

        {/* Divider */}
        <div className="mb-10 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Article content */}
        <article>
          <BlogContent content={article.content} />
        </article>

        {/* Divider */}
        <div className="mt-12 mb-10 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* CTA */}
        <div
          className="rounded-2xl border border-white/10 p-8 text-center"
          style={{ background: "#141619" }}
        >
          <div className="w-10 h-10 rounded-xl mb-4 mx-auto flex items-center justify-center"
            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.2)" }}
          >
            <Image src="/logo-eco-v2.png" alt="" width={22} height={22} />
          </div>
          <h2 className="text-lg font-bold text-[#EDECE8] mb-2">
            Essaie ECO gratuitement
          </h2>
          <p className="text-sm text-[#8b8884] mb-6 max-w-sm mx-auto">
            Enregistre ton prochain cours et reçois automatiquement le résumé, les points clés et le quiz. Sans carte bancaire.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-teal-500 text-white text-sm font-semibold hover:from-violet-400 hover:to-teal-400 transition-all shadow-lg shadow-violet-500/20 hover:-translate-y-0.5"
          >
            Commencer gratuitement
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
