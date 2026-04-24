"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, Mic, Sparkles, BookOpen, FileText, CheckCircle, Star, Menu, X } from "lucide-react";

/* ─── Animations CSS injectées une fois ─── */
const ANIM_STYLES = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.anim-fade-up   { animation: fadeUp 0.6s ease both; }
.anim-fade-in   { animation: fadeIn 0.4s ease both; }
.delay-1 { animation-delay: 0.1s; }
.delay-2 { animation-delay: 0.2s; }
.delay-3 { animation-delay: 0.3s; }
.delay-4 { animation-delay: 0.4s; }
.delay-5 { animation-delay: 0.5s; }
.delay-6 { animation-delay: 0.6s; }
.delay-7 { animation-delay: 0.7s; }
.card-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
.card-hover:hover { transform: translateY(-4px); box-shadow: 0 24px 48px rgba(0,0,0,0.12); }
`;

/* ─── Nav ─── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Comment ça marche", href: "#how" },
    { label: "Fonctionnalités", href: "#features" },
    { label: "Tarifs", href: "/pricing" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/85 backdrop-blur-xl border-b border-gray-200/60 shadow-sm"
          : "bg-white/60 backdrop-blur-md border-b border-white/30"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-2 shrink-0">
            <Image src="/logo-eco.png" alt="ECO" width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-gray-900 text-lg">ECO</span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
            >
              Essayer gratuitement
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-200/60 px-4 py-4 space-y-3">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block text-sm font-medium text-gray-700 hover:text-gray-900 py-2"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/sign-up"
            className="block w-full text-center px-5 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors mt-2"
          >
            Essayer gratuitement
          </Link>
        </div>
      )}
    </nav>
  );
}

/* ─── Hero ─── */
function Hero() {
  return (
    <section
      id="hero"
      className="min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-4 text-center"
    >
      {/* Badge */}
      <div className="anim-fade-up delay-1 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm text-sm font-medium text-gray-700 mb-8">
        <Sparkles className="w-4 h-4 text-teal-500" />
        Propulsé par l&apos;IA — Fait pour les étudiants
      </div>

      {/* Title */}
      <h1 className="anim-fade-up delay-2 max-w-3xl text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-6">
        Tes cours audio, transformés en{" "}
        <span className="bg-gradient-to-r from-teal-500 via-blue-500 to-violet-500 bg-clip-text text-transparent">
          notes intelligentes
        </span>
      </h1>

      {/* Subtitle */}
      <p className="anim-fade-up delay-3 max-w-xl text-lg text-gray-600 leading-relaxed mb-10">
        Enregistre n&apos;importe quel cours, ECO génère automatiquement un résumé, des points clés, un quiz et une transcription complète en quelques secondes.
      </p>

      {/* CTAs */}
      <div className="anim-fade-up delay-4 flex flex-col sm:flex-row items-center gap-4 mb-16">
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gray-900 text-white font-semibold text-base hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
        >
          Essayer gratuitement
          <ChevronRight className="w-5 h-5" />
        </Link>
        <a
          href="#demo"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white/70 backdrop-blur-sm border border-white/60 text-gray-700 font-semibold text-base hover:bg-white/90 transition-all shadow-sm"
        >
          Voir la démo →
        </a>
      </div>

      {/* Video */}
      <div
        id="demo"
        className="anim-fade-up delay-5 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-white/60 bg-black"
      >
        <video
          src="https://pub-0270797b38de40338d1b41adf0ef1dca.r2.dev/Demo%20Eco.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover rounded-2xl"
        />
      </div>
    </section>
  );
}

/* ─── Social Proof ─── */
function SocialProof() {
  const schools = ["EDHEC", "ESCP"];

  return (
    <section className="py-12 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-sm font-medium text-gray-500 mb-6 uppercase tracking-widest">
          Adopté par des étudiants de grandes écoles
        </p>
        <div className="flex items-center justify-center gap-10">
          {schools.map((s) => (
            <span
              key={s}
              className="text-2xl font-bold text-gray-300 tracking-tight select-none"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ─── */
function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: <Mic className="w-6 h-6 text-teal-600" />,
      title: "Enregistre ton cours",
      desc: "Lance ECO avant le début de ton cours. L'app enregistre l'audio en arrière-plan sans consommer ta batterie.",
    },
    {
      num: "02",
      icon: <Sparkles className="w-6 h-6 text-blue-500" />,
      title: "L'IA génère tes notes",
      desc: "En quelques secondes, notre IA transcrit, analyse et structure ton cours en résumé, points clés et quiz personnalisés.",
    },
    {
      num: "03",
      icon: <BookOpen className="w-6 h-6 text-violet-500" />,
      title: "Révise avec quiz et points clés",
      desc: "Retrouve tout ton cours organisé, teste tes connaissances avec les quiz générés automatiquement et révise efficacement.",
    },
  ];

  return (
    <section id="how" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Trois étapes, c&apos;est tout.
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            De l&apos;enregistrement aux notes structurées en quelques secondes. Aucune configuration requise.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <div
              key={i}
              className="card-hover relative bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-8 shadow-lg"
            >
              <div className="absolute top-6 right-6 text-4xl font-black text-gray-100 select-none">
                {step.num}
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/80 border border-white/60 flex items-center justify-center shadow-sm mb-5">
                {step.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-gray-600 leading-relaxed text-sm">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ─── */
const TABS = [
  {
    id: "resume",
    label: "Résumé structuré",
    title: "Un résumé clair, structuré par sections thématiques",
    desc: "ECO analyse ton cours et génère un résumé organisé avec des titres thématiques, du contexte et une synthèse. Pas de copier-coller — une vraie compréhension.",
    pills: ["Sections automatiques", "Hiérarchie visuelle"],
    mockup: (
      <div className="bg-white/90 rounded-2xl border border-white/60 shadow-lg p-5 space-y-4 text-left">
        <div className="h-2.5 w-32 bg-gray-900 rounded-full" />
        <div className="space-y-2">
          <div className="h-2 w-full bg-gray-200 rounded-full" />
          <div className="h-2 w-5/6 bg-gray-200 rounded-full" />
          <div className="h-2 w-4/6 bg-gray-200 rounded-full" />
        </div>
        <div className="h-2.5 w-40 bg-teal-500/70 rounded-full mt-4" />
        <div className="space-y-2">
          <div className="h-2 w-full bg-gray-100 rounded-full" />
          <div className="h-2 w-5/6 bg-gray-100 rounded-full" />
          <div className="h-2 w-3/4 bg-gray-100 rounded-full" />
          <div className="h-2 w-full bg-gray-100 rounded-full" />
        </div>
        <div className="h-2.5 w-36 bg-blue-400/70 rounded-full mt-4" />
        <div className="space-y-2">
          <div className="h-2 w-full bg-gray-100 rounded-full" />
          <div className="h-2 w-4/5 bg-gray-100 rounded-full" />
        </div>
      </div>
    ),
  },
  {
    id: "points",
    label: "Points clés",
    title: "Les notions essentielles mises en avant",
    desc: "ECO extrait les concepts importants de ton cours et les structure en points clés avec définitions. Idéal pour une révision rapide avant un exam.",
    pills: ["Notions définies", "Révision rapide"],
    mockup: (
      <div className="bg-white/90 rounded-2xl border border-white/60 shadow-lg p-5 space-y-3 text-left">
        {[
          { color: "bg-teal-100", dot: "bg-teal-500", w: "w-4/5" },
          { color: "bg-blue-100", dot: "bg-blue-500", w: "w-3/4" },
          { color: "bg-violet-100", dot: "bg-violet-500", w: "w-5/6" },
          { color: "bg-amber-100", dot: "bg-amber-500", w: "w-2/3" },
          { color: "bg-rose-100", dot: "bg-rose-500", w: "w-4/5" },
        ].map((item, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 ${item.color} rounded-xl`}>
            <div className={`w-2.5 h-2.5 rounded-full ${item.dot} mt-1 shrink-0`} />
            <div className="space-y-1.5 flex-1">
              <div className="h-2.5 w-24 bg-gray-400 rounded-full" />
              <div className={`h-2 ${item.w} bg-gray-300 rounded-full`} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "quiz",
    label: "Quiz",
    title: "Teste tes connaissances avec des quiz générés",
    desc: "ECO génère automatiquement des questions QCM et ouvertes basées sur ton cours. Entraîne-toi, révèle les réponses et mesure ta progression.",
    pills: ["QCM automatique", "Questions ouvertes"],
    mockup: (
      <div className="bg-white/90 rounded-2xl border border-white/60 shadow-lg p-5 space-y-4 text-left">
        <div className="h-3 w-3/4 bg-gray-800 rounded-full" />
        <div className="space-y-2.5">
          {["A", "B", "C", "D"].map((letter, i) => (
            <div
              key={letter}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                i === 1
                  ? "bg-teal-50 border-teal-300"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 1 ? "bg-teal-500 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {letter}
              </div>
              <div className={`h-2 rounded-full ${i === 1 ? "bg-teal-400 w-3/4" : "bg-gray-200 w-2/3"}`} />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <div className="h-8 flex-1 bg-gray-900 rounded-xl" />
          <div className="h-8 flex-1 bg-gray-100 rounded-xl" />
        </div>
      </div>
    ),
  },
  {
    id: "transcript",
    label: "Transcription",
    title: "La transcription complète de ton cours",
    desc: "Accède à la retranscription mot pour mot de ton enregistrement. Retrouve une notion précise, une citation, ou relis tout le cours depuis l'app.",
    pills: ["Mot pour mot", "Copie en 1 clic"],
    mockup: (
      <div className="bg-white/90 rounded-2xl border border-white/60 shadow-lg p-5 space-y-2 text-left">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-gray-400" />
          <div className="h-2.5 w-28 bg-gray-300 rounded-full" />
        </div>
        {[
          [1, 0.9, 0.7],
          [0.8, 1, 0.6],
          [1, 0.75, 0.85],
          [0.6, 1, 0.8],
          [0.9, 0.7, 1],
          [0.8, 0.95, 0.65],
        ].map((row, i) => (
          <div key={i} className="flex gap-2">
            {row.map((w, j) => (
              <div
                key={j}
                className="h-2 bg-gray-200 rounded-full"
                style={{ flex: w }}
              />
            ))}
          </div>
        ))}
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <div className="h-8 w-28 bg-gray-900/10 rounded-xl" />
        </div>
      </div>
    ),
  },
];

function Features() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <section id="features" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Tout ce dont tu as besoin pour réviser
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Résumé, points clés, quiz, transcription — tout est généré automatiquement depuis ton enregistrement.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActive(i)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                active === i
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white/70 text-gray-600 hover:bg-white/90 border border-white/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Left: text */}
          <div key={tab.id} className="anim-fade-in space-y-5">
            <h3 className="text-2xl font-bold text-gray-900">{tab.title}</h3>
            <p className="text-gray-600 leading-relaxed">{tab.desc}</p>
            <div className="flex flex-wrap gap-2">
              {tab.pills.map((p) => (
                <span
                  key={p}
                  className="px-3 py-1.5 rounded-lg bg-white/70 border border-white/50 text-xs font-semibold text-gray-700 backdrop-blur-sm"
                >
                  {p}
                </span>
              ))}
            </div>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
            >
              Essayer gratuitement <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Right: mockup */}
          <div key={`mockup-${tab.id}`} className="anim-fade-in">
            <div className="bg-white/30 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-inner">
              {tab.mockup}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Testimonials ─── */
