import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

export const viewport: Viewport = {
  themeColor: "#09090B",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ECO — Transforme tes cours en résumés, quiz et fiches automatiques",
  description: "Enregistre tes cours, ECO génère automatiquement un résumé structuré, des points clés, un quiz et une transcription grâce à l'IA. Essaie gratuitement.",
  keywords: ["enregistrer cours", "résumé automatique", "quiz IA", "transcription cours", "application étudiants", "prise de notes IA", "fiches de révision automatiques"],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "ECO — Transforme tes cours en résumés, quiz et fiches automatiques",
    description: "Enregistre tes cours, ECO génère automatiquement un résumé structuré, des points clés, un quiz et une transcription grâce à l'IA. Essaie gratuitement.",
    url: "/",
    siteName: "ECO",
    type: "website",
    locale: "fr_FR",
    images: [
      {
        url: "/og.png",
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
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareApplication",
                "name": "ECO",
                "url": SITE_URL,
                "applicationCategory": "EducationalApplication",
                "operatingSystem": "Web",
                "description": "Enregistre tes cours et génère automatiquement résumés, quiz et transcriptions grâce à l'IA.",
                "offers": { "@type": "Offer", "price": "19", "priceCurrency": "EUR" },
                "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "50" },
              },
              {
                "@type": "Organization",
                "name": "ECO",
                "url": SITE_URL,
                "logo": `${SITE_URL}/logo-eco-v2.png`,
                "contactPoint": { "@type": "ContactPoint", "email": "support@econewapp.com", "contactType": "customer support" },
              },
            ],
          }) }}
        />
      </head>
      <body className={inter.className}>
          <ClerkProvider
            signInFallbackRedirectUrl="/app"
            signUpFallbackRedirectUrl="/app"
            afterSignOutUrl="/"
            appearance={{
              variables: {
                colorPrimary: "#EDECE8",
                colorTextOnPrimaryBackground: "#0A0A0B",
                colorBackground: "#111113",
                colorText: "#EDECE8",
                colorTextSecondary: "#9A9893",
                colorInputBackground: "#17171A",
                colorInputText: "#EDECE8",
                colorNeutral: "#EDECE8",
                colorDanger: "#FCA5A5",
                borderRadius: "12px",
                fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
              },
              elements: {
                card: { border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 40px 100px -40px rgba(0,0,0,0.9)" },
                formButtonPrimary: { fontWeight: 500, textTransform: "none", boxShadow: "none" },
                footerActionLink: { color: "#C9B8FF" },
              },
            }}
          >
            {children}
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
