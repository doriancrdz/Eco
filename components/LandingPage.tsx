import Image from "next/image";
import Link from "next/link";
import { ArrowRight, AudioLines, BrainCircuit, Check, FileText, Layers, Lock, MonitorSpeaker, Plus, Smartphone, Star, X } from "lucide-react";
import SiteHeader from "@/components/marketing/SiteHeader";
import SiteFooter from "@/components/marketing/SiteFooter";
import Reveal from "@/components/marketing/Reveal";
import ProductPreview from "@/components/marketing/ProductPreview";
import HeroDemo from "@/components/marketing/HeroDemo";
import { PLANS, MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";

/* ─── Hero ───────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-140px] -translate-x-1/2">
        <div className="mk-float relative h-[560px] w-[560px] opacity-[0.28] blur-[90px] sm:h-[720px] sm:w-[720px]">
          <Image src="/logo-eco-v2.png" alt="" fill sizes="720px" className="object-contain" priority />
        </div>
      </div>
      <div className="mk-grain" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 text-center sm:px-8">
        <p className="mk-rise mk-eyebrow" style={{ animationDelay: "40ms" }}>
          Pour les étudiants en école et à la fac
        </p>

        <h1
          className="mk-display mk-rise mx-auto mt-6 max-w-4xl text-[52px] sm:text-[76px] lg:text-[92px]"
          style={{ animationDelay: "120ms" }}
        >
          Écoute ton cours.
          <br />
          <span className="italic mk-iris">ECO écrit tes fiches.</span>
        </h1>

        <p
          className="mk-rise mx-auto mt-7 max-w-xl text-[17px] leading-relaxed sm:text-[18px]"
          style={{ color: "var(--mk-muted)", animationDelay: "200ms" }}
        >
          Arrête de recopier pendant deux heures. Lance ECO au début du cours : quelques minutes après la fin, tu as une fiche claire, les notions définies, un quiz et des flashcards. Tout vient de ce que ton prof a vraiment dit.
        </p>

        <div className="mk-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "280ms" }}>
          <Link href="/sign-up" className="mk-btn mk-btn-primary w-full sm:w-auto">
            Commencer gratuitement <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="#produit" className="mk-btn mk-btn-ghost w-full sm:w-auto">
            Voir une vraie fiche
          </Link>
        </div>
        <p className="mk-rise mt-4 text-[13px]" style={{ color: "var(--mk-faint)", animationDelay: "320ms" }}>
          10 minutes offertes chaque mois · Sans carte bancaire · Rien à installer
        </p>

        <div className="mk-rise relative mx-auto mt-12 max-w-5xl sm:mt-14" style={{ animationDelay: "380ms" }}>
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}

/* ─── Social proof + disciplines ───────────────────────────────────── */

const DISCIPLINES = [
  "Macroéconomie",
  "Droit des contrats",
  "Finance d'entreprise",
  "Marketing",
  "Comptabilité",
  "Statistiques",
  "Histoire contemporaine",
  "Biologie cellulaire",
  "Droit constitutionnel",
  "Microéconomie",
  "Philosophie politique",
  "Contrôle de gestion",
];

function ProofStrip() {
  return (
    <section className="pt-20">
      <Reveal className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center sm:flex-row sm:justify-center sm:gap-6 sm:px-8">
        <p className="text-[14px]" style={{ color: "var(--mk-muted)" }}>
          Utilisé par des étudiants de
        </p>
        <div className="flex items-center gap-7">
          {["EDHEC", "ESCP"].map((s) => (
            <span key={s} className="text-[20px] font-semibold tracking-[0.08em]" style={{ color: "#5E5C58" }}>
              {s}
            </span>
          ))}
        </div>
      </Reveal>
      <div className="mk-marquee-mask mt-12 overflow-hidden" aria-hidden>
        <div className="mk-marquee">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center">
              {DISCIPLINES.map((d) => (
                <span key={`${k}-${d}`} className="mk-display flex items-center whitespace-nowrap px-6 text-[26px] italic" style={{ color: "#4A4946" }}>
                  {d}
                  <span className="ml-12 inline-block h-1 w-1 rounded-full" style={{ background: "#3A3937" }} />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Before / after (le quotidien de l'étudiant) ───────────────────── */

const BEFORE = [
  "Tu recopies au lieu d'écouter, et tu décroches dès que le prof accélère.",
  "Trois semaines plus tard, tes notes sont illisibles ou à moitié vides.",
  "Tu passes tes soirées à tout remettre au propre.",
  "La veille du partiel, tu relis tout sans savoir ce que tu as retenu.",
];

const AFTER = [
  "Tu écoutes, tu comprends, tu poses tes questions.",
  "Rien n'est perdu : le cours est transcrit en entier.",
  "Une fiche claire par cours, rangée dans la bonne matière.",
  "Tu révises avec un quiz et des flashcards : tu sais ce qui coince.",
];

function BeforeAfter() {
  return (
    <section className="px-5 pt-32 sm:px-8 sm:pt-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mk-eyebrow">Le problème</p>
          <h2 className="mk-display mt-5 text-[42px] sm:text-[56px]">
            Tu ne peux pas écouter
            <br />
            <span className="italic" style={{ color: "var(--mk-muted)" }}>
              et tout noter à la fois.
            </span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <Reveal className="mk-card p-7 sm:p-9">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--mk-faint)" }}>
              Sans ECO
            </p>
            <ul className="mt-6 space-y-4">
              {BEFORE.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
                  <X className="mt-1 h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: "#6E6C68" }} />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100} className="mk-card mk-spotlight p-7 sm:p-9" >
            <p className="text-[13px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--mk-lilac)" }}>
              Avec ECO
            </p>
            <ul className="mt-6 space-y-4">
              {AFTER.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] leading-relaxed" style={{ color: "var(--mk-text)" }}>
                  <Check className="mt-1 h-4 w-4 shrink-0" strokeWidth={2} style={{ color: "var(--mk-lilac)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Product ───────────────────────────────────────────────────────── */

function Product() {
  return (
    <section id="produit" className="scroll-mt-20 px-5 pt-32 sm:px-8 sm:pt-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mk-eyebrow">Ce que tu reçois</p>
          <h2 className="mk-display mt-5 text-[42px] sm:text-[56px]">
            Une heure de cours.
            <br />
            <span className="italic" style={{ color: "var(--mk-muted)" }}>
              Une fiche que tu as envie de relire.
            </span>
          </h2>
          <p className="mt-6 text-[16px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
            Voici le type de fiche qu&apos;ECO produit à partir d&apos;un cours enregistré. Clique sur les onglets, réponds au quiz, retourne les cartes.
          </p>
        </Reveal>
        <Reveal delay={120} className="mx-auto mt-14 max-w-4xl">
          <ProductPreview />
        </Reveal>
      </div>
    </section>
  );
}

/* ─── How it works ──────────────────────────────────────────────────── */

const STEPS = [
  {
    title: "Lance l'enregistrement",
    body: `Au début du cours, un clic suffit. Le micro de ton ordinateur ou de ton téléphone fait l'affaire. Jusqu'à ${MAX_RECORDING_DURATION_MINUTES} minutes par enregistrement.`,
  },
  {
    title: "Ajoute le support du prof",
    body: "Optionnel : dépose le PDF du cours. ECO s'en sert pour reprendre le vocabulaire exact du prof dans les notions et le quiz.",
  },
  {
    title: "Révise",
    body: "Quelques minutes après la fin, ta fiche est prête : résumé par thème, notions définies, quiz, flashcards et transcription complète.",
  },
];

function HowItWorks() {
  return (
    <section id="comment" className="scroll-mt-20 px-5 pt-32 sm:px-8 sm:pt-40">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <Reveal>
          <p className="mk-eyebrow">Comment ça marche</p>
          <h2 className="mk-display mt-5 text-[42px] sm:text-[56px]">
            Tu écoutes.
            <br />
            <span className="italic" style={{ color: "var(--mk-muted)" }}>
              ECO prend les notes.
            </span>
          </h2>
          <p className="mt-6 max-w-md text-[16px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
            Plus besoin de choisir entre comprendre et recopier. Tu restes concentré sur le cours, la mise au propre se fait sans toi.
          </p>
        </Reveal>
        <ol className="relative">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 90} className="grid grid-cols-[48px_1fr] gap-5 border-t border-[color:var(--mk-line)] py-8 first:border-t-0 first:pt-0 lg:first:pt-2">
              <span className="mk-display text-[34px] leading-none" style={{ color: "var(--mk-lilac)" }}>
                {i + 1}
              </span>
              <div>
                <h3 className="text-[18px] font-medium" style={{ color: "var(--mk-text)" }}>
                  {s.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─── Features ──────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: MonitorSpeaker,
    title: "Cours en visio aussi",
    body: "Sur ordinateur avec Chrome ou Edge, ECO capte le son d'un onglet : parfait pour un cours sur Teams, Meet ou Zoom ouvert dans le navigateur.",
  },
  {
    icon: FileText,
    title: "Le PDF du prof comme référence",
    body: "Les définitions et les questions reprennent les termes exacts de ton support de cours.",
  },
  {
    icon: Layers,
    title: "Révision active",
    body: "Quiz QCM et questions ouvertes avec réponse modèle, flashcards, export vers Anki.",
  },
  {
    icon: BrainCircuit,
    title: "Réviser une matière entière",
    body: "Tes cours sont rangés par matière et cherchables. Avec Pro, un quiz mélange les questions de toute une matière et toutes ses notions passent en flashcards.",
  },
  {
    icon: Smartphone,
    title: "Rien à installer",
    body: "Tout se passe dans le navigateur, sur ordinateur comme sur téléphone.",
  },
  {
    icon: Lock,
    title: "Tes cours restent à toi",
    body: "Tes fiches sont privées. L'audio est supprimé de nos serveurs dès que la transcription est faite.",
  },
];

function Features() {
  return (
    <section className="px-5 pt-32 sm:px-8 sm:pt-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="mk-eyebrow">Les détails qui comptent</p>
          <h2 className="mk-display mt-5 text-[42px] sm:text-[56px]">
            Pensé pour la vraie vie d&apos;étudiant.
          </h2>
        </Reveal>
        <div
          className="mt-14 grid overflow-hidden rounded-[22px] border sm:grid-cols-2 lg:grid-cols-3"
          style={{ borderColor: "var(--mk-line)", background: "var(--mk-line)", gap: "1px" }}
        >
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80} className="mk-spotlight bg-[var(--mk-bg)] p-7 sm:p-8">
              <div className="h-full">
                <f.icon className="h-5 w-5" strokeWidth={1.6} style={{ color: "var(--mk-lilac)" }} />
                <h3 className="mt-6 text-[16px] font-medium" style={{ color: "var(--mk-text)" }}>
                  {f.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pourquoi pas ChatGPT ? ────────────────────────────────────────── */

const COMPARE = [
  ["Enregistrer le cours avec une autre appli, puis trouver comment le transcrire", "Un clic au début du cours, depuis le navigateur"],
  ["Coller le texte, réécrire ton prompt, recommencer à chaque cours", "La même fiche structurée à chaque fois : intro, contenu, conclusion"],
  ["Des réponses éparpillées dans des dizaines de conversations", "Tous tes cours rangés par matière et cherchables"],
  ["Demander un quiz, puis des flashcards, puis les recopier dans Anki", "Quiz, flashcards et export Anki prêts avec la fiche"],
] as const;

function WhyNotChatbot() {
  return (
    <section className="px-5 pt-32 sm:px-8 sm:pt-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="mk-eyebrow">La question qu&apos;on nous pose</p>
          <h2 className="mk-display mt-5 text-[42px] sm:text-[56px]">
            Pourquoi pas
            <br />
            <span className="italic" style={{ color: "var(--mk-muted)" }}>
              juste ChatGPT ?
            </span>
          </h2>
          <p className="mt-6 max-w-lg text-[16px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
            Un chatbot peut résumer un texte. Mais entre ton amphi et une fiche prête à réviser, c&apos;est toi qui fais tout le travail. ECO le fait à ta place, cours après cours.
          </p>
        </Reveal>
        <Reveal delay={80} className="mk-card mt-12 overflow-hidden">
          <div className="grid grid-cols-2 border-b text-[12.5px] font-medium uppercase tracking-[0.08em]" style={{ borderColor: "var(--mk-line)" }}>
            <p className="px-5 py-4 sm:px-8" style={{ color: "var(--mk-faint)" }}>
              Avec un chatbot
            </p>
            <p className="border-l px-5 py-4 sm:px-8" style={{ color: "var(--mk-lilac)", borderColor: "var(--mk-line)" }}>
              Avec ECO
            </p>
          </div>
          {COMPARE.map(([bad, good], i) => (
            <div key={good} className={`grid grid-cols-2 text-[14px] leading-relaxed sm:text-[15px] ${i > 0 ? "border-t" : ""}`} style={{ borderColor: "var(--mk-line)" }}>
              <p className="px-5 py-5 sm:px-8" style={{ color: "var(--mk-muted)" }}>
                {bad}
              </p>
              <p className="border-l px-5 py-5 sm:px-8" style={{ color: "var(--mk-text)", borderColor: "var(--mk-line)", background: "rgba(201,184,255,0.025)" }}>
                {good}
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Testimonials ──────────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    name: "Chloé L.",
    school: "2ème année, EDHEC Business School",
    text: "J'utilise ECO pour tous mes cours de macro. En 30 secondes j'ai un résumé propre et un quiz pour réviser. J'aurais voulu avoir ça dès la première année.",
  },
  {
    name: "Antoine M.",
    school: "Master 1, ESCP Europe",
    text: "Le quiz généré automatiquement est bluffant. Les questions tombent exactement sur les points que le prof a insistés. Parfait pour préparer les partiels.",
  },
  {
    name: "Sofia R.",
    school: "Bachelor, EDHEC",
    text: "Je n'écris plus pendant les cours, je me concentre sur ce que dit le prof. ECO s'occupe du reste. La qualité de mes révisions a vraiment changé.",
  },
];

function Testimonials() {
  return (
    <section className="px-5 pt-32 sm:px-8 sm:pt-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="mk-eyebrow">Ils l&apos;utilisent</p>
          <h2 className="mk-display mt-5 text-[42px] sm:text-[56px]">
            Moins de recopie,
            <br />
            <span className="italic" style={{ color: "var(--mk-muted)" }}>
              plus de compréhension.
            </span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 90} className="mk-card flex flex-col justify-between p-7">
              <div>
                <div className="flex gap-0.5" aria-label="5 étoiles sur 5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5" fill="#E8D9A8" stroke="none" />
                  ))}
                </div>
                <blockquote className="mt-5 text-[15.5px] leading-relaxed" style={{ color: "#D6D3CD" }}>
                  «&nbsp;{t.text}&nbsp;»
                </blockquote>
              </div>
              <figcaption className="mt-8 border-t pt-5" style={{ borderColor: "var(--mk-line)" }}>
                <p className="text-[14px] font-medium" style={{ color: "var(--mk-text)" }}>
                  {t.name}
                </p>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--mk-faint)" }}>
                  {t.school}
                </p>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing teaser ────────────────────────────────────────────────── */

const TEASER_PLANS = [
  {
    key: "free" as const,
    label: "Pour essayer",
    cta: "Commencer gratuitement",
    href: "/sign-up",
    points: ["10 min offertes chaque mois", "Fiche, notions, quiz et flashcards", "Sans carte bancaire"],
  },
  {
    key: "student" as const,
    label: "Recommandé",
    cta: "Choisir Student",
    href: "/pricing",
    highlight: true,
    points: ["800 min par mois, ≈ 13 h de cours", "Toutes les fiches de ton semestre", "Export Anki, matières, recherche"],
  },
  {
    key: "pro" as const,
    label: "Pour les partiels",
    cta: "Choisir Pro",
    href: "/pricing",
    points: ["2 000 min par mois, ≈ 33 h de cours", "Réviser une matière entière", "Export PDF, support prioritaire"],
  },
];

function PricingTeaser() {
  return (
    <section className="px-5 pt-32 sm:px-8 sm:pt-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mk-eyebrow">Tarifs</p>
          <h2 className="mk-display mt-5 text-[42px] sm:text-[56px]">Moins cher qu&apos;un cours particulier.</h2>
          <p className="mt-5 text-[16px]" style={{ color: "var(--mk-muted)" }}>
            Teste gratuitement sur un vrai cours. Passe à Student quand ECO fait partie de ta routine.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {TEASER_PLANS.map((p, i) => {
            const plan = PLANS[p.key];
            return (
              <Reveal key={p.key} delay={i * 90} className="h-full">
                <div
                  className={`mk-spotlight flex h-full flex-col rounded-[20px] border p-7 ${p.highlight ? "mk-featured" : ""}`}
                  style={p.highlight ? undefined : { background: "var(--mk-surface)", borderColor: "var(--mk-line)" }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-medium" style={{ color: "var(--mk-text)" }}>
                      {plan.name}
                    </p>
                    <p className="text-[12px]" style={{ color: p.highlight ? "var(--mk-lilac)" : "var(--mk-faint)" }}>
                      {p.label}
                    </p>
                  </div>
                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="mk-display text-[52px]" style={{ color: "var(--mk-text)" }}>
                      {plan.priceMonthly}€
                    </span>
                    <span className="text-[14px]" style={{ color: "var(--mk-muted)" }}>
                      {plan.priceMonthly === 0 ? "" : "/ mois"}
                    </span>
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-[14px]" style={{ color: "#C9C6C0" }}>
                        <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} style={{ color: p.highlight || p.key === "pro" ? "var(--mk-lilac)" : "var(--mk-muted)" }} />
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <Link href={p.href} className={`mk-btn mt-8 w-full ${p.highlight ? "mk-btn-primary" : "mk-btn-ghost"}`}>
                    {p.cta}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="mt-8 flex flex-col items-center gap-2 text-center text-[14px] sm:flex-row sm:justify-center sm:gap-6">
          <Link href="/pricing" className="inline-flex items-center gap-1.5 hover:text-[var(--mk-text)]" style={{ color: "var(--mk-muted)" }}>
            Comparer les offres, l&apos;annuel et les packs <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-1.5 hover:text-[var(--mk-text)]" style={{ color: "var(--mk-muted)" }}>
            École ou asso : offre Business sur devis <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── FAQ ───────────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: "Combien de temps faut-il pour obtenir ma fiche ?",
    a: "Quelques minutes après la fin de l'enregistrement. Le délai dépend de la durée du cours : plus il est long, plus la transcription prend du temps.",
  },
  {
    q: "ECO fonctionne avec quelle langue ?",
    a: "ECO transcrit et résume les cours en français.",
  },
  {
    q: "Quelle est la durée maximum d'un enregistrement ?",
    a: `${MAX_RECORDING_DURATION_MINUTES} minutes. À ${MAX_RECORDING_DURATION_MINUTES} minutes, l'enregistrement s'arrête tout seul et ta fiche se prépare : pour un cours plus long, relance un second enregistrement pour la suite.`,
  },
  {
    q: "Ai-je le droit d'enregistrer mon cours ?",
    a: "Demande toujours l'accord de ton enseignant avant d'enregistrer : les règles varient d'un établissement à l'autre. ECO est conçu pour un usage personnel de révision. Tes fiches restent privées, et l'audio est supprimé de nos serveurs dès que la transcription est terminée.",
  },
  {
    q: "Comment tester gratuitement ?",
    a: "Crée un compte : tu as 10 minutes offertes chaque mois, sans carte bancaire. C'est assez pour enregistrer un extrait de cours, ou une vidéo de cours sur YouTube, et voir la fiche, les notions, le quiz et les flashcards.",
  },
  {
    q: "Ça marche sur téléphone ?",
    a: "Oui. ECO fonctionne dans n'importe quel navigateur, sur ordinateur comme sur téléphone, sans application à installer. Garde l'écran allumé pendant l'enregistrement.",
  },
  {
    q: "Et pour les cours en visio ?",
    a: "Sur ordinateur, avec Chrome ou Edge : choisis « Son d'un onglet », sélectionne l'onglet du cours (Teams, Meet ou Zoom dans le navigateur) et coche « Partager l'audio ». Avec l'application Teams ou Zoom installée, la capture dépend de ton système : le plus fiable est d'ouvrir le cours dans le navigateur.",
  },
  {
    q: "Mes enregistrements sont-ils privés ?",
    a: "Oui. Tes fiches ne sont visibles que par toi, et le fichier audio est supprimé de nos serveurs dès que la transcription est terminée.",
  },
  {
    q: "Comment fonctionne le décompte des minutes ?",
    a: "Chaque minute enregistrée est déduite de ton forfait mensuel. Si tu en manques avant la fin du mois, tu peux acheter un pack de minutes sans changer d'abonnement.",
  },
];

function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20 px-5 pt-32 sm:px-8 sm:pt-40">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <Reveal>
          <p className="mk-eyebrow">FAQ</p>
          <h2 className="mk-display mt-5 text-[42px] sm:text-[56px]">Questions fréquentes</h2>
          <p className="mt-5 text-[15px]" style={{ color: "var(--mk-muted)" }}>
            Une autre question ? Écris-nous à{" "}
            <a href="mailto:support@econewapp.com" className="underline decoration-[var(--mk-line-strong)] underline-offset-4 hover:text-[var(--mk-text)]">
              support@econewapp.com
            </a>
            .
          </p>
        </Reveal>
        <Reveal delay={80}>
          <div className="border-t" style={{ borderColor: "var(--mk-line)" }}>
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="group border-b" style={{ borderColor: "var(--mk-line)" }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] [&::-webkit-details-marker]:hidden" style={{ color: "var(--mk-text)" }}>
                  {item.q}
                  <Plus className="h-4 w-4 shrink-0 transition-transform duration-300 group-open:rotate-45" style={{ color: "var(--mk-muted)" }} />
                </summary>
                <p className="pb-6 pr-10 text-[15px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Final CTA ─────────────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="px-5 pb-28 pt-32 sm:px-8 sm:pb-36 sm:pt-40">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-[color:var(--mk-line)] px-6 py-20 text-center sm:py-28">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--mk-surface)" }} />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-30 blur-[80px]">
          <Image src="/logo-eco-v2.png" alt="" fill sizes="420px" className="object-contain" />
        </div>
        <div className="relative">
          <AudioLines className="mx-auto h-6 w-6" strokeWidth={1.5} style={{ color: "var(--mk-text)" }} />
          <h2 className="mk-display mx-auto mt-6 max-w-2xl text-[44px] sm:text-[64px]">
            Ton prochain cours,
            <br />
            <span className="italic">déjà révisé.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-[16px]" style={{ color: "var(--mk-muted)" }}>
            Crée ton compte en 30 secondes et teste ECO sur ton prochain cours. 10 minutes offertes, sans carte bancaire.
          </p>
          <Link href="/sign-up" className="mk-btn mk-btn-primary mt-9">
            Commencer gratuitement <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="mk min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />
      <SiteHeader />
      <main>
        <Hero />
        <ProofStrip />
        <BeforeAfter />
        <Product />
        <HowItWorks />
        <Features />
        <WhyNotChatbot />
        <Testimonials />
        <PricingTeaser />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}
