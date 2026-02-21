import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: "ECO - Dictaphone IA",
  description: "Transformez votre voix en connaissance structurée",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" href="/logo-eco.png" as="image" />
      </head>
      <body className={`${inter.className} aura-gradient`}>
        <ClerkProvider>
          {children}
          <Footer />
        </ClerkProvider>
      </body>
    </html>
  );
}
