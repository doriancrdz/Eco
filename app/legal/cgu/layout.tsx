import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — ECO",
  description: "Conditions générales d'utilisation de l'application ECO, la plateforme IA de transcription et résumé de cours pour étudiants.",
  robots: { index: true, follow: true },
};

export default function CGULayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
