# ECO — Claude Code Context

## Projet
SaaS Next.js 15 qui transforme des enregistrements audio en résumés structurés par IA.
- **Domaine :** econewapp.com
- **Stack :** Next.js 15, TypeScript, Tailwind, PostgreSQL (Neon), Clerk, Stripe LIVE, OpenAI, Cloudflare R2, Vercel

## Workflow de développement
- Modifier le code directement dans les fichiers du projet
- Exécuter toi-même les commandes git pour déployer :
  ```bash
  git add .
  git commit -m "description claire"
  git push
  ```
- Le push déclenche automatiquement le déploiement Vercel (2-3 min)
- Toujours tester en production après déploiement (pas en local — Clerk auth issues en local)
- Annoncer clairement ce qui a été modifié, déployé, et ce qu'il faut tester

## Fichiers clés
```
.env.local                                      # Clerk, Stripe, OpenAI, DB, R2
middleware.ts                                   # Protection routes Clerk
prisma/schema.prisma                            # Schéma DB
lib/billingConfig.ts                            # Quotas et prix centralisés
app/api/transcribe/route.ts                     # Whisper transcription
app/api/generate-summary/route.ts               # Résumés IA — PROMPT IMMUABLE
app/api/billing/checkout/route.ts               # Stripe checkout
app/api/billing/webhook/route.ts                # Webhook Stripe
app/api/admin/grant-plan/route.ts               # Attribution plans gratuits
app/api/recordings/[id]/transcribe/route.ts     # Pipeline transcription async
app/api/recordings/[id]/status/route.ts         # Polling statut
app/page.tsx                                    # Home + enregistrement + polling
app/pricing/page.tsx                            # Plans et pricing
app/admin/page.tsx                              # Admin panel
```

## Règle ABSOLUE — Structure résumés (NE JAMAIS MODIFIER)
Le prompt système dans `app/api/generate-summary/route.ts` est intouchable.

Format obligatoire de tous les résumés :
```
Titre du résumé

Introduction:
[1-3 phrases de contexte]


Contenu:
[Développement adaptatif — liste numérotée si énumération, paragraphes si narratif]


Conclusion:
[1-3 phrases de synthèse]
```

Règles :
- Titres simples sans gras ni soulignement : `Introduction:` / `Contenu:` / `Conclusion:`
- 2 lignes vides entre chaque section
- Ratio ~16% de la transcription
- Notions = terme + définition complète
- Tous les éléments de l'audio présents, même pour 60 min

## Plans & Pricing
| Plan | Prix | Minutes |
|------|------|---------|
| Student | 19€/mois | 800 min |
| Pro | 49€/mois | 2000 min |
| Business | 149€/mois | 6000 min |

Packs one-time : +800, +2000, +6000 min  
Codes promo : `EDHEC26` et `ESCP26` → -25%  
Coût API : ~1 centime/minute — marge 58-60%

## Pipeline audio (1–60 min) — Architecture actuelle
1. Enregistrement micro → upload direct R2 (presigned URL, bypass limite Vercel 4.5MB)
2. Bitrate MediaRecorder : 48kbps → 60 min ≈ 21.6MB (sous limite Whisper 25MB)
3. `/api/recordings/[id]/transcribe` répond immédiatement `{ status: "PROCESSING" }`
4. `waitUntil()` (@vercel/functions) garantit que le background process n'est pas tué
5. Whisper → DB `TRANSCRIBED` → generate-summary → DB `DONE`
6. Frontend poll `/api/recordings/[id]/status` toutes les 3s jusqu'à `DONE`
7. Rechargement `/api/ecos/${recordingId}` → affichage complet

Timeouts Vercel configurés :
- `transcribe` → `maxDuration = 300`
- `generate-summary` → `maxDuration = 120`
- `upload-audio/presigned-url` → `maxDuration = 60`
- `recordings/init` + `recordings/[id]/complete` → `maxDuration = 60`

## Sécurité
- Admin : `cdorian654@yahoo.com` uniquement → `/admin`
- Rate limiting sur toutes les routes sensibles
- Clerk auth sur toutes les routes API

## Données de référence
- Admin : Dorian Credoz — Plan Pro, 2000 min
- Coût OpenAI : ~1 centime/minute (Whisper-1 + GPT-4o-mini)
- Auto-recharge OpenAI : seuil 5$, recharge +10$
- Stripe : mode LIVE, webhook opérationnel

## RÈGLE DE DÉPLOIEMENT — IMPORTANT

Ne jamais déployer après chaque fix individuel.

Grouper tous les changements et déployer uniquement quand :
1. Dorian dit explicitement "déploie" ou "deploy"
2. Ou quand plusieurs bugs/features sont regroupés en un seul commit

Workflow obligatoire :
- Faire les modifications dans le code
- Confirmer à Dorian ce qui a été changé
- Attendre sa validation avant de git push
- Un seul déploiement pour plusieurs fixes groupés

Objectif : minimiser le nombre de déploiements Vercel pour
rester dans les limites gratuites.

## À ne jamais faire
- Modifier le prompt système de `generate-summary/route.ts`
- Changer le modèle IA (Whisper-1 + GPT-4o-mini = setup optimal)
- Augmenter les coûts API sans validation
- Tester en local (utiliser econewapp.com)
