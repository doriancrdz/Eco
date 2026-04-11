"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function MentionsLegalesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          type="button"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Retour</span>
        </button>
        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-8">Mentions légales</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : février 2026</p>
        <div className="prose prose-lg max-w-none">
          <p>
            Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie
            numérique (LCEN), sont indiquées ci-après les informations relatives à l&apos;éditeur et à l&apos;hébergement
            du site <strong>ECO</strong>.
          </p>

          <h2>1. Éditeur du site</h2>
          <p>
            Le site <a href="https://econewapp.com" className="text-blue-600 hover:underline">econewapp.com</a> est
            édité par :<br />
            <strong>ECO</strong><br />
            Siège social : 21 rue de la fédération, 75015 Paris, France
          </p>

          <h2>2. Directeur de la publication</h2>
          <p>
            Le directeur de la publication est ECO.
          </p>

          <h2>3. Contact</h2>
          <p>
            Pour toute demande : <a href="mailto:support@econewapp.com" className="text-blue-600 hover:underline">support@econewapp.com</a>.
          </p>

          <h2>4. Hébergement</h2>
          <p>
            Le site est hébergé par :<br />
            <strong>Vercel Inc.</strong><br />
            340 S Lemon Ave #4133<br />
            Walnut, CA 91789, USA
          </p>

          <h2>5. Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble du site (textes, visuels, logiciels, marques) est protégé par le droit de la propriété
            intellectuelle. Toute reproduction ou utilisation non autorisée peut constituer une contrefaçon.
          </p>

          <h2>6. Liens et contenus</h2>
          <p>
            Les liens vers des sites tiers ne engagent pas la responsabilité de l&apos;éditeur. L&apos;utilisation
            du site est régie par les{" "}
            <Link href="/legal/cgu" className="text-blue-600 hover:underline">Conditions Générales d&apos;Utilisation</Link>{" "}
            et, le cas échéant, les{" "}
            <Link href="/legal/cgv" className="text-blue-600 hover:underline">Conditions Générales de Vente</Link>.
          </p>

          <h2>7. Données personnelles</h2>
          <p>
            Les traitements de données sont décrits dans la{" "}
            <Link href="/legal/confidentialite" className="text-blue-600 hover:underline">Politique de confidentialité</Link>.
          </p>
        </div>
        <p className="mt-8 text-sm text-gray-500">
          <Link href="/" className="text-blue-600 hover:underline">← Retour à l&apos;accueil</Link>
        </p>
        </div>
      </div>
    </div>
  );
}
