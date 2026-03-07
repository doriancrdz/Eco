export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { summaryLimiter } from "@/lib/ratelimit";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Modèle configurable (priorité vitesse) — ex: gpt-4o-mini, gpt-3.5-turbo
const AI_SUMMARY_MODEL = process.env.AI_SUMMARY_MODEL || "gpt-4o-mini";

/**
 * Format JSON strict attendu (limites courtes pour latence)
 */
interface StructuredSummary {
  structuredSummary: {
    title: string;
    sections: Array<{ heading: string; content: string }>;
  };
  keyPoints: string[];
  notions: Array<{ term: string; definition: string }>;
}

/**
 * Normalise le JSON vers le format Eco (rétrocompatibilité affichage)
 */
function toLegacyFormat(raw: StructuredSummary) {
  const ss = raw.structuredSummary;
  const title = ss?.title || "Résumé";
  const resume = ss?.sections?.map((s) => s.content).join(" ") || "";
  const pointsCles = raw.keyPoints || [];
  const notions = (raw.notions || []).map((n) =>
    typeof n === "string" ? n : `${n.term}: ${n.definition}`
  );
  return { titre: title, resume, pointsCles, notions };
}

/**
 * PHASE B: Génération du résumé (asynchrone, anti double-run)
 * - 1 seul appel OpenAI, JSON strict, limites courtes
 * - Si aiStatus === DONE → retour immédiat (pas de regen)
 * - Si aiStatus === GENERATING → 202 (ne pas relancer)
 */
