import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente — ECO",
  description: "Conditions générales de vente des abonnements et packs minutes de l'application ECO.",
  robots: { index: true, follow: true },
};

export default function CGVLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
