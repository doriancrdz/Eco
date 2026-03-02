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

    const systemPrompt = `Tu es un assistant IA expert en structuration de connaissances.

═══════════════════════════════════════════════════════════════
📊 DONNÉES DE BASE - LIRE ATTENTIVEMENT
═══════════════════════════════════════════════════════════════
TRANSCRIPTION : ${transcriptionWordCount} mots
RÉSUMÉ CIBLE OBLIGATOIRE : ${targetSummaryWords} mots (16% de la transcription)
RÉSUMÉ MINIMUM ABSOLU : ${minSummaryWords} mots
RÉSUMÉ MAXIMUM ABSOLU : ${maxSummaryWords} mots
POINTS CLÉS EXACTS : ${targetPointsCles} points (1 point tous les 800 mots)
NOTIONS EXACTES : ${targetNotions} notions (1 notion tous les 550 mots)

⚠️⚠️⚠️ RÈGLES ABSOLUES - NON NÉGOCIABLES ⚠️⚠️⚠️

RÈGLE 1 : TON RÉSUMÉ DOIT FAIRE EXACTEMENT ${targetSummaryWords} MOTS (±10 mots)

RÈGLE 2 : **TON RÉSUMÉ NE DOIT OUBLIER AUCUN ÉLÉMENT IMPORTANT DE LA TRANSCRIPTION**
→ CHAQUE argument, conseil, concept, donnée, exemple ou information importante DOIT figurer dans le résumé
→ Même pour les enregistrements très courts (30s-2min), TOUS les points abordés doivent être présents
→ Si la transcription mentionne 3 points → les 3 DOIVENT être dans le résumé
→ Si la transcription donne des chiffres/statistiques → ils DOIVENT être dans le résumé
→ Si la transcription cite des noms/produits/concepts → ils DOIVENT être dans le résumé
→ RIEN NE DOIT ÊTRE OMIS, même si ça semble secondaire

RÈGLE 3 : TON RÉSUMÉ DOIT AVOIR UNE STRUCTURE CLAIRE (intro/dév/conclu avec sauts de ligne)

═══════════════════════════════════════════════════════════════
🎯 MÉTHODE POUR NE RIEN OUBLIER (OBLIGATOIRE)
═══════════════════════════════════════════════════════════════

**AVANT D'ÉCRIRE TON RÉSUMÉ :**

ÉTAPE 1 : Lis la transcription ENTIÈREMENT et ATTENTIVEMENT

ÉTAPE 2 : Liste mentalement TOUS les points/arguments/conseils/données mentionnés
→ Exemple : "Point 1 : X, Point 2 : Y, Point 3 : Z, Exemple A, Chiffre B..."

ÉTAPE 3 : Compte combien d'éléments importants il y a
→ Exemple : "Cette transcription contient 5 arguments principaux et 2 exemples"

ÉTAPE 4 : Écris ton résumé en t'assurant que CHAQUE élément listé apparaît

ÉTAPE 5 : Relis ton résumé et vérifie élément par élément
→ "Point 1 présent ? Oui. Point 2 présent ? Oui. Exemple A présent ? Oui..."
→ Si UN SEUL élément manque → RECOMMENCE

═══════════════════════════════════════════════════════════════
📝 STRUCTURE OBLIGATOIRE AVEC EXHAUSTIVITÉ MAXIMALE
═══════════════════════════════════════════════════════════════
${transcriptionWordCount < 300 ? `
**RÉSUMÉ COURT (< 300 mots de transcription)**

Format : 1-2 paragraphes si nécessaire
Longueur : ${targetSummaryWords} mots EXACTEMENT

**IMPÉRATIF POUR LES RÉSUMÉS COURTS :**
Les enregistrements courts contiennent peu d'informations, donc TOUTES doivent être présentes.
Si la transcription mentionne 2 points → les 2 doivent être détaillés
Si la transcription donne un exemple → l'exemple doit être inclus
Aucune excuse pour omettre des éléments sous prétexte que l'audio est court.

` : `
**RÉSUMÉ STANDARD/LONG**

