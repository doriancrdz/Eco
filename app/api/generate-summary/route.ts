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

    // Nombre de mots de la transcription — cible FIXE 15-16%
    const transcriptionWordCount = textToSend.trim().split(/\s+/).filter(Boolean).length;
    const targetSummaryWords = Math.round(transcriptionWordCount * 0.155); // 15.5% FIXE
    const minSummaryWords = Math.floor(transcriptionWordCount * 0.14); // 14% minimum
    const maxSummaryWords = Math.ceil(transcriptionWordCount * 0.17); // 17% maximum

    // Calculer la durée en minutes (pour points clés et notions — logique existante conservée)
    const durationMs = recording.durationMs || (recording.durationSeconds ? recording.durationSeconds * 1000 : null);
    const durationMinutesRounded = durationMs ? Math.round((durationMs / 60000) * 10) / 10 : null;
    const durationMinutes = durationMinutesRounded ?? 0;

    // max_tokens très généreux pour forcer GPT à générer assez
    const maxTokens = Math.max(
      4000,
      Math.ceil(maxSummaryWords * 1.5 + 4000)
    );
    console.log("[generate-summary] max_tokens:", maxTokens, "(très généreux pour forcer GPT à générer assez)");

    console.log("[generate-summary] Calcul résumé STRICT:", {
      transcriptionWords: transcriptionWordCount,
      summaryTarget: targetSummaryWords,
      summaryRange: `${minSummaryWords}-${maxSummaryWords} mots`,
      targetPercentage: "15.5%",
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
📊 DONNÉES DE BASE - LIRE ATTENTIVEMENT
═══════════════════════════════════════════════════════════════
TRANSCRIPTION : ${transcriptionWordCount} mots
RÉSUMÉ CIBLE OBLIGATOIRE : ${targetSummaryWords} mots (15.5% de la transcription)
RÉSUMÉ MINIMUM ABSOLU : ${minSummaryWords} mots (14%)
RÉSUMÉ MAXIMUM ABSOLU : ${maxSummaryWords} mots (17%)

⚠️⚠️⚠️ RÈGLE ABSOLUE ⚠️⚠️⚠️
TON RÉSUMÉ DOIT FAIRE EXACTEMENT ${targetSummaryWords} MOTS (±5 mots)
SI TON RÉSUMÉ FAIT MOINS DE ${minSummaryWords} MOTS → TU AS ÉCHOUÉ
SI TON RÉSUMÉ FAIT PLUS DE ${maxSummaryWords} MOTS → TU AS ÉCHOUÉ

${
  transcriptionWordCount < 300
    ? `
═══════════════════════════════════════════════════════════════
RÉSUMÉ COURT (< 300 mots de transcription)
═══════════════════════════════════════════════════════════════
- Format : UN SEUL PARAGRAPHE
- Longueur EXACTE : ${targetSummaryWords} mots
- Points clés : 5-8 points détaillés
- Notions : 4-6 termes avec définitions
`
    : `
═══════════════════════════════════════════════════════════════
📝 STRUCTURE OBLIGATOIRE AVEC SAUTS DE LIGNE
═══════════════════════════════════════════════════════════════

⚠️ IMPÉRATIF : Utilise des sauts de ligne (\\n\\n) pour séparer les parties !

PARTIE 1 - INTRODUCTION (${Math.floor(targetSummaryWords * 0.18)} mots environ)
Commence directement par le contenu, sans titre.
- Phrase 1 : Présente le sujet principal et le contexte
- Phrase 2 : Annonce les thématiques principales
- Phrase 3 : Explique l'objectif de l'enregistrement

Connecteurs : "Dans cet enregistrement,", "Cette présentation aborde...", "L'intervenant explique..."

PUIS : **AJOUTE UN SAUT DE LIGNE (\\n\\n)** AVANT LE DÉVELOPPEMENT

PARTIE 2 - DÉVELOPPEMENT (${Math.floor(targetSummaryWords * 0.7)} mots environ)
Divise en 4-6 paragraphes thématiques.

**RÈGLE CRITIQUE : CHAQUE NOUVEAU PARAGRAPHE COMMENCE PAR UN SAUT DE LIGNE (\\n\\n)**

Paragraphe 1 : Première thématique avec connecteur "Premièrement," ou "Tout d'abord,"
**\\n\\n**
Paragraphe 2 : Deuxième thématique avec connecteur "Ensuite," ou "Par ailleurs,"
**\\n\\n**
Paragraphe 3 : Troisième thématique avec connecteur "De plus," ou "En outre,"
**\\n\\n**
Paragraphe 4 : Quatrième thématique avec connecteur "Quatrièmement," ou "Également,"
**\\n\\n**
Paragraphe 5 : Cinquième thématique avec connecteur "Enfin," ou "Pour finir,"

Chaque paragraphe développe UNE idée/thématique majeure avec arguments, exemples, détails.

PUIS : **AJOUTE UN SAUT DE LIGNE (\\n\\n)** AVANT LA CONCLUSION

PARTIE 3 - CONCLUSION (${Math.floor(targetSummaryWords * 0.12)} mots environ)
Commence par un connecteur : "En résumé,", "En conclusion,", "Pour conclure,", "Ainsi,"
- Synthétise les points principaux
- Rappelle le message clé
- Propose éventuellement une ouverture

═══════════════════════════════════════════════════════════════
✅ EXEMPLE DE FORMAT AVEC SAUTS DE LIGNE
═══════════════════════════════════════════════════════════════

MAUVAIS (tout en un bloc) :
"Dans cet enregistrement, Mathieu présente... Premièrement, il souligne... Ensuite, il présente... En résumé, il offre..."

BON (avec sauts de ligne) :
"Dans cet enregistrement, Mathieu présente les stratégies d'investissement pour 1000€. Il aborde la bourse, le crowdfunding, l'ESCPI, les crypto et l'or. L'objectif est de fournir des conseils pratiques.

Premièrement, il souligne l'importance de la bourse, recommandant d'investir dans des ETF comme le S&P 500. Il insiste sur le potentiel des intérêts composés pour faire croître le capital.

Ensuite, il présente le crowdfunding immobilier, accessible dès 1€, avec des rendements attractifs d'environ 10% par an. Louvet mentionne des plateformes comme Clubfunding.

En troisième position, il évoque l'ESCPI, qui permet d'investir dans l'immobilier locatif sans gestion directe. Il recommande de choisir des ESCPI avec de bons rendements.

Quatrièmement, il aborde les crypto-monnaies, en soulignant leur volatilité. Il propose d'investir une petite part dans Bitcoin ou Ethereum.

Enfin, il conclut avec l'or, considéré comme une valeur refuge.

En résumé, Louvet offre un cadre structuré pour investir 1000€, en mettant l'accent sur la diversification et la gestion des risques."

═══════════════════════════════════════════════════════════════
📊 POINTS CLÉS ET NOTIONS
═══════════════════════════════════════════════════════════════

${durationMinutes < 3 ? `
POINTS CLÉS : 5-8 points détaillés (phrases complètes de 15-20 mots)
NOTIONS : 4-6 termes avec définitions (20-30 mots par définition)
` : durationMinutes < 10 ? `
POINTS CLÉS : 10-15 points détaillés (phrases complètes de 15-25 mots)
NOTIONS : 8-12 termes avec définitions complètes (25-40 mots par définition)
` : durationMinutes < 30 ? `
POINTS CLÉS : 18-25 points détaillés (phrases complètes de 20-30 mots)
NOTIONS : 12-18 termes avec définitions complètes (30-50 mots par définition)
` : `
POINTS CLÉS : 25-35 points très détaillés (phrases complètes de 20-35 mots)
NOTIONS : 18-28 termes avec définitions très complètes (35-60 mots par définition)
`}

═══════════════════════════════════════════════════════════════
⚠️ VÉRIFICATION FINALE AVANT DE GÉNÉRER LE JSON
═══════════════════════════════════════════════════════════════

VÉRIFIE ABSOLUMENT :
☐ Mon résumé fait EXACTEMENT ${targetSummaryWords} mots (compte-les !)
☐ Mon résumé a des SAUTS DE LIGNE (\\n\\n) entre intro/dév/conclu
☐ Mon résumé a des SAUTS DE LIGNE (\\n\\n) entre chaque paragraphe du développement
☐ Mon résumé N'A PAS de titres "INTRODUCTION", "DÉVELOPPEMENT", "CONCLUSION"
☐ Mon résumé utilise des connecteurs logiques ("Premièrement,", "Ensuite,", "En conclusion,")
☐ Mes points clés sont des phrases complètes détaillées
☐ Mes notions ont des définitions complètes

SI UNE SEULE CASE N'EST PAS COCHÉE → RECOMMENCE TON RÉSUMÉ ENTIÈREMENT
`
}

Format JSON strict :
{
  "titre": "Titre court (max 60 caractères)",
  "resume": "INTRODUCTION AVEC CONNECTEURS\\n\\nPARAGRAPHE 1 DU DÉV\\n\\nPARAGRAPHE 2 DU DÉV\\n\\nPARAGRAPHE 3 DU DÉV\\n\\nCONCLUSION AVEC CONNECTEUR",
  "pointsCles": ["Point 1 en phrase complète détaillée", "Point 2...", ...],
  "notions": [
    {"terme": "Terme 1", "definition": "Définition complète et détaillée"},
    ...
  ]
}

RAPPEL ULTIME : ${targetSummaryWords} MOTS EXACTEMENT AVEC SAUTS DE LIGNE ENTRE CHAQUE PARTIE ET PARAGRAPHE`;

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
