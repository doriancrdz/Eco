# Rapport d'audit de sécurité – Clés API et variables d'environnement

**Date :** février 2026  
**Objectif :** Vérifier qu'aucune clé API sensible n'est exposée côté client.

---

## Règles de sécurité appliquées

### Clés publiques (autorisées côté client)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Toute variable préfixée par `NEXT_PUBLIC_*`

### Clés secrètes (strictement backend)
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `CLERK_SECRET_KEY` (utilisée par le SDK Clerk côté serveur)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `DATABASE_URL`

---

## 1. Clés publiques (exposées côté client – normal)

| Variable | Usage dans le code |
|---------|---------------------|
| `NEXT_PUBLIC_CLERK_*` | Définies dans `.env` / `.env.example`. Utilisées par `@clerk/nextjs` (ClerkProvider, hooks) côté client ; aucune référence explicite `process.env.NEXT_PUBLIC_*` dans le code source. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Référencée dans `.env.example`. Si utilisée, elle l’est par le SDK Stripe côté client via la config d’environnement. |

**Verdict :** Les clés publiques sont réservées à l’usage client (Clerk, Stripe) et ne posent pas de risque dans ce contexte.

---

## 2. Clés secrètes (backend uniquement – sécurisé)

### OPENAI_API_KEY
| Fichier | Rôle |
|---------|------|
| `app/api/recordings/[id]/transcribe/route.ts` | Client OpenAI (Whisper) pour la transcription. |
| `app/api/generate-summary/route.ts` | Client OpenAI pour le résumé (GPT). |
| `app/api/transcribe/route.ts` | Client OpenAI pour la transcription. |

**Verdict :** Uniquement dans des routes API (backend). Aucune utilisation dans `app/` hors `api/`, ni dans `components/` ou `hooks/`.

---

### STRIPE_SECRET_KEY
| Fichier | Rôle |
|---------|------|
| `lib/stripe.ts` | `getStripeOrNull()` utilise `process.env.STRIPE_SECRET_KEY`. |

**Import de `lib/stripe.ts` :**  
Uniquement par des routes API :
- `app/api/billing/me/route.ts`
- `app/api/billing/checkout/route.ts`
- `app/api/billing/cancel/route.ts`
- `app/api/billing/portal/route.ts`
- `app/api/stripe/webhook/route.ts`

**Verdict :** Stripe secret key utilisée uniquement côté serveur (routes API). Aucun import de `lib/stripe` dans des composants ou pages client.

---

### STRIPE_WEBHOOK_SECRET
| Fichier | Rôle |
|---------|------|
| `app/api/stripe/webhook/route.ts` | Vérification de la signature des webhooks Stripe. |

**Verdict :** Uniquement dans une route API (backend).

---

### CLERK_SECRET_KEY
- Non référencée explicitement dans le code. Utilisée par `@clerk/nextjs` côté serveur (middleware, `auth()`, etc.) via les variables d’environnement configurées pour Clerk.

**Verdict :** Gérée par le SDK Clerk en backend. Pas d’exposition côté client.

---

### R2_* (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)
| Fichier | Rôle |
|---------|------|
| `app/api/upload-audio/presigned-url/route.ts` | Génération d’URLs présignées S3/R2. |
| `app/api/recordings/[id]/transcribe/route.ts` | Téléchargement de l’audio depuis R2 pour Whisper. |

**Verdict :** Uniquement dans des routes API. Aucune utilisation dans du code client.

---

### UPSTASH_* (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
| Fichier | Rôle |
|---------|------|
| `lib/ratelimit.ts` | Client Redis Upstash pour le rate limiting. |

**Import de `lib/ratelimit.ts` :**  
Uniquement par des routes API :
- `app/api/recordings/init/route.ts` (recordingLimiter)
- `app/api/recordings/[id]/transcribe/route.ts` (transcriptionLimiter)
- `app/api/upload-audio/presigned-url/route.ts` (uploadLimiter)

**Verdict :** Upstash utilisé uniquement côté serveur. Aucun import de `lib/ratelimit` dans des composants ou pages client.

---

### DATABASE_URL
- Référencée dans `prisma/schema.prisma` via `env("DATABASE_URL")` pour la connexion Prisma.
- `lib/prisma.ts` instancie le client Prisma (sans lecture directe de `DATABASE_URL` dans le code TS).

**Import de `lib/prisma.ts` :**  
Uniquement par des routes sous `app/api/**` (billing, recordings, ecos, folders, stripe webhook, etc.).

**Verdict :** Base de données utilisée uniquement côté serveur. Aucun import de `lib/prisma` dans du code client.

---

## 3. Fichiers côté client analysés

- **Fichiers avec `'use client'` :** `app/page.tsx`, `app/settings/page.tsx`, `app/pricing/page.tsx`, pages légales, `components/*`, `hooks/useAudioLevel.ts`, etc.
- **Usage de `process.env` côté client :** Uniquement `process.env.NODE_ENV` (ex. `!== "production"`) dans `app/page.tsx`, `components/EcoView.tsx`, `Header.tsx`, `PlanBadge.tsx`, `Sidebar.tsx`, `QuotaIndicator.tsx`.  
- **Aucune** référence à des clés secrètes dans ces fichiers.

---

## 4. Synthèse

| Type | Statut |
|------|--------|
| Clés publiques (NEXT_PUBLIC_*) | Utilisées uniquement pour Clerk / Stripe côté client (config env). |
| OPENAI_API_KEY | Uniquement dans `app/api/**`. |
| STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET | Uniquement dans `lib/stripe.ts` et `app/api/stripe/webhook/route.ts`, appelés uniquement par des routes API. |
| CLERK_SECRET_KEY | Gérée par le SDK Clerk côté serveur. |
| R2_* | Uniquement dans `app/api/upload-audio/**` et `app/api/recordings/[id]/transcribe/route.ts`. |
| UPSTASH_* | Uniquement dans `lib/ratelimit.ts`, importé uniquement par des routes API. |
| DATABASE_URL | Utilisée par Prisma (schema + runtime serveur) ; `lib/prisma` importé uniquement par des routes API. |

---

## 5. Problèmes détectés

**Aucun.** Aucune clé secrète n’est référencée dans du code client (`'use client'`, composants, hooks ou pages non-API). Toutes les clés sensibles sont utilisées uniquement dans :
- `app/api/**`
- `middleware.ts` (Clerk)
- `lib/ratelimit.ts` (importé uniquement par des routes API)
- `lib/stripe.ts` (importé uniquement par des routes API)
- `lib/prisma.ts` (importé uniquement par des routes API)

---

## Conclusion

L’application est **conforme** aux règles définies : **aucune clé API sensible n’est exposée côté client**. Toutes les clés secrètes restent confinées au backend (routes API, middleware, et libs utilisées uniquement par ces routes).
