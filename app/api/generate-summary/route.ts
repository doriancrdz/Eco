export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

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
    console.log("[summary] start", { traceId, recordingId, userId: user.id, ts: Date.now() });

    // DONE (ou ancien format) → retour direct, pas de regen
    if (recording.aiStatus === "DONE" || (recording.status === "DONE" && recording.summaryJson)) {
      timings.total = performance.now() - perfStart;
      console.log("[generate-summary] ⏱️ RETOUR CACHE (DONE)", {
        recordingId,
        totalMs: timings.total.toFixed(2),
      });
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
      console.log("[generate-summary] 202 ALREADY GENERATING", { recordingId });
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
      console.log("[summary] TRANSCRIPTION_MISSING", { traceId, recordingId });
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

    // Nombre de mots de la transcription (base pour le ratio 12-18%)
    const transcriptionWordCount = textToSend.trim().split(/\s+/).filter(Boolean).length;
    const minSummaryWords = Math.floor(transcriptionWordCount * 0.12);
    const maxSummaryWords = Math.ceil(transcriptionWordCount * 0.18);
    const targetSummaryWords = Math.round(transcriptionWordCount * 0.15);

    // Calculer la durée en minutes (pour points clés et notions — logique existante conservée)
    const durationMs = recording.durationMs || (recording.durationSeconds ? recording.durationSeconds * 1000 : null);
    const durationMinutesRounded = durationMs ? Math.round((durationMs / 60000) * 10) / 10 : null;
    const durationMinutes = durationMinutesRounded ?? 0;

    // max_tokens très généreux pour forcer GPT à générer assez (12-18% de la transcription)
    const maxTokens = Math.max(
      4000,
      Math.ceil(maxSummaryWords * 1.5 + 4000)
    );
    console.log("[generate-summary] max_tokens:", maxTokens, "(très généreux pour forcer GPT à générer assez)");

    console.log("[generate-summary] Calcul résumé:", {
      transcriptionWords: transcriptionWordCount,
      summaryMin: minSummaryWords,
      summaryMax: maxSummaryWords,
      summaryTarget: targetSummaryWords,
    });
    console.log("[generate-summary] Appel OpenAI", {
      recordingId,
      model: AI_SUMMARY_MODEL,
      transcriptionLength: textLength,
      sentLength: truncated.length,
      durationMinutes: durationMinutesRounded,
      maxTokens,
    });

    const systemPrompt = `Tu es un assistant IA expert en structuration de connaissances.

═══════════════════════════════════════════════════════════════
📊 DONNÉES DE BASE
═══════════════════════════════════════════════════════════════
TRANSCRIPTION : ${transcriptionWordCount} mots
RÉSUMÉ MINIMUM ABSOLU : ${minSummaryWords} mots (12%)
RÉSUMÉ MAXIMUM ABSOLU : ${maxSummaryWords} mots (18%)
RÉSUMÉ CIBLE RECOMMANDÉE : ${targetSummaryWords} mots (15%)

${
  transcriptionWordCount < 300
    ? `
═══════════════════════════════════════════════════════════════
RÉSUMÉ COURT (< 300 mots de transcription)
═══════════════════════════════════════════════════════════════
- Format : UN SEUL PARAGRAPHE
- Longueur : ${minSummaryWords}-${maxSummaryWords} mots EXACTEMENT
- Points clés : 5-8 points détaillés (phrases complètes)
- Notions : 4-6 termes avec définitions complètes
`
    : `
═══════════════════════════════════════════════════════════════
⚠️⚠️⚠️ RÈGLES ABSOLUES - LIRE ATTENTIVEMENT ⚠️⚠️⚠️
═══════════════════════════════════════════════════════════════

1. TON RÉSUMÉ DOIT FAIRE AU MINIMUM ${minSummaryWords} MOTS
2. TON RÉSUMÉ NE DOIT PAS DÉPASSER ${maxSummaryWords} MOTS
3. LA LONGUEUR IDÉALE EST ${targetSummaryWords} MOTS

SI TON RÉSUMÉ FAIT MOINS DE ${minSummaryWords} MOTS :
❌ TU AS ÉCHOUÉ - RECOMMENCE ET DÉVELOPPE BEAUCOUP PLUS

SI TON RÉSUMÉ FAIT PLUS DE ${maxSummaryWords} MOTS :
❌ TU AS ÉCHOUÉ - RECOMMENCE ET SYNTHÉTISE

═══════════════════════════════════════════════════════════════
📝 STRUCTURE OBLIGATOIRE DU RÉSUMÉ (SANS TITRES DE SECTIONS)
═══════════════════════════════════════════════════════════════

⚠️ IMPORTANT : NE PAS ÉCRIRE "**INTRODUCTION**", "**DÉVELOPPEMENT**", "**CONCLUSION**"
Les sections doivent être implicites et naturelles, avec des connecteurs logiques.

PARTIE 1 - INTRODUCTION (${Math.floor(targetSummaryWords * 0.15)}-${Math.ceil(targetSummaryWords * 0.2)} mots)
Commence directement par le contenu, sans titre.
- Première phrase : Présente le sujet principal et le contexte
- Deuxième phrase : Annonce les thématiques ou arguments principaux
- Troisième phrase : Explique l'objectif de l'enregistrement

Connecteurs pour introduire : "Dans cet enregistrement, ...", "Cette présentation aborde...", "L'intervenant explique que...", etc.

PARTIE 2 - DÉVELOPPEMENT (${Math.floor(targetSummaryWords * 0.65)}-${Math.ceil(targetSummaryWords * 0.75)} mots)
Divise en 4-8 paragraphes thématiques (un paragraphe par grande partie).
Utilise des connecteurs logiques entre les paragraphes :
- Pour énumérer : "Premièrement,", "Ensuite,", "Par ailleurs,", "De plus,"
- Pour illustrer : "Par exemple,", "Ainsi,", "En effet,"
- Pour conclure une partie : "Enfin,", "Pour finir sur ce point,"

Chaque paragraphe :
- Développe une section ou thématique majeure
- Inclut arguments, exemples, données, détails importants
- Suit la chronologie ou la logique de l'audio
- N'OMETS AUCUNE INFORMATION IMPORTANTE

PARTIE 3 - CONCLUSION (${Math.floor(targetSummaryWords * 0.1)}-${Math.ceil(targetSummaryWords * 0.15)} mots)
Commence par un connecteur de conclusion : "En résumé,", "En conclusion,", "Pour conclure,", "Ainsi,", "Au final,"
- Synthétise les points principaux abordés
- Rappelle le message clé ou l'enseignement principal
- Propose éventuellement une ouverture ou perspective

═══════════════════════════════════════════════════════════════
✅ EXEMPLE DE STRUCTURE SANS TITRES
═══════════════════════════════════════════════════════════════

MAUVAIS (avec titres) :
"**INTRODUCTION**
Dans cet enregistrement, l'intervenant aborde...

**DÉVELOPPEMENT**
Premièrement, il explique que..."

BON (sans titres, avec connecteurs) :
"Dans cet enregistrement, l'intervenant aborde les stratégies d'investissement à 40 ans, en mettant l'accent sur...

Premièrement, il souligne que le véritable risque à cet âge n'est pas de manquer d'argent...

Ensuite, il aborde la question de la gestion patrimoniale...

Enfin, il insiste sur l'importance de la diversification...

En conclusion, l'enregistrement fournit un cadre structuré..."

═══════════════════════════════════════════════════════════════
📊 POINTS CLÉS ET NOTIONS
═══════════════════════════════════════════════════════════════

POINTS CLÉS :
${durationMinutes < 3 ? `
- Nombre : 5-8 points
- Format : Phrases complètes et détaillées (15-20 mots par point)
- Exemple : "L'inflation érode le pouvoir d'achat : un capital de 50 000€ non investi perd de sa valeur chaque année"
` : durationMinutes < 10 ? `
- Nombre : 10-15 points
- Format : Phrases complètes et détaillées (15-25 mots par point)
- Couvrir TOUS les arguments, conseils, étapes, ou concepts importants
` : durationMinutes < 30 ? `
- Nombre : 18-25 points
- Format : Phrases complètes et très détaillées (20-30 mots par point)
- Couvrir EXHAUSTIVEMENT tous les arguments, conseils, données, étapes
` : `
- Nombre : 25-35 points
- Format : Phrases complètes et très détaillées (20-35 mots par point)
- Couvrir EXHAUSTIVEMENT ET EN PROFONDEUR tous les concepts importants
`}

NOTIONS :
${durationMinutes < 3 ? `
- Nombre : 4-6 notions
- Format : Terme + définition complète (20-30 mots)
` : durationMinutes < 10 ? `
- Nombre : 8-12 notions
- Format : Terme + définition complète et claire (25-40 mots)
` : durationMinutes < 30 ? `
- Nombre : 12-18 notions
- Format : Terme + définition complète et détaillée (30-50 mots)
` : `
- Nombre : 18-28 notions
- Format : Terme + définition complète et très détaillée (35-60 mots)
`}

═══════════════════════════════════════════════════════════════
⚠️ VÉRIFICATION FINALE
═══════════════════════════════════════════════════════════════

Avant de générer le JSON :
☐ Mon résumé N'A PAS de titres "**INTRODUCTION**", "**DÉVELOPPEMENT**", "**CONCLUSION**"
☐ Mon résumé utilise des connecteurs logiques naturels
☐ Mon résumé fait entre ${minSummaryWords} et ${maxSummaryWords} mots
☐ Mes points clés sont des phrases complètes de 15-30 mots chacune
☐ Mes notions ont des définitions complètes de 25-50 mots chacune

Si une case n'est pas cochée → RECOMMENCE
`
}

Format JSON strict :
{
  "titre": "Titre court (max 60 caractères)",
  "resume": "RÉSUMÉ FLUIDE SANS TITRES DE SECTIONS, AVEC CONNECTEURS LOGIQUES NATURELS ET SAUTS DE LIGNE ENTRE PARAGRAPHES",
  "pointsCles": [
    "Point clé 1 en phrase complète et détaillée (15-30 mots)",
    "Point clé 2 en phrase complète et détaillée (15-30 mots)",
    ...
  ],
  "notions": [
    {"terme": "Terme 1", "definition": "Définition complète et détaillée (25-50 mots)"},
    {"terme": "Terme 2", "definition": "Définition complète et détaillée (25-50 mots)"},
    ...
  ]
}`;

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
      const ratioPct = transcriptionWordCount > 0 ? ((resumeWordCount / transcriptionWordCount) * 100).toFixed(1) : "0";
      console.log("[generate-summary] Résumé généré:", {
        resumeWords: resumeWordCount,
        targetRange: `${minSummaryWords}-${maxSummaryWords}`,
        target: targetSummaryWords,
        ratio: `${ratioPct}%`,
        pointsCles: summary.pointsCles?.length ?? 0,
        notions: summary.notions?.length ?? 0,
      });
      if (resumeWordCount < minSummaryWords) {
        console.warn("⚠️ [generate-summary] RÉSUMÉ TROP COURT !", {
          attendu: `${minSummaryWords}-${maxSummaryWords}`,
          obtenu: resumeWordCount,
        });
      } else if (resumeWordCount > maxSummaryWords) {
        console.warn("⚠️ [generate-summary] RÉSUMÉ TROP LONG !", {
          attendu: `${minSummaryWords}-${maxSummaryWords}`,
          obtenu: resumeWordCount,
        });
      }
      console.log("[generate-summary] Résumé parsé", {
        hasTitre: !!summary.titre,
        resumeLength: summary.resume?.length || 0,
        pointsClesCount: summary.pointsCles?.length || 0,
        notionsCount: summary.notions?.length || 0,
        durationMinutes: durationMinutesRounded,
        gptMs: timings.gptSummary.toFixed(2),
      });
    } catch (parseError) {
      console.error("[generate-summary] Erreur parsing JSON:", parseError);
      summary = {
        titre: "Résumé",
        resume: textToSend.substring(0, 200) + "...",
        pointsCles: [],
        notions: [],
      };
    }

    const summaryJson = JSON.stringify(summary);
    console.log("[summary] generated", { hasJson: !!summaryJson, size: summaryJson?.length ?? 0, ts: Date.now() });

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
    console.log("[summary] recording updated", { recordingId, ts: Date.now() });

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
    console.log("[summary] end", {
      traceId,
      recordingId,
      contentLen,
      ts: Date.now(),
    });
    timings.dbUpdate = performance.now() - dbUpdateStart;

    timings.total = performance.now() - perfStart;
    console.log("[generate-summary] ⏱️ TIMINGS:", {
      auth: `${timings.auth?.toFixed(2)}ms`,
      dbRead: `${timings.dbRead?.toFixed(2)}ms`,
      dbLock: `${timings.dbLock?.toFixed(2)}ms`,
      gptSummary: `${timings.gptSummary?.toFixed(2)}ms`,
      dbUpdate: `${timings.dbUpdate?.toFixed(2)}ms`,
      total: `${timings.total.toFixed(2)}ms`,
      model: AI_SUMMARY_MODEL,
    });

    return NextResponse.json({
      recordingId,
      summary,
      status: "DONE",
      timings: process.env.NODE_ENV === "development" ? timings : undefined,
    });
  } catch (error) {
    console.error("[generate-summary] Erreur:", error);

    // En cas d'erreur, remettre aiStatus en FAILED si on a le recordingId
    try {
      if (recordingIdForError) {
        await prisma.recording.update({
          where: { id: recordingIdForError },
          data: {
            aiStatus: "FAILED",
            aiFinishedAt: new Date(),
            aiError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    } catch (dbErr) {
      console.error("[generate-summary] Erreur update FAILED:", dbErr);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue lors de la génération du résumé.",
      },
      { status: 500 }
    );
  }
}
