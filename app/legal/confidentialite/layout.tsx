import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — ECO",
  description: "Politique de confidentialité d'ECO : collecte, traitement et protection de vos données personnelles conformément au RGPD.",
  robots: { index: true, follow: true },
};

export default function ConfidentialiteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
