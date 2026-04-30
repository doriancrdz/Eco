import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: "ECO — Transforme tes cours en résumés, quiz et fiches automatiques",
  description: "Enregistre tes cours, ECO génère automatiquement un résumé structuré, des points clés, un quiz et une transcription grâce à l'IA. Essaie gratuitement.",
  keywords: ["enregistrer cours", "résumé automatique", "quiz IA", "transcription cours", "application étudiants", "prise de notes IA", "fiches de révision automatiques"],
  alternates: {
    canonical: "https://econewapp.com",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "ECO — Transforme tes cours en résumés, quiz et fiches automatiques",
    description: "Enregistre tes cours, ECO génère automatiquement un résumé structuré, des points clés, un quiz et une transcription grâce à l'IA. Essaie gratuitement.",
    url: "https://econewapp.com",
    siteName: "ECO",
    type: "website",
    locale: "fr_FR",
    images: [
      {
        url: "https://econewapp.com/og.png",
        width: 1200,
        height: 630,
        alt: "ECO — Application IA pour transformer tes cours en notes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ECO — Transforme tes cours en résumés, quiz et fiches automatiques",
    description: "Enregistre tes cours, ECO génère automatiquement un résumé structuré, des points clés, un quiz et une transcription grâce à l'IA.",
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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" href="/logo-eco-v2.png" as="image" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareApplication",
                "name": "ECO",
                "url": "https://econewapp.com",
                "applicationCategory": "EducationalApplication",
                "operatingSystem": "Web",
                "description": "Enregistre tes cours et génère automatiquement résumés, quiz et transcriptions grâce à l'IA.",
                "offers": { "@type": "Offer", "price": "19", "priceCurrency": "EUR" },
                "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "50" },
              },
              {
                "@type": "Organization",
                "name": "ECO",
                "url": "https://econewapp.com",
                "logo": "https://econewapp.com/logo-eco-v2.png",
                "contactPoint": { "@type": "ContactPoint", "email": "support@econewapp.com", "contactType": "customer support" },
              },
            ],
          }) }}
        />
      </head>
      <body className={`${inter.className} aura-gradient`}>
          <ClerkProvider>
            {children}
            <Footer />
            <Toaster
              position="bottom-right"
              theme="dark"
              richColors
              closeButton
              duration={4000}
              toastOptions={{
                style: {
                  background: "#141619",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "#EDECE8",
                },
                classNames: {
                  toast: "rounded-2xl shadow-xl",
                },
              }}
            />
          </ClerkProvider>
      </body>
    </html>
  );
}
