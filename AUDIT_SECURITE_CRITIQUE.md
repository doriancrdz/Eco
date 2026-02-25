# AUDIT SÉCURITÉ CRITIQUE - ECO APP

**Date :** 23 février 2026  
**Objectif :** Vérification des 5 failles de sécurité courantes (CORS, redirections, storage, console.log, webhooks)

---

## 1️⃣ CORS GRAND OUVERT

### Vérifications effectuées
- **next.config.js** : Aucun header `Access-Control-Allow-Origin`. Uniquement des headers `Cache-Control` pour les assets statiques (.png, .jpg, .svg, .ico). ✅
- **Recherche globale** : Aucune occurrence de `Access-Control-Allow-Origin`, `CORS` ou `cors` dans le code applicatif (hors mention dans AUDIT_PRE_LANCEMENT.md). ✅
- **Routes API** : Aucun header CORS manuel avec `*`. ✅

### Statut : ✅ CONFORME
- Aucune configuration CORS « grand ouvert ».
- **Recommandation** : En cas d’ajout futur de CORS (ex. API publique), restreindre à l’origine du site : `https://econewapp.com` (et éventuellement `https://www.econewapp.com`). La configuration R2 (bucket Cloudflare) doit autoriser uniquement le domaine de l’app pour les requêtes cross-origin si nécessaire (à vérifier dans le dashboard Cloudflare).

---

## 2️⃣ REDIRECTIONS NON VALIDÉES

### Vérifications effectuées
- **router.push()** : Tous les appels utilisent des **chemins en dur** :
  - `/sign-in`, `/pricing`, `/settings`, `/settings/preferences`, `/sign-in?redirect_url=/pricing`, etc.
- **redirect_url** : Toujours une valeur **fixe** dans le code (`/pricing`, `/settings`, `/settings/preferences`). Aucune lecture de `searchParams.get('redirect')` ou équivalent pour une redirection utilisateur. ✅
- **Stripe checkout** : `success_url` et `cancel_url` sont construits avec `req.nextUrl.origin` (même origine). ✅
- **Clerk signOut** : `redirectUrl: '/sign-in'` en dur. ✅
- **API ecos** : `searchParams.get("folderId")` et `searchParams.get("limit")` servent au filtrage (folderId = ID de dossier, limit = entier borné), pas à une redirection. ✅

### Statut : ✅ CONFORME
- Aucune redirection basée sur une entrée utilisateur non contrôlée.
- **Recommandation** : Si à l’avenir une redirection après login est lue depuis la query (ex. `?redirect_url=...`), utiliser une **allowlist** de chemins autorisés (ex. `/`, `/pricing`, `/settings`, `/settings/preferences`) et rejeter toute URL absolue ou chemin non listé.

---

## 3️⃣ STORAGE PUBLIC PAR DÉFAUT

### Vérifications effectuées
- **Upload** : Utilisation d’**URLs présignées** (S3/R2) générées côté serveur avec `getSignedUrl(s3, command, { expiresIn: 600 })`. ✅
- **Expiration** : `expiresIn: 600` → **10 minutes**. ✅
- **Accès lecture** : Dans `app/api/recordings/[id]/transcribe/route.ts`, le serveur récupère l’audio depuis R2 via `GetObjectCommand` (credentials serveur). Aucune URL publique du bucket n’est exposée au client. ✅
- **Bucket R2** : La configuration (accès public ou privé) se fait dans le **dashboard Cloudflare**. Le code n’expose pas de lien direct vers le bucket ; tout passe par des URLs présignées ou par le serveur. ✅

### Statut : ✅ CONFORME (côté code)
- Accès upload et lecture cohérents avec un **bucket privé** et des **URLs présignées** à courte durée de vie.
- **Action à confirmer manuellement** : Dans Cloudflare R2, vérifier que le bucket n’a **pas** d’accès public activé (« Public Access » désactivé). Si CORS est configuré sur le bucket, limiter les origines à `https://econewapp.com` (et www si utilisé).

---