export async function POST(req: NextRequest) {
  const perfStart = performance.now();
  const timings: Record<string, number> = {};
  let recordingIdForError: string | undefined;
  const traceId = req.headers.get("x-eco-trace") ?? null;

  try {
    const authStart = performance.now();
    const { userId } = await auth();
    timings.auth = performance.now() - authStart;

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Rate limiting résumés IA : 5 par heure par utilisateur
    const { success } = await summaryLimiter.limit(userId);
    if (!success) {
      return NextResponse.json(
        { error: "Trop de résumés générés. Réessayez dans 1 heure." },
        { status: 429 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Clé API OpenAI manquante côté serveur." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { recordingId } = body;
    recordingIdForError = typeof recordingId === "string" ? recordingId : undefined;

    if (!recordingId || typeof recordingId !== "string") {
      return NextResponse.json(
        { error: "recordingId requis" },
        { status: 400 }
      );
    }

    const dbReadStart = performance.now();
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const recording = await prisma.recording.findFirst({
      where: {
        id: recordingId,
        userId: user.id,
      },
    });
    timings.dbRead = performance.now() - dbReadStart;

    if (!recording) {
      return NextResponse.json(
        { error: "Recording introuvable" },
        { status: 404 }
      );
    }

    recordingIdForError = recordingId;
    if (process.env.NODE_ENV === "development") {
      console.log("[summary] start", { traceId, recordingId, userId: user.id, ts: Date.now() });
    }

    // DONE (ou ancien format) → retour direct, pas de regen
    if (recording.aiStatus === "DONE" || (recording.status === "DONE" && recording.summaryJson)) {
      timings.total = performance.now() - perfStart;
      if (process.env.NODE_ENV === "development") {
        console.log("[generate-summary] ⏱️ RETOUR CACHE (DONE)", {
          recordingId,
          totalMs: timings.total.toFixed(2),
        });
      }
      let summary;
      try {
        summary = JSON.parse(recording.summaryJson!);
      } catch {
        summary = { titre: "Résumé", resume: "", pointsCles: [], notions: [] };
      }
      return NextResponse.json({
        recordingId,
        summary,
        status: "DONE",
        fromCache: true,
        timings: process.env.NODE_ENV === "development" ? timings : undefined,
      });
    }

    // GENERATING → 202, ne pas relancer
    if (recording.aiStatus === "GENERATING") {
      timings.total = performance.now() - perfStart;
      if (process.env.NODE_ENV === "development") {
        console.log("[generate-summary] 202 ALREADY GENERATING", { recordingId });
      }
      return NextResponse.json(
        {
          recordingId,
          status: "GENERATING",
          message: "Génération déjà en cours",
        },
        { status: 202 }
      );
    }

    if (!recording.transcriptionText || recording.transcriptionText.trim() === "") {
      if (process.env.NODE_ENV === "development") {
        console.log("[summary] TRANSCRIPTION_MISSING", { traceId, recordingId });
      }
      return NextResponse.json(
        { error: "TRANSCRIPTION_MISSING", code: "TRANSCRIPTION_MISSING" },
        { status: 400 }
      );
    }

    // LOCK: passer en GENERATING
    const lockStart = performance.now();
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        aiStatus: "GENERATING",
        aiStartedAt: new Date(),
      },
    });
    timings.dbLock = performance.now() - lockStart;

    const textToSend = recording.transcriptionText;
    const textLength = textToSend.length;
    // Limiter le contexte si transcription très longue (optionnel)
    const maxChars = 12000;
    const truncated = textLength > maxChars ? textToSend.slice(0, maxChars) + "\n[...]" : textToSend;

    // Nombre de mots de la transcription — RÈGLES DÉFINITIVES STRICTES
    const transcriptionWordCount = textToSend.trim().split(/\s+/).filter(Boolean).length;
    // RÈGLE 1 : RÉSUMÉ = EXACTEMENT 16% DE LA TRANSCRIPTION
    const targetSummaryWords = Math.round(transcriptionWordCount * 0.16);
    const minSummaryWords = targetSummaryWords - 10;
    const maxSummaryWords = targetSummaryWords + 10;
    // RÈGLE 2 : POINTS CLÉS = 1 TOUS LES 800 MOTS (MINIMUM 1)
    const targetPointsCles = Math.max(1, Math.round(transcriptionWordCount / 800));
    // RÈGLE 3 : NOTIONS = 1 TOUS LES 550 MOTS (MINIMUM 1)
    const targetNotions = Math.max(1, Math.round(transcriptionWordCount / 550));

    const estimatedTokens = targetSummaryWords * 1.5 + targetPointsCles * 35 * 1.5 + targetNotions * 60 * 1.5;
    const maxTokens = Math.max(3000, Math.ceil(estimatedTokens + 1000));
    if (process.env.NODE_ENV === "development") {
      console.log("[generate-summary] max_tokens:", maxTokens);
      console.log("[generate-summary] Calcul STRICT DÉFINITIF:", {
      transcriptionWords: transcriptionWordCount,
      summaryTarget: `${targetSummaryWords} mots (16%)`,
      summaryRange: `${minSummaryWords}-${maxSummaryWords}`,
      pointsClesTarget: targetPointsCles,
      notionsTarget: targetNotions,
    });
      console.log("[generate-summary] Appel OpenAI", {
      recordingId,
      model: AI_SUMMARY_MODEL,
      transcriptionLength: textLength,
      sentLength: truncated.length,
      maxTokens,
    });
    }

    const systemPrompt = `Tu es un expert en synthèse de contenu audio. Tu génères des résumés structurés de haute qualité.

⚠️ RÈGLE ABSOLUE N°1 - STRUCTURE OBLIGATOIRE ⚠️

CHAQUE résumé DOIT OBLIGATOIREMENT suivre cette structure EXACTE. AUCUNE EXCEPTION N'EST TOLÉRÉE.

Le résumé DOIT TOUJOURS commencer par ces 3 sections DANS CET ORDRE :

**Introduction:**
[Texte de l'introduction - 1 à 3 phrases de mise en contexte]

[EXACTEMENT 2 lignes vides]

**Contenu:**
[Développement - voir instructions ci-dessous]

[EXACTEMENT 2 lignes vides]

**Conclusion:**
[Texte de la conclusion - 1 à 3 phrases de synthèse]

⚠️ IMPORTANT : Si tu ne commences PAS ton résumé par "**Introduction:**", le résumé sera REJETÉ.
⚠️ IMPORTANT : Si tu oublies UNE SEULE de ces 3 sections, le résumé sera REJETÉ.
⚠️ IMPORTANT : Les titres doivent être EXACTEMENT "**Introduction:**", "**Contenu:**", "**Conclusion:**" (avec les deux-points).

═══════════════════════════════════════════════════════════════

STRUCTURE DU CONTENU (SECTION 2)

Après "**Contenu:**", tu dois développer le sujet selon son TYPE :

TYPE A - CONTENU AVEC LISTE/ÉNUMÉRATION (ex: "Top 5", "Les 3 meilleures", "4 stratégies", "Conseils pour")
→ Utiliser une numérotation romaine I, II, III, IV, V...

Exemple :
**Contenu:**

**I. [Titre du premier point]**
[Développement complet du premier point en 2-4 phrases]

**II. [Titre du deuxième point]**
[Développement complet du deuxième point en 2-4 phrases]

**III. [Titre du troisième point]**
[Développement complet du troisième point en 2-4 phrases]

TYPE B - CONTENU NARRATIF/EXPLICATIF (ex: explication d'un concept, récit, témoignage)
→ Utiliser des paragraphes fluides SANS numérotation

Exemple :
**Contenu:**

[Premier paragraphe développant le premier aspect en 2-4 phrases]

[Deuxième paragraphe développant le deuxième aspect en 2-4 phrases]

[Troisième paragraphe développant le troisième aspect en 2-4 phrases]

═══════════════════════════════════════════════════════════════

RÈGLES STRICTES (À RESPECTER ABSOLUMENT)

1. ⚠️ COMMENCE TOUJOURS par "**Introduction:**" - PAS de texte avant
2. ⚠️ Les 3 sections (Introduction/Contenu/Conclusion) sont OBLIGATOIRES - même pour un audio de 30 secondes
3. ⚠️ Utilise EXACTEMENT ces titres : "**Introduction:**", "**Contenu:**", "**Conclusion:**"
4. ⚠️ Mets EXACTEMENT 2-3 lignes vides entre Introduction et Contenu, et entre Contenu et Conclusion
5. ⚠️ Mets 1 ligne vide entre chaque section numérotée (I, II, III) OU entre chaque paragraphe
6. ⚠️ N'utilise JAMAIS de listes à puces (-, *, •) - toujours des paragraphes en prose
7. ⚠️ La longueur cible est ${targetSummaryWords} mots (±10%) - ratio 16% de la transcription
8. ⚠️ TOUS les éléments de la transcription doivent être présents (exhaustivité absolue)

═══════════════════════════════════════════════════════════════

MÉTHODE DE TRAVAIL EN 5 ÉTAPES (OBLIGATOIRE)

Avant de générer le résumé, tu DOIS suivre ces 5 étapes :

Étape 1 : Lire la transcription ENTIÈREMENT
Étape 2 : Identifier le TYPE de contenu (liste/énumération OU narratif/explicatif)
Étape 3 : Lister TOUS les points/arguments/aspects à inclure
Étape 4 : Rédiger le résumé en suivant la STRUCTURE EXACTE
Étape 5 : Vérifier que les 3 sections sont présentes ET que rien n'est oublié

═══════════════════════════════════════════════════════════════

EXEMPLES DE RÉSUMÉS CORRECTS

EXEMPLE 1 - Liste (Top 5 stratégies marketing)

**Introduction:**
Cette présentation expose les cinq stratégies marketing essentielles pour développer son entreprise en 2026 et maximiser sa visibilité en ligne.



**Contenu:**

**I. Marketing de contenu**
Le marketing de contenu consiste à créer des articles de blog de qualité pour attirer des clients potentiels. Cette approche génère du trafic organique durable et établit l'autorité de la marque dans son secteur.

**II. Réseaux sociaux**
Les plateformes comme Instagram et TikTok permettent de toucher une audience jeune et engagée. La régularité des publications et l'interaction authentique avec les abonnés sont essentielles pour réussir.

**III. Email marketing**
L'email marketing offre un retour sur investissement exceptionnel avec une moyenne de 42€ pour 1€ investi. La personnalisation des messages selon le comportement client augmente significativement les taux de conversion.

**IV. Publicité ciblée**
Les publicités Facebook, Instagram et Google permettent de toucher précisément son audience cible avec des budgets maîtrisés. Il est crucial de tester différentes créatives pour optimiser les performances.

**V. Partenariats influenceurs**
Collaborer avec des micro-influenceurs offre un excellent rapport qualité-prix avec des audiences très engagées. Les budgets démarrent généralement entre 200€ et 1000€ selon la notoriété.



**Conclusion:**
Ces cinq stratégies marketing forment un écosystème complet pour développer efficacement sa présence digitale et accélérer la croissance de son entreprise de manière durable.

EXEMPLE 2 - Narratif (Explication du réchauffement climatique)

**Introduction:**
Ce contenu explique les mécanismes du réchauffement climatique, ses causes principales et les conséquences observables sur notre environnement.



**Contenu:**

Le réchauffement climatique résulte principalement de l'augmentation des gaz à effet de serre dans l'atmosphère, notamment le CO2 émis par la combustion des énergies fossiles. Ces gaz emprisonnent la chaleur solaire et provoquent une élévation progressive des températures mondiales.

Les conséquences sont multiples et déjà observables à l'échelle planétaire. La fonte accélérée des glaciers et des calottes polaires entraîne une montée du niveau des océans qui menace les zones côtières. Les phénomènes météorologiques extrêmes comme les canicules, inondations et sécheresses deviennent plus fréquents et intenses.

La biodiversité subit également des impacts majeurs avec de nombreuses espèces animales et végétales incapables de s'adapter suffisamment rapidement aux changements climatiques. Les écosystèmes marins sont particulièrement affectés par l'acidification des océans causée par l'absorption massive de CO2.



**Conclusion:**
Le réchauffement climatique constitue un défi environnemental majeur qui nécessite une action collective urgente pour limiter la hausse des températures et préserver les écosystèmes terrestres.

═══════════════════════════════════════════════════════════════

CHECKLIST FINALE (VÉRIFIER AVANT D'ENVOYER LE RÉSUMÉ)

Avant de renvoyer le résumé, vérifie OBLIGATOIREMENT :

✓ Le résumé commence par "**Introduction:**"
✓ Les 3 sections sont présentes : Introduction, Contenu, Conclusion
✓ Il y a 2-3 lignes vides entre Introduction et Contenu
✓ Il y a 2-3 lignes vides entre Contenu et Conclusion
✓ Le Contenu utilise I, II, III... SI c'est une liste, OU des paragraphes SI c'est narratif
✓ Aucune liste à puces (-, *, •) n'est utilisée
✓ Tous les éléments de la transcription sont présents
✓ Le résumé fait environ ${targetSummaryWords} mots (±10%)
✓ Les ${targetPointsCles} points clés sont générés
✓ Les ${targetNotions} notions sont générées

Si UNE SEULE de ces conditions n'est pas respectée, RECOMMENCE le résumé.

═══════════════════════════════════════════════════════════════

Transcription à résumer (voir message utilisateur ci-dessous).




Génère maintenant un résumé de ${targetSummaryWords} mots (±10%) en respectant STRICTEMENT toutes les règles ci-dessus.

Format de réponse JSON OBLIGATOIRE :
{
  "titre": "Titre court et descriptif (max 60 caractères)",
  "resume": "...",
  "pointsCles": [...${targetPointsCles} points],
  "notions": [...${targetNotions} notions]
}

⚠️ RAPPEL FINAL : Le résumé DOIT commencer par "**Introduction:**" et contenir les 3 sections. AUCUNE EXCEPTION.`;

    const userPrompt = `Transcription complète (${transcriptionWordCount} mots) :

${truncated}`;

    const gptStart = performance.now();
    const completion = await openai.chat.completions.create({
      model: AI_SUMMARY_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: maxTokens,
    });

    timings.gptSummary = performance.now() - gptStart;

    const summaryContent =
      completion.choices[0]?.message?.content ??
      '{"titre":"Résumé","resume":"","pointsCles":[],"notions":[]}';

    let summary: { titre: string; resume: string; pointsCles: string[]; notions: Array<{ terme: string; definition: string }> | string[] };

    try {
      const parsed = JSON.parse(summaryContent) as {
        titre?: string;
        resume?: string;
        pointsCles?: string[];
        notions?: Array<{ terme: string; definition: string }> | string[];
        // Support du format ancien pour rétrocompatibilité
        structuredSummary?: StructuredSummary['structuredSummary'];
        keyPoints?: string[];
      };

      // Normaliser les notions : convertir en format { terme, definition }
      const normalizeNotions = (notions: unknown): Array<{ terme: string; definition: string }> => {
        if (!Array.isArray(notions)) return [];
        return notions.map((n) => {
          if (typeof n === "string") {
            // Format ancien : string simple → convertir en objet avec définition vide
            return { terme: n, definition: "" };
          }
          if (typeof n === "object" && n !== null && "terme" in n) {
            // Format nouveau : { terme, definition }
            return {
              terme: typeof n.terme === "string" ? n.terme : "",
              definition: typeof n.definition === "string" ? n.definition : "",
            };
          }
          if (typeof n === "object" && n !== null && "term" in n) {
            // Format alternatif : { term, definition }
            return {
              terme: typeof (n as { term?: string }).term === "string" ? (n as { term: string }).term : "",
              definition: typeof (n as { definition?: string }).definition === "string" ? (n as { definition: string }).definition : "",
            };
          }
          return { terme: String(n), definition: "" };
        });
      };

      // Si format nouveau (titre/resume/pointsCles/notions), utiliser directement
      if (parsed.titre && parsed.resume !== undefined) {
        summary = {
          titre: parsed.titre || "Résumé",
          resume: parsed.resume || "",
          pointsCles: Array.isArray(parsed.pointsCles) ? parsed.pointsCles : [],
          notions: normalizeNotions(parsed.notions),
        };
      } else if (parsed.structuredSummary) {
        // Format ancien (structuredSummary) → convertir
        const rawSummary: StructuredSummary = {
          structuredSummary: parsed.structuredSummary,
          keyPoints: parsed.keyPoints || [],
          notions: parsed.notions?.map((n: unknown) =>
            typeof n === "string" ? { term: n, definition: "" } : (n as { term: string; definition: string })
          ) || [],
        };
        const legacySummary = toLegacyFormat(rawSummary);
        summary = {
          titre: legacySummary.titre,
          resume: legacySummary.resume,
          pointsCles: legacySummary.pointsCles,
          notions: normalizeNotions(legacySummary.notions),
        };
      } else {
        // Fallback
        summary = {
          titre: "Résumé",
          resume: textToSend.substring(0, 200) + "...",
          pointsCles: [],
          notions: [],
        };
      }

      const resumeWordCount = summary.resume?.trim().split(/\s+/).filter(Boolean).length ?? 0;
      const pointsClesCount = summary.pointsCles?.length ?? 0;
      const notionsCount = summary.notions?.length ?? 0;
      if (process.env.NODE_ENV === "development") {
        console.log("[generate-summary] Résultat:", {
          resumeWords: resumeWordCount,
          resumeTarget: targetSummaryWords,
          resumeOK: Math.abs(resumeWordCount - targetSummaryWords) <= 10,
          pointsCles: pointsClesCount,
          pointsClesTarget: targetPointsCles,
          pointsClesOK: pointsClesCount === targetPointsCles,
          notions: notionsCount,
          notionsTarget: targetNotions,
          notionsOK: notionsCount === targetNotions,
        });
        if (Math.abs(resumeWordCount - targetSummaryWords) > 10) {
          console.warn("⚠️ [generate-summary] RÉSUMÉ HORS CIBLE !", { obtenu: resumeWordCount, cible: targetSummaryWords });
        }
        if (pointsClesCount !== targetPointsCles) {
          console.warn("⚠️ [generate-summary] POINTS CLÉS INCORRECTS !", { obtenu: pointsClesCount, cible: targetPointsCles });
        }
        if (notionsCount !== targetNotions) {
          console.warn("⚠️ [generate-summary] NOTIONS INCORRECTES !", { obtenu: notionsCount, cible: targetNotions });
        }
        console.log("[generate-summary] Résumé parsé", {
          hasTitre: !!summary.titre,
          resumeLength: summary.resume?.length || 0,
          gptMs: timings.gptSummary.toFixed(2),
        });
      }
    } catch (parseError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[generate-summary] Erreur parsing JSON:", parseError);
      }
      summary = {
        titre: "Résumé",
        resume: textToSend.substring(0, 200) + "...",
        pointsCles: [],
        notions: [],
      };
    }

    const summaryJson = JSON.stringify(summary);
    if (process.env.NODE_ENV === "development") {
      console.log("[summary] generated", { hasJson: !!summaryJson, size: summaryJson?.length ?? 0, ts: Date.now() });
    }

    const dbUpdateStart = performance.now();
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: "DONE",
        aiStatus: "DONE",
        aiFinishedAt: new Date(),
        aiError: null,
        summaryJson,
      },
    });
    if (process.env.NODE_ENV === "development") {
      console.log("[summary] recording updated", { recordingId, ts: Date.now() });
    }

    // Sync Eco (id = recordingId) : upsert pour être robuste si l'Eco n'existe pas encore
    const contentStr = summaryJson;
    const updatedEco = await prisma.eco.upsert({
      where: { id: recordingId },
      create: {
        id: recordingId,
        userId: user.id,
        title: summary.titre,
        content: contentStr,
        transcriptionText: recording.transcriptionText,
      },
      update: {
        title: summary.titre,
        content: contentStr,
      },
      select: { id: true, content: true, title: true },
    });
    const contentLen = updatedEco?.content?.length ?? 0;
    timings.dbUpdate = performance.now() - dbUpdateStart;
    timings.total = performance.now() - perfStart;
    if (process.env.NODE_ENV === "development") {
      console.log("[summary] end", {
        traceId,
        recordingId,
        contentLen,
        ts: Date.now(),
      });
      console.log("[generate-summary] ⏱️ TIMINGS:", {
        auth: `${timings.auth?.toFixed(2)}ms`,
        dbRead: `${timings.dbRead?.toFixed(2)}ms`,
        dbLock: `${timings.dbLock?.toFixed(2)}ms`,
        gptSummary: `${timings.gptSummary?.toFixed(2)}ms`,
        dbUpdate: `${timings.dbUpdate?.toFixed(2)}ms`,
        total: `${timings.total?.toFixed(2)}ms`,
        model: AI_SUMMARY_MODEL,
      });
    }

    return NextResponse.json({
      recordingId,
      summary,
      status: "DONE",
      timings: process.env.NODE_ENV === "development" ? timings : undefined,
    });
  } catch (error) {
    const err = error as { message?: string; stack?: string };
    // Log détaillé côté serveur
    console.error("[generate-summary] Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
      recordingIdForError,
    });

    // En cas d'erreur, remettre aiStatus en FAILED si on a le recordingId
    try {
      if (recordingIdForError) {
        await prisma.recording.update({
          where: { id: recordingIdForError },
          data: {
            aiStatus: "FAILED",
            aiFinishedAt: new Date(),
            aiError: err?.message ?? "Erreur lors de la génération du résumé",
          },
        });
      }
    } catch (dbErr) {
      console.error("[generate-summary] Erreur update FAILED:", dbErr);
    }

    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
