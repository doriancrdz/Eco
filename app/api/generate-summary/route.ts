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

        const systemPrompt = `Tu es un expert en synthèse de contenu audio.

Tu DOIS générer un résumé structuré au format JSON EXACT suivant.

STRUCTURE JSON OBLIGATOIRE :

{
  "titre": "Titre du contenu",
  "introduction": "Texte de l'introduction (1-3 phrases de contexte)",
  "contenu": {
    "type": "liste" ou "narratif",
    "sections": [
      {
        "titre": "Titre de la section (optionnel si narratif)",
        "texte": "Contenu de la section (2-4 phrases minimum)"
      }
    ]
  },
  "conclusion": "Texte de la conclusion (1-3 phrases de synthèse)",
  "pointsCles": ["Point clé 1", "Point clé 2", ...],
  "notions": [
    {
      "terme": "Terme à retenir",
      "definition": "Définition claire en 1-2 phrases"
    }
  ]
}

RÈGLES STRICTES :

1. INTRODUCTION (obligatoire)
   - 1 à 3 phrases de mise en contexte
   - Présente le sujet global

2. CONTENU (obligatoire)
   - Type "liste" SI la transcription contient une énumération (ex: "Top 5", "3 stratégies", "Les meilleures façons")
   - Type "narratif" SINON
   
   Pour type "liste" :
   - sections : tableau de {titre: "...", texte: "..."}
   - Minimum 2-4 phrases par section
   - Exemple : {titre: "Marketing de contenu", texte: "Le marketing de contenu consiste à..."}
   
   Pour type "narratif" :
   - sections : tableau de {texte: "..."} (titre optionnel, peut être vide)
   - Minimum 2-4 phrases par section
   - Un paragraphe = une section

3. CONCLUSION (obligatoire)
   - 1 à 3 phrases de synthèse globale

4. POINTS CLÉS
   - Générer ${targetPointsCles} points clés maximum
   - Phrases courtes et percutantes

5. NOTIONS
   - Générer ${targetNotions} notions maximum
   - Chaque notion DOIT avoir un "terme" ET une "definition"
   - La définition doit être claire et complète (1-2 phrases)

6. LONGUEUR
   - Le texte total (introduction + contenu + conclusion) doit faire environ ${targetSummaryWords} mots (±10%)

7. EXHAUSTIVITÉ
   - TOUS les éléments de la transcription doivent être présents
   - Ne rien omettre, même pour les longs audios

EXEMPLE DE RÉPONSE ATTENDUE (Type liste) :

{
  "titre": "Les 5 stratégies marketing essentielles",
  "introduction": "Cette présentation expose les cinq stratégies marketing fondamentales pour développer son entreprise en 2026 et maximiser sa visibilité digitale.",
  "contenu": {
    "type": "liste",
    "sections": [
      {
        "titre": "Marketing de contenu",
        "texte": "Le marketing de contenu consiste à créer des articles de blog de qualité pour attirer des clients potentiels. Cette approche génère du trafic organique durable et établit l'autorité de la marque dans son secteur."
      },
      {
        "titre": "Réseaux sociaux",
        "texte": "Les plateformes comme Instagram et TikTok permettent de toucher une audience jeune et engagée. La régularité des publications et l'interaction authentique avec les abonnés sont essentielles pour réussir sur ces canaux."
      }
    ]
  },
  "conclusion": "Ces cinq stratégies marketing forment un écosystème complet pour développer efficacement sa présence digitale et accélérer la croissance de son entreprise.",
  "pointsCles": [
    "Le marketing de contenu génère du trafic organique durable",
    "Les réseaux sociaux permettent de créer une communauté engagée"
  ],
  "notions": [
    {
      "terme": "ROI",
      "definition": "Retour sur investissement, indicateur qui mesure la rentabilité d'une action marketing en comparant les gains obtenus aux coûts engagés."
    }
  ]
}

EXEMPLE DE RÉPONSE ATTENDUE (Type narratif) :

{
  "titre": "Le réchauffement climatique expliqué",
  "introduction": "Ce contenu explique les mécanismes du réchauffement climatique, ses causes principales et les conséquences observables sur notre environnement.",
  "contenu": {
    "type": "narratif",
    "sections": [
      {
        "texte": "Le réchauffement climatique résulte principalement de l'augmentation des gaz à effet de serre dans l'atmosphère, notamment le CO2 émis par la combustion des énergies fossiles. Ces gaz emprisonnent la chaleur solaire et provoquent une élévation progressive des températures mondiales."
      },
      {
        "texte": "Les conséquences sont multiples et déjà observables à l'échelle planétaire. La fonte accélérée des glaciers et des calottes polaires entraîne une montée du niveau des océans qui menace les zones côtières."
      }
    ]
  },
  "conclusion": "Le réchauffement climatique constitue un défi environnemental majeur qui nécessite une action collective urgente pour limiter la hausse des températures.",
  "pointsCles": [
    "Le CO2 des énergies fossiles est la principale cause du réchauffement",
    "La fonte des glaciers entraîne une montée des océans"
  ],
  "notions": [
    {
      "terme": "Gaz à effet de serre",
      "definition": "Gaz présents dans l'atmosphère qui retiennent la chaleur du soleil, provoquant un réchauffement de la planète. Les principaux sont le CO2, le méthane et le protoxyde d'azote."
    }
  ]
}

Transcription à résumer : voir le message utilisateur ci-dessous.

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

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
      '{"titre":"Résumé","introduction":"","contenu":{"type":"narratif","sections":[]},"conclusion":"","pointsCles":[],"notions":[]}';

    let summary: { titre: string; resume: string; pointsCles: string[]; notions: Array<{ terme: string; definition: string }> | string[] };

    // Transforme le JSON structuré (introduction/contenu/conclusion) en markdown avec structure obligatoire
    function structuredJsonToMarkdown(data: {
      introduction?: string;
      contenu?: { type?: string; sections?: Array<{ titre?: string; texte?: string }> };
      conclusion?: string;
    }): string {
      const intro = (data.introduction ?? "").trim();
      const concl = (data.conclusion ?? "").trim();
      const sections = data.contenu?.sections ?? [];
      const typeContenu = (data.contenu?.type ?? "narratif").toLowerCase();

      let resumeMarkdown = `**Introduction:**\n${intro}\n\n\n\n**Contenu:**\n\n`;

      if (typeContenu === "liste") {
        const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          const titre = (section.titre ?? "").trim();
          const texte = (section.texte ?? "").trim();
          const heading = titre ? `${numerals[i]}. ${titre}` : numerals[i];
          resumeMarkdown += `**${heading}**\n${texte}\n\n`;
        }
      } else {
        for (const section of sections) {
          const texte = (section.texte ?? "").trim();
          if (texte) resumeMarkdown += `${texte}\n\n`;
        }
      }

      resumeMarkdown += `\n\n**Conclusion:**\n${concl}`;
      return resumeMarkdown;
    }

    // Normaliser les notions : terme + definition (obligatoire pour le nouveau format)
    function normalizeNotions(notions: unknown): Array<{ terme: string; definition: string }> {
      if (!Array.isArray(notions)) return [];
      return notions.map((n) => {
        if (typeof n === "string") {
          return { terme: n, definition: "" };
        }
        if (typeof n === "object" && n !== null && ("terme" in n || "term" in n)) {
          const term = "terme" in n ? (n as { terme?: string }).terme : (n as { term?: string }).term;
          const def = "definition" in n ? (n as { definition?: string }).definition : "";
          return {
            terme: typeof term === "string" ? term : "",
            definition: typeof def === "string" ? def : "",
          };
        }
        return { terme: String(n), definition: "" };
      });
    }

    try {
      // Nettoyer le contenu (l'IA peut renvoyer du markdown autour du JSON)
      let rawContent = summaryContent.trim();
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) rawContent = jsonMatch[0];

      const parsed = JSON.parse(rawContent) as {
        titre?: string;
        introduction?: string;
        contenu?: { type?: string; sections?: Array<{ titre?: string; texte?: string }> };
        conclusion?: string;
        pointsCles?: string[];
        notions?: Array<{ terme?: string; definition?: string; term?: string }>;
        resume?: string;
        structuredSummary?: StructuredSummary["structuredSummary"];
        keyPoints?: string[];
      };

      // Format nouveau : introduction + contenu + conclusion (structure JSON forcée)
      if (
        parsed.introduction != null &&
        parsed.contenu != null &&
        Array.isArray(parsed.contenu.sections) &&
        parsed.conclusion != null
      ) {
        const resumeMarkdown = structuredJsonToMarkdown(parsed);
        const notionsNorm = normalizeNotions(parsed.notions);
        summary = {
          titre: typeof parsed.titre === "string" ? parsed.titre : "Résumé",
          resume: resumeMarkdown,
          pointsCles: Array.isArray(parsed.pointsCles) ? parsed.pointsCles : [],
          notions: notionsNorm,
        };
      } else if (parsed.titre && parsed.resume !== undefined) {
        // Ancien format (titre + resume texte libre) — rétrocompatibilité
        summary = {
          titre: parsed.titre || "Résumé",
          resume: parsed.resume || "",
          pointsCles: Array.isArray(parsed.pointsCles) ? parsed.pointsCles : [],
          notions: normalizeNotions(parsed.notions),
        };
      } else if (parsed.structuredSummary) {
        const rawSummary: StructuredSummary = {
          structuredSummary: parsed.structuredSummary,
          keyPoints: parsed.keyPoints || [],
          notions:
            (parsed.notions as Array<{ term?: string; definition?: string }>)?.map((n) =>
              typeof n === "string" ? { term: n, definition: "" } : { term: n?.term ?? "", definition: n?.definition ?? "" }
            ) ?? [],
        };
        const legacySummary = toLegacyFormat(rawSummary);
        summary = {
          titre: legacySummary.titre,
          resume: legacySummary.resume,
          pointsCles: legacySummary.pointsCles,
          notions: normalizeNotions(legacySummary.notions),
        };
      } else {
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
