export interface Article {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  content: string;
}

export const articles: Article[] = [
  {
    slug: "enregistrer-cours-efficacement",
    title: "Comment enregistrer ses cours et les réviser 2x plus vite",
    description: "Découvre comment l'enregistrement audio combiné à l'IA peut transformer ta façon de réviser.",
    date: "2026-04-30",
    readTime: "5 min",
    content: `Tu connais cette situation : le prof enchaîne les explications, tu griffonnes en vitesse, et 30 minutes plus tard tes notes ressemblent à un brouillon illisible. Deux semaines avant les partiels, tu réalises que tu as manqué la moitié des points clés. C'est le problème numéro un des étudiants — et il existe une solution concrète.

## Le problème de la prise de notes classique

Écrire à la main ou taper sur un clavier pendant un cours oblige ton cerveau à faire deux choses en même temps : écouter et transcrire. Résultat ? Tu n'écoutes pas vraiment. Tu filtres, tu résumes à la volée, et tu rates inévitablement des nuances importantes.

Des chercheurs de Princeton ont montré que les étudiants qui prennent des notes sur ordinateur retranscrivent presque mot pour mot sans vraiment traiter l'information. Ceux qui essaient d'aller trop vite à la main résument mal et oublient le contexte. Dans les deux cas, la compréhension profonde est sacrifiée.

Le vrai problème n'est pas *comment* tu notes — c'est que tu ne peux pas noter et écouter efficacement en même temps.

## Pourquoi enregistrer ses cours change tout

**Enregistrer ton cours** te libère complètement de cette contrainte. Tu peux enfin te concentrer à 100 % sur ce que dit ton professeur : poser des questions, suivre le fil du raisonnement, participer activement. Être vraiment présent.

L'enregistrement audio capture tout ce que tu aurais loupé en griffonnant :
- Les exemples donnés oralement qui illustrent un concept abstrait
- Les formulations du prof qui tombent parfois à l'examen
- Les insistances ("retenez bien ça", "ça revient souvent")
- Le contexte qui donne du sens aux notions isolées

Contrairement à des notes incomplètes, un enregistrement est exhaustif. Tu peux revenir sur un passage précis, réécouter une explication à ton rythme, ne jamais perdre d'information. Pour les **application étudiants** qui gèrent des emplois du temps chargés, c'est un gain de fiabilité énorme.

Les bénéfices concrets sont immédiats : meilleure compréhension en cours, zéro perte d'information, révisions plus flexibles et moins de stress le soir même.

## Les limites de l'enregistrement seul

Enregistrer, c'est bien. Mais 2 heures d'audio à réécouter avant les partiels, c'est une autre paire de manches. Si tu dois réécouter intégralement chaque cours, tu passes autant de temps que pendant les heures de classe — sans le bénéfice de la présence du prof pour répondre à tes questions.

L'audio brut est un trésor inaccessible si tu n'as pas les outils pour l'exploiter rapidement. C'est là qu'intervient la vraie révolution.

## Comment l'IA transforme tes enregistrements en fiches de révision

Avec une **prise de notes IA**, l'enregistrement n'est que la première étape. L'intelligence artificielle prend le relais pour transformer 60 minutes d'audio en contenu de révision structuré en quelques secondes.

Concrètement, voici ce que génère automatiquement une bonne application étudiants comme ECO :

**Un résumé automatique structuré.** Ton cours est analysé et découpé en sections thématiques avec des titres clairs. Pas un copier-coller de la transcription — une vraie synthèse qui met en valeur les idées principales et leur enchaînement logique.

**Des points clés avec définitions.** Les notions importantes sont extraites et explicitées. Idéal pour réviser rapidement les concepts fondamentaux avant un contrôle.

**Un quiz révision personnalisé.** Des questions QCM et ouvertes générées directement depuis le contenu de ton cours. La méthode de l'*active recall* — scientifiquement reconnue comme la technique de révision la plus efficace pour ancrer les connaissances.

**La transcription complète.** Accès mot pour mot à tout ce qui a été dit. Plus besoin de réécouter 2 heures : tu recherches directement le terme ou le passage qui t'intéresse.

Ce qui prenait 3 heures de travail manuel se fait automatiquement. Et souvent avec une meilleure qualité que ce que tu aurais produit toi-même après une longue journée de cours.

## La méthode optimale : enregistrer + résumé auto + quiz

Voici le workflow que des milliers d'étudiants utilisent au quotidien pour réviser 2x plus vite :

**Pendant le cours :** Lance l'**enregistrement cours** au début, pose ton téléphone, et concentre-toi. Prends quelques notes manuscrites pour les schémas et formules que l'audio ne capturera pas. C'est tout.

**Dans les 30 minutes qui suivent :** Parcours le résumé automatique généré par l'IA. C'est ta première révision — rapide, structurée, efficace. Tu identifies immédiatement les points que tu n'as pas compris et tu peux poser des questions par mail avant d'oublier.

**Avant les partiels :** Lance le **quiz révision** généré depuis ton cours. Les questions portent exactement sur les concepts abordés par *ton* professeur, avec *ses* exemples. C'est une révision active ciblée sur ce qui sera vraiment évalué.

**En cas de doute :** La transcription complète te permet de retrouver le passage exact en quelques secondes. Plus besoin de réécouter — tu cherches directement le terme.

Cette méthode combine écoute active, révision espacée et active recall. Ce sont exactement les trois piliers recommandés par les sciences cognitives pour maximiser la rétention à long terme.

## Ce que ça change concrètement

Les étudiants qui adoptent cette méthode constatent souvent les mêmes effets : moins de stress la veille des examens, de meilleures notes sur les matières à fort contenu oral (économie, droit, histoire, médecine), et surtout un sentiment de maîtrise plutôt que de noyade dans les révisions.

Deux heures de cours magistral denses deviennent 15 minutes de révision active. Le reste du temps peut être consacré à des exercices pratiques, à comprendre les points difficiles, ou tout simplement à autre chose.

## Conclusion

La prise de notes classique t'oblige à choisir entre écouter et noter. L'**enregistrement cours** couplé à la **prise de notes IA** te permet de faire les deux — et bien mieux que tu ne le ferais seul.

Si tu veux tester cette approche, ECO te permet d'enregistrer jusqu'à 60 minutes d'audio et de générer automatiquement un résumé structuré, des points clés, un quiz et une transcription complète. Gratuit pour commencer, sans carte bancaire nécessaire.

Ton prochain cours est dans combien de temps ?
`,
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
