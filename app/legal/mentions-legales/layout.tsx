import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — ECO",
  description: "Mentions légales de l'application ECO — éditeur, hébergement et propriété intellectuelle.",
  robots: { index: true, follow: true },
};

export default function MentionsLegalesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
