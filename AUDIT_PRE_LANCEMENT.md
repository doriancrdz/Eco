# AUDIT PRE-LANCEMENT - ECO APP

**Date :** 23 février 2026  
**Objectif :** Vérification complète avant mise en production

---

## ✅ CONFORME (tout fonctionne)

### 1. RÈGLES DES RÉSUMÉS IA
- ✅ **Résumé = 16%** : `targetSummaryWords = Math.round(transcriptionWordCount * 0.16)` (ligne 170)
- ✅ **Points clés** : `Math.max(1, Math.round(transcriptionWordCount / 800))` (ligne 174)
- ✅ **Notions** : `Math.max(1, Math.round(transcriptionWordCount / 550))` (ligne 176)
- ✅ **Structure avec sauts de ligne** : Prompt exige `\n\n` entre intro/dév/conclu (lignes 230-256)
- ✅ **Pas de titres "**INTRODUCTION**"** : Connecteurs naturels uniquement ("Dans cet enregistrement,", etc.)
- ✅ **max_tokens** : `Math.max(3000, Math.ceil(estimatedTokens + 1000))` — suffisant (ligne 179)
- ✅ **Validation post-génération** : Warnings si hors cible (lignes 381-388)

### 2. NAVIGATION
- ✅ **Logo ECO (header/sidebar)** → `onGoHome("logo")` / `onNavigateHome?.("logo")`
- ✅ **Flèche retour EcoView** → `onBack` = `resetToHome`
- ✅ **Bouton "Retour à l'accueil"** dans EcoView (ligne 396-402)
- ✅ **Bouton "Gérer mon plan"** → `/settings` pour plans payants, `/pricing` pour free (page.tsx 757, 751)
- ✅ **Guide d'utilisation** → GuideDropdown s'ouvre/ferme (useState + click outside)
- ✅ **Avatar** → `onAvatarClick` → `setShowProfile(true)`
- ✅ **Sidebar** : Accueil, Abonnement (/pricing), Paramètres (/settings/preferences)
- ✅ **Supprimer ECO** → EcoItem avec Dialog de confirmation, appel DELETE /api/ecos/[id]
- ✅ **Partager** → `navigator.share` ou fallback `clipboard.writeText` (page.tsx 668-683)
- ✅ **Dossiers** : création (FolderList handleAdd), édition (FolderItem), suppression (folders API)

### 3. ENREGISTREMENTS
- ✅ **Clic micro** → `startRecording()` → MediaRecorder
- ✅ **Durée max 60 min** : `MAX_RECORDING_DURATION_MINUTES = 60`, vérifié dans `confirmStop` (ligne 418)
- ✅ **Terminer** → `confirmStop` → `processRecording` avec upload R2
- ✅ **Upload R2** : presigned URL + PUT direct
- ✅ **Débit minutes** : `debitRecordingSeconds` dans complete (plan puis bonusSeconds)
- ✅ **Quota dépassé** : Erreur 403 "Quota insuffisant" (complete route)
- ✅ **Transcription + résumé** : Pipeline completeAndTranscribeFromR2 + generate-summary
- ✅ **ECO créé** : POST /api/ecos avec recordingId
- ✅ **Affichage immédiat** : `setSelectedEco(newEco.id)` + `eco-updated` event
- ✅ **Audio** : URL R2 ou blob, lecture via audio_url

### 4. PAIEMENTS STRIPE
- ✅ **Boutons plans** → `doCheckout` → redirect Stripe Checkout
- ✅ **Boutons packs** → `handlePackSelect` → redirect Stripe Checkout
- ✅ **Webhook** : checkout.session.completed, invoice.payment_succeeded, customer.subscription.deleted
- ✅ **checkout.session.completed** : subscription → updateUserPlan + updateUserQuotaTotal ; pack → creditBonusSeconds
- ✅ **invoice.payment_succeeded** : subscriptionStatus + currentPeriodEnd
- ✅ **customer.subscription.deleted** : downgrade vers Free
- ✅ **Packs** : creditBonusSeconds (permanent)
- ✅ **Résiliation mensuel** : API /api/billing/cancel (cancel_at_period_end)
- ✅ **Plans annuels** : canCancel = false si annual/commit
- ✅ **Variables** : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET utilisées côté serveur uniquement

### 5. RATE LIMITING
- ✅ **Upstash Redis** : UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
- ✅ **recordingLimiter** : 10 / heure (slidingWindow)
- ✅ **transcriptionLimiter** : 3 / minute
- ✅ **uploadLimiter** : 5 / minute
- ✅ **Erreur 429** : Messages clairs ("Trop d'enregistrements...", etc.)
- ✅ **Headers X-RateLimit-*** : init et transcribe les retournent ; upload ne les retourne pas (voir ⚠️)

### 6. SÉCURITÉ
- ✅ **Clés secrètes** : OPENAI_API_KEY, STRIPE_SECRET_KEY uniquement côté serveur
- ✅ **NEXT_PUBLIC_*** : Clerk, Stripe publishable
- ✅ **Auth Clerk** : `await auth()` sur routes API sensibles
- ✅ **Validation** : durée max 60 min, taille fichier (24MB transcribe), quota
- ✅ **HTTPS** : Vercel par défaut

### 7. PAGES LÉGALES
- ✅ **CGU** (/legal/cgu) : Complète, éditeur ECO, 21 rue de la fédération, econewapp@gmail.com
- ✅ **CGV** (/legal/cgv) : Complète
- ✅ **Confidentialité** (/legal/confidentialite) : RGPD, responsable, droits, sous-traitants
- ✅ **Mentions légales** (/legal/mentions-legales) : Éditeur, siège, contact, hébergement
- ✅ **Footer** : Liens CGU, CGV, Confidentialité, Mentions légales (layout.tsx)
- ✅ **Bouton retour** : router.back() sur chaque page légale
- ✅ **Email** : econewapp@gmail.com partout
- ✅ **Siège** : 21 rue de la fédération, 75015 Paris