function Testimonials() {
  const items = [
    {
      name: "Chloé L.",
      school: "2ème année, EDHEC Business School",
      stars: 5,
      text: "J'utilise ECO pour tous mes cours de macro. En 30 secondes j'ai un résumé propre et un quiz pour réviser. J'aurais voulu avoir ça dès la première année.",
    },
    {
      name: "Antoine M.",
      school: "Master 1, ESCP Europe",
      stars: 5,
      text: "Le quiz généré automatiquement est bluffant. Les questions tombent exactement sur les points que le prof a insistés. Parfait pour préparer les partiels.",
    },
    {
      name: "Sofia R.",
      school: "Bachelor, EDHEC",
      stars: 5,
      text: "Je n'écris plus pendant les cours, je me concentre sur ce que dit le prof. ECO s'occupe du reste. La qualité de mes révisions a vraiment changé.",
    },
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Ils utilisent ECO
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div
              key={i}
              className="card-hover bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-7 shadow-lg"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: item.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 leading-relaxed text-sm mb-6">&ldquo;{item.text}&rdquo;</p>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{item.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.school}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ─── */
function CTA() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Prêt à transformer tes cours ?
          </h2>
          <p className="text-gray-300 text-lg mb-8">
            Commence gratuitement avec 10 minutes offertes. Sans carte bancaire.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-gray-900 font-bold text-base hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            Créer mon compte gratuitement
            <ChevronRight className="w-5 h-5" />
          </Link>
          <div className="mt-5">
            <Link
              href="/pricing"
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              Voir les tarifs →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
const FAQ_ITEMS = [
  {
    q: "ECO fonctionne avec quelle langue ?",
    a: "ECO transcrit et résume les cours en français. D'autres langues arrivent bientôt.",
  },
  {
    q: "Mes enregistrements sont-ils privés ?",
    a: "Oui, tes enregistrements et résumés sont 100% privés. Personne d'autre n'y a accès.",
  },
  {
    q: "Quelle est la durée maximum d'un enregistrement ?",
    a: "Jusqu'à 60 minutes par enregistrement.",
  },
  {
    q: "Ça marche sur téléphone ?",
    a: "ECO est accessible depuis n'importe quel navigateur, sur ordinateur comme sur téléphone. Pas besoin d'installer d'application.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 px-4">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">
          Questions fréquentes
        </h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl overflow-hidden shadow-sm"
            >
              <button
                className="w-full flex items-center justify-between px-6 py-5 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-semibold text-gray-900 text-sm sm:text-base pr-4">
                  {item.q}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${
                    open === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="border-t border-white/40 bg-white/40 backdrop-blur-sm py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Logo + tagline */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Image src="/logo-eco.png" alt="ECO" width={28} height={28} className="rounded-lg" />
              <span className="font-bold text-gray-900">ECO</span>
            </div>
            <p className="text-xs text-gray-500 max-w-[200px]">
              Tes cours audio, transformés en notes intelligentes.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
            <Link href="/legal/cgu" className="hover:text-gray-800 transition-colors">CGU</Link>
            <Link href="/legal/cgv" className="hover:text-gray-800 transition-colors">CGV</Link>
            <Link href="/legal/confidentialite" className="hover:text-gray-800 transition-colors">Confidentialité</Link>
            <Link href="/legal/mentions-legales" className="hover:text-gray-800 transition-colors">Mentions légales</Link>
            <a href="mailto:support@econewapp.com" className="hover:text-gray-800 transition-colors">
              support@econewapp.com
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/40 text-center text-xs text-gray-400">
          © 2026 ECO. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}

/* ─── Page principale ─── */
export default function LandingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ANIM_STYLES }} />
      <div className="min-h-screen aura-gradient">
        <Nav />
        <Hero />
        <SocialProof />
        <HowItWorks />
        <Features />
        <Testimonials />
        <CTA />
        <FAQ />
        <Footer />
      </div>
    </>
  );
}
