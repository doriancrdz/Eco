"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "Les minutes sont-elles cumulables d'un mois sur l'autre ?",
    answer:
      "Les minutes incluses dans votre plan se réinitialisent 1 mois après la date de souscription (pas le 1er du mois). Par exemple, si vous vous abonnez le 15 février, vos minutes se réinitialisent le 15 mars. Les packs de minutes supplémentaires que vous achetez sont permanents : ils s'ajoutent à votre compteur et ne se réinitialisent jamais. Vous pouvez les utiliser quand vous le souhaitez, sans limite de temps.",
  },
  {
    question: "Puis-je acheter des packs même avec le plan Free ?",
    answer:
      "Oui, absolument ! Les packs de minutes sont disponibles pour tous les utilisateurs, y compris ceux sur le plan Free. C'est idéal si vous avez besoin de quelques minutes supplémentaires ponctuellement.",
  },
  {
    question: "Y a-t-il une limite de durée par enregistrement ?",
    answer:
      "Oui, chaque enregistrement est limité à 60 minutes maximum. Cette limite s'applique à tous les plans pour garantir une qualité optimale de transcription.",
  },
  {
    question: "Puis-je changer de plan à tout moment ?",
    answer:
      "Oui, vous pouvez mettre à jour votre plan à tout moment depuis la page Paramètres. Le changement prend effet immédiatement et les minutes de votre nouveau plan sont disponibles dès la mise à jour.",
  },
  {
    question: "Les données sont-elles sécurisées ?",
    answer:
      "Oui, tous vos enregistrements et transcriptions sont stockés localement dans votre navigateur. Nous ne conservons aucune donnée sur nos serveurs. Votre vie privée est notre priorité.",
  },
];

export default function PricingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-3xl md:text-4xl font-semibold text-gray-900 mb-12 text-center"
      >
        Questions fréquentes
      </motion.h2>
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="floating-card rounded-card border border-white/40 overflow-hidden hover:border-white/60 hover:shadow-xl transition-all duration-300"
          >
            <motion.button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/30 transition-colors group"
              whileHover={{ x: 2 }}
            >
              <span className="font-semibold text-gray-900 pr-4 text-base group-hover:text-gray-800 transition-colors">
                {faq.question}
              </span>
              <motion.div
                animate={{ rotate: openIndex === index ? 180 : 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="flex-shrink-0"
              >
                <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-gray-700 transition-colors" />
              </motion.div>
            </motion.button>
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-white/20 pt-4">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
