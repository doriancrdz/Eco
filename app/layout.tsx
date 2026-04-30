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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" href="/logo-eco-v2.png" as="image" />
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
