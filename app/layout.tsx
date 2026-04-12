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
  title: "ECO — Tes cours audio, transformés en notes",
  description: "Transforme tes cours audio en résumé, quiz et points clés en 30 secondes.",
  openGraph: {
    title: "ECO — Tes cours audio, transformés en notes",
    description: "Transforme tes cours audio en résumé, quiz et points clés en 30 secondes.",
    url: "https://econewapp.com",
    siteName: "ECO",
    type: "website",
    images: [
      {
        url: "https://econewapp.com/og.png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ECO — Tes cours audio, transformés en notes",
    description: "Transforme tes cours audio en résumé, quiz et points clés en 30 secondes.",
    images: ["https://econewapp.com/og.png"],
  },
  themeColor: "#7dd3fc",
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
