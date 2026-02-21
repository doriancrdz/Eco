"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function ConfidentialitePage() {
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
        <h1 className="text-4xl font-bold mb-8">Politique de confidentialité</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : février 2026</p>
        <div className="prose prose-lg max-w-none">
          <p>
            La présente politique décrit comment <strong>ECO</strong> (econewapp.com) collecte et traite vos données
            personnelles, dans le respect du Règlement général sur la protection des données (RGPD) et de la loi
            française « Informatique et Libertés ».
          </p>

          <h2>1. Responsable du traitement</h2>
          <p>
            Le responsable du traitement est ECO, siège social : 21 rue de la fédération, 75015 Paris, France. Contact :{" "}
            <a href="mailto:econewapp@gmail.com" className="text-blue-600 hover:underline">econewapp@gmail.com</a>.
          </p>

          <h2>2. Données collectées</h2>
          <p>Nous sommes susceptibles de collecter :</p>
          <ul>
            <li><strong>Identité et contact</strong> : email, nom (si fourni), identifiant de compte (ex. Clerk).</li>
            <li><strong>Données d&apos;usage</strong> : connexion, pages vues, actions dans l&apos;application.</li>
            <li><strong>Contenus créés</strong> : enregistrements audio que vous uploadez ou enregistrez, transcriptions
              et textes générés par l&apos;IA (notes, synthèses).</li>
            <li><strong>Données de facturation</strong> : statut d&apos;abonnement, historique de paiement (traité par Stripe).</li>
          </ul>

          <h2>3. Finalités et bases légales</h2>
          <p>
            Les données sont traitées pour : fourniture du Service (exécution du contrat), authentification et
            gestion du compte, traitement de la voix et génération de contenus (contrat), facturation (obligation
            légale / contrat), amélioration du service et support (intérêt légitime), et, le cas échéant, prospection
            (avec votre consentement). Les enregistrements et transcriptions sont utilisés uniquement pour vous
            fournir les fonctionnalités demandées et ne sont pas utilisés pour entraîner des modèles tiers sans
            votre accord explicite.
          </p>

          <h2>4. Sous-traitants et transferts</h2>
          <p>
            Nous nous appuyons sur des prestataires techniques qui peuvent traiter vos données : hébergement du site
            (<strong>Vercel Inc.</strong>, USA), base de données (<strong>Neon PostgreSQL</strong>), stockage des
            fichiers audio (<strong>Cloudflare R2</strong>), paiements (<strong>Stripe Inc.</strong>), authentification
            (ex. Clerk), et API d&apos;intelligence artificielle (<strong>OpenAI</strong> — Whisper, GPT-4o-mini).
            Les transferts hors UE/EEE sont encadrés par les clauses types ou mécanismes reconnus (ex. décision
            d&apos;adéquation, garanties appropriées).
          </p>

          <h2>5. Durée de conservation</h2>
          <p>
            Les données de compte et de facturation sont conservées pendant la durée de la relation contractuelle
            puis pour les obligations légales (ex. comptabilité). Les enregistrements et transcriptions sont
            conservés tant que vous les conservez dans votre compte ; vous pouvez les supprimer à tout moment.
            En cas de suppression de compte, nous supprimons ou anonymisons les données dans un délai raisonnable,
            sauf conservation légale.
          </p>

          <h2>6. Vos droits (RGPD)</h2>
          <p>
            Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation du
            traitement, de portabilité et d&apos;opposition, ainsi que du droit de définir des directives
            relatives au sort de vos données après votre décès. Pour les exercer :{" "}
            <a href="mailto:econewapp@gmail.com" className="text-blue-600 hover:underline">econewapp@gmail.com</a>.
            Vous avez le droit d&apos;introduire une réclamation auprès de la CNIL (cnil.fr).
          </p>

          <h2>7. Sécurité</h2>
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées (accès restreint,
            chiffrement, hébergement sécurisé) pour protéger vos données contre l&apos;accès non autorisé, la
            perte ou l&apos;altération.
          </p>

          <h2>8. Cookies et traceurs</h2>
          <p>
            Le site peut utiliser des cookies ou traceurs nécessaires au fonctionnement (session, préférences)
            et, le cas échéant, des cookies analytiques sous réserve de votre consentement lorsque la réglementation
            l&apos;exige.
          </p>

          <h2>9. Modifications</h2>
          <p>
            Toute modification substantielle de cette politique sera portée à votre connaissance (email ou
            notification dans l&apos;application) et publiée sur cette page.
          </p>

          <h2>10. Contact</h2>
          <p>
            Pour toute question :{" "}
            <a href="mailto:econewapp@gmail.com" className="text-blue-600 hover:underline">econewapp@gmail.com</a>.
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
