import Link from "next/link";

export const metadata = {
  title: "Conditions Générales de Vente | ECO",
  description: "Conditions générales de vente des abonnements et packs ECO",
};

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-8">Conditions Générales de Vente</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : février 2026</p>
        <div className="prose prose-lg max-w-none">
          <h2>1. Objet</h2>
          <p>
            Les présentes Conditions Générales de Vente (CGV) s&apos;appliquent aux abonnements et achats de packs
            proposés par ECO dans le cadre du service <strong>ECO</strong> (econewapp.com).
            Elles complètent les{" "}
            <Link href="/legal/cgu" className="text-blue-600 hover:underline">Conditions Générales d&apos;Utilisation</Link>.
          </p>

          <h2>2. Offres et tarifs</h2>
          <p>
            Les offres (abonnements Student, Pro, packs de minutes, etc.) et leurs prix sont indiqués sur la page
            Tarifs du site. Les prix sont en euros TTC. L&apos;éditeur se réserve le droit de modifier les tarifs
            en communiquant préalablement aux utilisateurs ; les tarifs en vigueur au moment de la commande restent
            applicables pour la période déjà payée.
          </p>

          <h2>3. Paiement</h2>
          <p>
            Les paiements sont traités par <strong>Stripe Inc.</strong>. Les moyens de paiement acceptés sont ceux
            proposés sur l&apos;interface (carte bancaire, etc.). Les débits sont effectués selon la périodicité
            choisie (mensuel ou annuel pour les abonnements). En cas d&apos;échec de paiement, l&apos;éditeur
            pourra suspendre l&apos;accès aux fonctionnalités payantes après relance.
          </p>

          <h2>4. Remboursements</h2>
          <p>
            Conformément à la réglementation, vous disposez d&apos;un délai de rétractation de 14 jours à compter
            de la souscription pour les contrats à distance. Passé ce délai, les abonnements et achats de packs
            sont fermes et définitifs, sauf disposition légale contraire ou erreur de facturation. En cas de
            rétractation dans le délai légal, le remboursement sera effectué dans un délai raisonnable.
          </p>

          <h2>5. Résiliation et annulation</h2>
          <p>
            Vous pouvez résilier votre abonnement à tout moment depuis les paramètres de votre compte. La résiliation
            prend effet en fin de période déjà facturée ; aucun prorata temporis n&apos;est accordé. Les packs
            de minutes déjà achetés restent utilisables jusqu&apos;à épuisement ou expiration selon les conditions
            indiquées à l&apos;achat. L&apos;éditeur se réserve le droit de mettre fin à un abonnement en cas
            de manquement aux CGU/CGV ou de non-paiement.
          </p>

          <h2>6. Facturation</h2>
          <p>
            Une facture ou un reçu est disponible dans votre espace compte ou par email selon les modalités du
            prestataire de paiement. En cas de litige sur une facturation, contactez{" "}
            <a href="mailto:econewapp@gmail.com" className="text-blue-600 hover:underline">econewapp@gmail.com</a>.
          </p>

          <h2>7. Droit applicable</h2>
          <p>
            Les présentes CGV sont régies par le droit français. Les litiges relèvent des tribunaux compétents
            en France.
          </p>

          <h2>8. Contact</h2>
          <p>
            Pour toute question relative aux CGV :{" "}
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
