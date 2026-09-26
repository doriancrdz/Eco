import { Plus } from "lucide-react";
import { MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";

const faqs = [
  {
    question: "Quelle différence entre Student et Pro ?",
    answer:
      "Student te donne 800 min par mois (environ 13 h de cours) et tout ce qu'il faut pour chaque cours : fiche, notions, quiz, flashcards et export Anki. Pro monte à 2 000 min (environ 33 h) et ajoute les outils de révision : un quiz qui mélange les questions de tous les cours d'une matière, toutes ses notions en flashcards, l'export PDF des fiches et un support prioritaire.",
  },
  {
    question: "Comment tester gratuitement ?",
    answer:
      "Crée un compte : tu as 10 minutes offertes chaque mois, sans carte bancaire. C'est assez pour enregistrer un extrait de cours et voir la fiche, les notions, le quiz et les flashcards qu'ECO en tire.",
  },
  {
    question: "Comment marche l'offre Business ?",
    answer:
      "Elle s'adresse aux écoles, associations étudiantes et groupes. Écris-nous à support@econewapp.com avec le nombre d'étudiants et le volume de cours : on te propose un tarif, on active les comptes Pro de tout le groupe et tu reçois une seule facture.",
  },
  {
    question: "Les minutes sont-elles cumulables d'un mois sur l'autre ?",
    answer:
      "Les minutes incluses dans ton plan se réinitialisent un mois après ta date de souscription (et non le 1er du mois). Par exemple, si tu t'abonnes le 15 février, elles se réinitialisent le 15 mars. Les minutes des packs, elles, sont permanentes : elles s'ajoutent à ton compteur et n'expirent jamais.",
  },
  {
    question: "Puis-je acheter des packs sans abonnement ?",
    answer: "Oui. Les packs de minutes sont disponibles pour tous, y compris sur l'offre gratuite. C'est pratique si tu as besoin de minutes ponctuellement sans t'abonner.",
  },
  {
    question: "Y a-t-il une limite de durée par enregistrement ?",
    answer: `Oui, chaque enregistrement est limité à ${MAX_RECORDING_DURATION_MINUTES} minutes, quel que soit le plan. Pour un cours plus long, lance un second enregistrement à la pause.`,
  },
  {
    question: "Comment fonctionne l'annuel ?",
    answer:
      "Deux options : payer l'année en une fois, ou payer chaque mois au tarif annuel avec un engagement de 12 mois. Dans les deux cas, le prix mensuel est plus bas qu'en mensuel sans engagement.",
  },
  {
    question: "Puis-je changer de plan ou résilier ?",
    answer:
      "Oui, depuis la page Paramètres. Un changement de plan prend effet immédiatement. Les abonnements mensuels sans engagement se résilient à tout moment.",
  },
  {
    question: "Que deviennent mes données ?",
    answer:
      "Tes fiches ne sont visibles que par toi. Les échanges sont chiffrés en HTTPS et nos hébergeurs chiffrent les données stockées. Pour produire la transcription et le résumé, l'audio puis le texte sont traités par l'API d'OpenAI. Le fichier audio est supprimé de nos serveurs dès que la transcription est terminée.",
  },
];

export default function PricingFAQ() {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
      <div>
        <p className="mk-eyebrow">FAQ</p>
        <h2 className="mk-display mt-5 text-[42px] sm:text-[52px]">Questions sur les tarifs</h2>
        <p className="mt-5 text-[15px]" style={{ color: "var(--mk-muted)" }}>
          Une autre question ? Écris-nous à{" "}
          <a href="mailto:support@econewapp.com" className="underline decoration-[var(--mk-line-strong)] underline-offset-4 hover:text-[var(--mk-text)]">
            support@econewapp.com
          </a>
          .
        </p>
      </div>
      <div className="border-t" style={{ borderColor: "var(--mk-line)" }}>
        {faqs.map((faq) => (
          <details key={faq.question} className="group border-b" style={{ borderColor: "var(--mk-line)" }}>
            <summary
              className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] [&::-webkit-details-marker]:hidden"
              style={{ color: "var(--mk-text)" }}
            >
              {faq.question}
              <Plus className="h-4 w-4 shrink-0 transition-transform duration-300 group-open:rotate-45" style={{ color: "var(--mk-muted)" }} />
            </summary>
            <p className="pb-6 pr-10 text-[15px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