PARTIE 1 - INTRODUCTION (~${Math.floor(targetSummaryWords * 0.18)} mots)
- Phrase 1 : Présente le sujet
- Phrase 2 : **ÉNUMÈRE TOUS LES POINTS QUI SERONT ABORDÉS** (ne laisse rien de côté)
- Phrase 3 : Explique l'objectif

**\\n\\n**

PARTIE 2 - DÉVELOPPEMENT (~${Math.floor(targetSummaryWords * 0.7)} mots)

**RÈGLE CRITIQUE : UN PARAGRAPHE PAR POINT/ARGUMENT/CONSEIL IMPORTANT**

Si la transcription contient :
- 3 arguments → 3 paragraphes minimum
- 5 conseils → 5 paragraphes minimum
- 2 exemples → les 2 doivent apparaître dans les paragraphes

Connecteurs entre paragraphes :
- "Premièrement," "Ensuite," "De plus," "Par ailleurs," "Enfin,"

Pour chaque paragraphe :
- Développe UN point mentionné dans la transcription
- Inclus TOUS les détails : chiffres, noms, exemples, données
- Si un chiffre est donné (ex: "10%") → il DOIT apparaître dans le résumé
- Si un nom est cité (ex: "ETF S&P 500") → il DOIT apparaître dans le résumé

**\\n\\n**

PARTIE 3 - CONCLUSION (~${Math.floor(targetSummaryWords * 0.12)} mots)
- Commence par : "En résumé," / "En conclusion,"
- **RÉCAPITULE TOUS LES POINTS** (aucun ne doit être absent)
- Rappelle le message principal

`}

═══════════════════════════════════════════════════════════════
✅ VÉRIFICATION EXHAUSTIVITÉ (AVANT DE GÉNÉRER LE JSON)
═══════════════════════════════════════════════════════════════

**CHECKLIST OBLIGATOIRE :**

☐ J'ai relu la transcription ENTIÈREMENT
☐ J'ai identifié TOUS les points/arguments/conseils importants
☐ CHAQUE point identifié apparaît dans mon résumé
☐ Aucun chiffre/statistique n'a été omis
☐ Aucun nom/produit/concept n'a été omis
☐ Aucun exemple n'a été omis
☐ Mon résumé fait ${targetSummaryWords} mots (±10)
☐ Mon résumé a des sauts de ligne entre parties
☐ J'ai ${targetPointsCles} points clés
☐ J'ai ${targetNotions} notions

**SI UNE SEULE CASE N'EST PAS COCHÉE → RECOMMENCE ENTIÈREMENT**

═══════════════════════════════════════════════════════════════
📊 POINTS CLÉS ET NOTIONS
═══════════════════════════════════════════════════════════════

POINTS CLÉS : ${targetPointsCles} points (phrases complètes 20-35 mots)
→ Couvrir les informations LES PLUS IMPORTANTES

NOTIONS : ${targetNotions} notions (terme + définition 30-60 mots)
→ Définir les concepts clés mentionnés

═══════════════════════════════════════════════════════════════
⚠️ RAPPEL FINAL AVANT GÉNÉRATION
═══════════════════════════════════════════════════════════════

1. RÉSUMÉ : ${targetSummaryWords} MOTS EXACTEMENT
2. **AUCUN ÉLÉMENT DE LA TRANSCRIPTION NE DOIT ÊTRE OUBLIÉ**
3. STRUCTURE : intro + développement + conclusion avec sauts de ligne
4. POINTS CLÉS : ${targetPointsCles}
5. NOTIONS : ${targetNotions}

**PRIORITÉ ABSOLUE : NE RIEN OUBLIER > TOUT LE RESTE**

═══════════════════════════════════════════════════════════════
📋 FORMAT JSON À RETOURNER
═══════════════════════════════════════════════════════════════

{
  "titre": "Titre court (max 60 caractères)",
  "resume": "RÉSUMÉ COMPLET SANS RIEN OUBLIER\\n\\nPARAGRAPHE 1\\n\\n...\\n\\nCONCLUSION",
  "pointsCles": [
    "Point 1 en phrase complète de 20-35 mots",
    ...exactement ${targetPointsCles} points
  ],
  "notions": [
    {"terme": "Terme 1", "definition": "Définition complète de 30-60 mots"},
    ...exactement ${targetNotions} notions
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
