import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs — ECO",
  description:
    "Les plans ECO pour enregistrer tes cours et obtenir résumés, notions, quiz et flashcards. Commence gratuitement avec 10 minutes offertes.",
  alternates: { canonical: "/pricing" },
  openGraph: { url: "/pricing", title: "Tarifs — ECO" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