### 8. PERFORMANCES
- ✅ **React.memo** : PlanCard, PackCard
- ✅ **useMemo** : plansEntries, packsArray (pricing)
- ✅ **Lazy loading** : FocusMode, Sidebar, ProfileView, PricingFAQ, TestimonialsMarquee
- ✅ **next/image** : Logo dans Header
- ✅ **Debounce** : loadEcos (300ms), refreshCurrentEco (500ms)
- ✅ **Cache sessionStorage** : eco_billing_plan pour éviter flash
- ⚠️ **console.log** : Présents en dev (NODE_ENV !== "production") ; certains restent en prod (voir ⚠️)

### 9. UX/UI
- ✅ **Logo centré** : Bouton sans scale au hover (center logo)
- ✅ **Avatar** : UserAvatar avec initiale
- ✅ **Guide dropdown** : Fonctionnel
- ✅ **Bouton retour** : Visible dans EcoView
- ✅ **Durée** : Affichée sous la date si duration_seconds > 0
- ✅ **Résumé** : whitespace-pre-line pour sauts de ligne
- ✅ **Messages d'erreur** : quota, rate limit, upload
- ✅ **Loading states** : isProcessing, isBillingLoading, etc.
- ✅ **Responsive** : Classes md:, lg:

### 10. BASE DE DONNÉES
- ✅ **bonusSeconds** : Présent, creditBonusSeconds, jamais reset
- ✅ **Reset** : currentPeriodEnd (date anniversaire) ou monthKey (legacy free)
- ✅ **Débit** : plan puis bonus (usage.ts debitRecordingSeconds)
- ✅ **Recording** : userId, r2Key, fileId
- ✅ **Indexes** : userId, status, aiStatus, createdAt, etc.
- ✅ **Transactions** : debitRecordingSeconds en $transaction
- ✅ **UsageEvent** : recordingId @unique (idempotence)

---

## ⚠️ ATTENTION (à surveiller)

### 1. Headers X-RateLimit sur upload
**Fichier :** `app/api/upload-audio/presigned-url/route.ts`  
**Problème :** En cas de 429, la réponse ne contient pas les headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (contrairement à init et transcribe).  
**Impact :** Faible — le client reçoit bien l'erreur 429 et le message.

### 2. console.log en production
**Fichiers :** Plusieurs routes API (generate-summary, recordings, ecos, etc.)  
**Problème :** Des `console.log` et `console.warn` sont exécutés même en production (ex. `[generate-summary]`, `[recordings/init]`).  
**Recommandation :** Encapsuler dans `if (process.env.NODE_ENV !== "production")` ou utiliser un logger conditionnel.

### 3. Bouton "Archiver" dans EcoItem
**Fichier :** `components/EcoItem.tsx`  
**Problème :** Le menu contextuel propose "Renommer", "Déplacer vers…", "Supprimer" mais pas "Archiver". L'archivage existe (Eco.archived, settings/preferences) mais n'est pas accessible depuis la sidebar.  
**Impact :** L'audit demandait "Bouton Archiver" — fonctionnalité partielle (uniquement via Paramètres > Archiver tout).

### 4. Suppression ECO vs Recording
**Fichier :** `app/api/ecos/[id]/route.ts` DELETE  
**Problème :** La suppression d'un ECO supprime uniquement l'entrée Eco, pas le Recording (ni les fichiers R2).  
**Impact :** Données orphelines en base ; possible intention pour audit. À valider.

### 5. Incohérence .env PACKS
**Fichiers :** `.env.example`, `lib/billingConfig.ts`  
**Problème :** billingConfig PACKS = 800, 2000, 6000 min → STRIPE_PRICE_PACK_800, etc. ; .env.example montre 120, 600, 3000.  
**Recommandation :** Aligner .env.example sur PACKS réels (800, 2000, 6000).

---

## ❌ CRITIQUE (à corriger AVANT lancement)

**Aucun bug bloquant détecté.** L'application est fonctionnellement prête.

---

## RECOMMANDATIONS

1. **Test manuel Stripe** : Vérifier un checkout complet (subscription + pack) en mode test, puis webhook en prod.
2. **Test manuel enregistrement** : Enregistrer 1 min, vérifier transcription + résumé 16%, points clés, notions.
3. **Variables Vercel** : Confirmer que toutes les variables (.env.example) sont définies en production, notamment :
   - UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
   - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
   - STRIPE_WEBHOOK_SECRET (avec l'URL de prod)
   - Tous les STRIPE_PRICE_* pour les plans et packs réels
4. **CORS R2** : Si econewapp.com utilise un domaine personnalisé, vérifier la config CORS du bucket R2.
5. **Migration Prisma** : Exécuter `prisma migrate deploy` avant le premier déploiement prod.

---

## CONCLUSION

### ✅ PRÊT POUR LE LANCEMENT

L'audit ne révèle **aucun problème bloquant**. Les règles des résumés IA sont correctement implémentées, la navigation est cohérente, les paiements Stripe sont configurés, le rate limiting et la sécurité sont en place, les pages légales sont conformes.

Les points en ⚠️ sont des améliorations recommandées mais ne bloquent pas la mise en production. Une validation manuelle des flows critiques (enregistrement, paiement, webhook) est conseillée avant le go-live.
