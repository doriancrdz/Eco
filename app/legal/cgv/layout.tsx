import type { Metadata } from "next";
import SiteFooter from "@/components/marketing/SiteFooter";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente — ECO",
  description: "Conditions générales de vente des abonnements et packs minutes de l'application ECO.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/legal/cgv" },
};

export default function CGVLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
