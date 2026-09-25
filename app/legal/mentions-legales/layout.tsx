import type { Metadata } from "next";
import SiteFooter from "@/components/marketing/SiteFooter";

export const metadata: Metadata = {
  title: "Mentions légales — ECO",
  description: "Mentions légales de l'application ECO — éditeur, hébergement et propriété intellectuelle.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/legal/mentions-legales" },
};

export default function MentionsLegalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
