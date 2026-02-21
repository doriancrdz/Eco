import Link from "next/link";

export const metadata = {
  title: "Conditions Générales d'Utilisation | ECO",
  description: "Conditions générales d'utilisation du service ECO",
};

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-8">Conditions Générales d&apos;Utilisation</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : février 2026</p>
        <div className="prose prose-lg max-w-none">
          <h2>1. Objet et acceptation</h2>
          <p>
            Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;accès et l&apos;utilisation
            de l&apos;application <strong>ECO</strong> (ci-après « le Service »), accessible notamment à l&apos;adresse{" "}
            <a href="https://econewapp.com" className="text-blue-600 hover:underline">econewapp.com</a>.
            En utilisant le Service, vous acceptez sans réserve les présentes CGU.
          </p>

          <h2>2. Éditeur du Service</h2>
          <p>
            Le Service est édité par ECO, dont le siège social est situé au 21 rue de la fédération, 75015 Paris, France.
            Contact : <a href="mailto:econewapp@gmail.com" className="text-blue-600 hover:underline">econewapp@gmail.com</a>.
          </p>

          <h2>3. Description du Service</h2>
          <p>
            ECO est une application de dictaphone intelligent permettant de transformer la voix en contenu structuré
            (notes, transcriptions, synthèses) via des technologies d&apos;intelligence artificielle. Le Service propose
            des offres gratuites et payantes (abonnements et packs).
          </p>

          <h2>4. Inscription et compte utilisateur</h2>
          <p>
            L&apos;utilisation de certaines fonctionnalités peut nécessiter la création d&apos;un compte. Vous vous engagez
            à fournir des informations exactes et à maintenir la confidentialité de vos identifiants. Vous êtes responsable
            des activités réalisées depuis votre compte.
          </p>

          <h2>5. Utilisation du Service</h2>
          <p>
            Vous vous engagez à utiliser le Service conformément aux lois en vigueur et à ne pas en faire un usage
            illicite, frauduleux ou de nature à nuire à autrui ou au fonctionnement du Service. Sont notamment interdits
            le contournement des limitations techniques, l&apos;extraction massive de données et toute utilisation
            contraire à l&apos;éthique ou aux bonnes mœurs.
          </p>

          <h2>6. Propriété intellectuelle</h2>
          <p>
            Le Service, incluant mais sans s&apos;y limiter les logiciels, textes, visuels, marques et bases de données,
            est protégé par le droit de la propriété intellectuelle. L&apos;éditeur en conserve l&apos;intégralité des droits.
            Vous ne disposez que d&apos;un droit d&apos;usage personnel et non exclusif. Les contenus que vous créez
            (enregistrements, transcriptions) restent votre propriété ; vous accordez à l&apos;éditeur les droits
            nécessaires pour assurer le fonctionnement du Service (stockage, traitement, affichage).
          </p>

          <h2>7. Données personnelles</h2>
          <p>
            Le traitement des données personnelles est décrit dans la{" "}
            <Link href="/legal/confidentialite" className="text-blue-600 hover:underline">Politique de confidentialité</Link>.
            En utilisant le Service, vous acceptez ce traitement dans le respect du RGPD.
          </p>

          <h2>8. Disponibilité et évolution</h2>
          <p>
            L&apos;éditeur s&apos;efforce d&apos;assurer la disponibilité du Service mais ne garantit pas une continuité
            sans interruption. Le Service peut être modifié, suspendu ou interrompu à tout moment, sous réserve des
            droits des utilisateurs ayant souscrit à une offre payante conformément aux CGV.
          </p>

          <h2>9. Responsabilité</h2>
          <p>
            Dans les limites autorisées par la loi, l&apos;éditeur ne peut être tenu responsable des dommages indirects,
            des pertes de données ou de l&apos;usage des contenus générés par l&apos;IA. La responsabilité de l&apos;éditeur
            est limitée au montant des sommes effectivement versées par l&apos;utilisateur au titre du Service sur les
            douze derniers mois.
          </p>

          <h2>10. Résiliation</h2>
          <p>
            Vous pouvez cesser d&apos;utiliser le Service à tout moment. L&apos;éditeur se réserve le droit de suspendre
            ou résilier l&apos;accès en cas de violation des présentes CGU. Les dispositions relatives à la résiliation
            des abonnements payants sont définies dans les{" "}
            <Link href="/legal/cgv" className="text-blue-600 hover:underline">Conditions Générales de Vente</Link>.
          </p>

          <h2>11. Droit applicable et litiges</h2>
          <p>
            Les présentes CGU sont régies par le droit français. En cas de litige, les tribunaux français seront
            seuls compétents après tentative de résolution amiable.
          </p>

          <h2>12. Contact</h2>
          <p>
            Pour toute question relative aux CGU :{" "}
            <a href="mailto:econewapp@gmail.com" className="text-blue-600 hover:underline">econewapp@gmail.com</a>.
          </p>
        </div>
        <p className="mt-8 text-sm text-gray-500">
          <Link href="/" className="text-blue-600 hover:underline">← Retour à l&apos;accueil</Link>
        </p>
      </div>
    </div>
  );
}
