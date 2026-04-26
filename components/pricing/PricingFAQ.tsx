"use client";

import { memo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "Les minutes sont-elles cumulables d'un mois sur l'autre ?",
    answer: "Les minutes incluses dans ton plan se réinitialisent 1 mois après la date de souscription (pas le 1er du mois). Par exemple, si tu t'abonnes le 15 février, tes minutes se réinitialisent le 15 mars. Les packs de minutes supplémentaires que tu achètes sont permanents : ils s'ajoutent à ton compteur et ne se réinitialisent jamais. Tu peux les utiliser quand tu le souhaites, sans limite de temps.",
  },
  {
    question: "Puis-je acheter des packs même avec le plan Free ?",
    answer: "Oui, absolument ! Les packs de minutes sont disponibles pour tous les utilisateurs, y compris ceux sur le plan Free. C'est idéal si tu as besoin de quelques minutes supplémentaires ponctuellement.",
  },
  {
    question: "Y a-t-il une limite de durée par enregistrement ?",
    answer: "Oui, chaque enregistrement est limité à 60 minutes maximum. Cette limite s'applique à tous les plans pour garantir une qualité optimale de transcription.",
  },
  {
    question: "Puis-je changer de plan à tout moment ?",
    answer: "Oui, tu peux mettre à jour ton plan à tout moment depuis la page Paramètres. Le changement prend effet immédiatement et les minutes de ton nouveau plan sont disponibles dès la mise à jour.",
  },
  {
    question: "Les données sont-elles sécurisées ?",
    answer: "Oui, tous tes enregistrements et transcriptions sont stockés de manière sécurisée. Nous utilisons un chiffrement de bout en bout pour protéger tes données. Ta vie privée est notre priorité.",
  },
];

function PricingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto">
      <h2
        className="text-3xl md:text-4xl font-semibold mb-12 text-center tracking-[-0.02em]"
        style={{ color: "#EDECE8" }}
      >
        Questions fréquentes
      </h2>
      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className="rounded-2xl overflow-hidden transition-all duration-300"
            style={{
              background: "#141619",
              border: openIndex === index ? "1px solid rgba(139,92,246,0.25)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-6 py-5 flex items-center justify-between text-left transition-colors group"
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span className="font-semibold pr-4 text-sm md:text-base" style={{ color: "#EDECE8" }}>
                {faq.question}
              </span>
              <div
                className={`flex-shrink-0 transition-transform duration-300 ${openIndex === index ? "rotate-180" : ""}`}
              >
                <ChevronDown
                  className="w-5 h-5"
                  style={{ color: openIndex === index ? "#A78BFA" : "rgba(237,236,232,0.35)" }}
                />
              </div>
            </button>
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    className="px-6 pb-5 text-sm leading-relaxed pt-4"
                    style={{
                      color: "rgba(237,236,232,0.6)",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(PricingFAQ);