## 4️⃣ CONSOLE.LOG EN PRODUCTION

### Vérifications effectuées
- **app/page.tsx, components/** : La grande majorité des `console.log` / `console.warn` / `console.error` sont déjà conditionnés par `process.env.NODE_ENV === "development"` ou `!== "production"`. ✅
- **app/api/generate-summary, recordings/init, recordings/transcribe, recordings/complete, ecos/[id], upload-audio/presigned-url** : Logs conditionnés. ✅

### Points restants à corriger (corrections appliquées)
- **app/api/stripe/webhook/route.ts** : Plusieurs `console.error` et `console.warn` sans condition (signature, metadata, erreurs de traitement). → À conditionner pour ne pas exposer de détails en prod.
- **app/page.tsx** : Un `console.log("[processRecording] Upload R2 réussi", …)` sans condition. → À conditionner.
- **components/FolderList.tsx** : `console.error` dans les catch. → À conditionner.
- **app/api/folders/route.ts** : `console.error` dans les catch. → À conditionner.
- **app/api/transcribe/route.ts** : Plusieurs `console.log` / `console.error` non conditionnés. → À conditionner.
- **app/api/debug/pipeline/[id]/route.ts** : Route de debug ; garder ou conditionner les logs selon la politique (idéalement désactivée ou protégée en prod).

### Statut : ✅ CONFORME (corrections appliquées)
- **Corrections appliquées** : Tous les `console.*` restants ont été conditionnés (webhook Stripe, page.tsx, FolderList, folders, transcribe, debug/pipeline).
- **Recommandation** : Pour les erreurs critiques en production (ex. webhook Stripe), envisager un logger serveur (ex. Sentry, Logtail) au lieu de `console.error`, tout en évitant de logger des données sensibles.

---

## 5️⃣ WEBHOOKS NON VÉRIFIÉS

### Vérifications effectuées
- **app/api/stripe/webhook/route.ts** :
  - Corps de la requête lu en **texte brut** : `const body = await req.text()`. ✅ (requis pour la signature Stripe)
  - Récupération du header de signature : `const signature = headersList.get("stripe-signature")`. ✅
  - Refus si signature absente : `if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 })`. ✅
  - Vérification explicite : `event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)`. ✅
  - En cas d’erreur de vérification : `return NextResponse.json({ error: "Signature invalide" }, { status: 400 })`. ✅
  - Traitement des événements **uniquement après** `constructEvent` réussi. ✅
  - Vérification de la présence de `STRIPE_WEBHOOK_SECRET` avant utilisation. ✅

### Statut : ✅ CONFORME
- Le webhook Stripe est correctement sécurisé : signature vérifiée, secret obligatoire, traitement uniquement après validation.

---

# RÉSUMÉ ET ACTIONS

| Faille              | Statut   | Action |
|---------------------|----------|--------|
| 1. CORS grand ouvert | ✅ OK    | Aucune. |
| 2. Redirects non validés | ✅ OK | Aucune. Recommandation : allowlist si redirection depuis query un jour. |
| 3. Storage public   | ✅ OK (code) | Vérifier manuellement : bucket R2 privé + CORS limité au domaine. |
| 4. console.log prod | ✅ OK | Tous les `console.*` sont conditionnés par `NODE_ENV === "development"`. |
| 5. Webhooks non vérifiés | ✅ OK | Aucune. |

---

## CONCLUSION

- **CORS** : Aucune configuration à risque.
- **Redirections** : Uniquement chemins et origines contrôlés.
- **Storage** : Usage cohérent avec bucket privé et URLs présignées (10 min).
- **Console** : Sécurisation à terminer en conditionnant les derniers logs (voir corrections ci-dessous).
- **Webhook Stripe** : Signature et secret correctement utilisés.

Les derniers `console.*` ont été conditionnés. Il reste à confirmer en production que le bucket R2 est bien privé et que les origines CORS sont restreintes au domaine de l’app. L’application est alignée avec les bonnes pratiques ciblées par cet audit.
