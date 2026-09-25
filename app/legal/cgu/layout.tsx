import type { Metadata } from "next";
import SiteFooter from "@/components/marketing/SiteFooter";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — ECO",
  description: "Conditions générales d'utilisation de l'application ECO, la plateforme IA de transcription et résumé de cours pour étudiants.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/legal/cgu" },
};

export default function CGULayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
