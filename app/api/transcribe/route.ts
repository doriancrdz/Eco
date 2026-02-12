export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { getOrCreateUserWithQuota, getAvailableMinutes } from "@/lib/billing";
import { PLANS, PlanType } from "@/lib/billingConfig";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // Vérifier authentification Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Clé API OpenAI manquante côté serveur." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const durationSecondsStr = formData.get("durationSeconds");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Aucun fichier audio valide fourni." },
        { status: 400 }
      );
    }

    // Vérifier et parser durationSeconds
    if (!durationSecondsStr || typeof durationSecondsStr !== "string") {
      return NextResponse.json(
        { error: "Durée de l'enregistrement manquante ou invalide." },
        { status: 400 }
      );
    }

    const durationSeconds = parseFloat(durationSecondsStr);
    if (isNaN(durationSeconds) || durationSeconds < 0) {
      return NextResponse.json(
        { error: "Durée de l'enregistrement invalide." },
        { status: 400 }
      );
    }

    // Calculer les minutes nécessaires (arrondi au supérieur)
    const minutesForThisEco = Math.ceil(durationSeconds / 60);

    // Vérifier la limite de 30 minutes par enregistrement
    if (minutesForThisEco > 30) {
      return NextResponse.json(
        {
          error: `Enregistrement trop long (${minutesForThisEco} min). La limite est de 30 minutes par enregistrement.`,
        },
        { status: 400 }
      );
    }

    // Charger l'utilisateur avec gestion automatique du reset mensuel
    const user = await getOrCreateUserWithQuota(userId);
    const planConfig = PLANS[user.plan];
    const availableMinutes = getAvailableMinutes(
      user.plan,
      user.minutesUsedMonth,
      user.extraMinutesMonth
    );

    // Vérifier si le quota est suffisant
    if (minutesForThisEco > availableMinutes) {
      return NextResponse.json(
        {
          error: `Quota insuffisant. Vous avez ${availableMinutes} minute(s) disponible(s) ce mois-ci, mais cet enregistrement nécessite ${minutesForThisEco} minute(s). Veuillez acheter un pack de minutes ou passer à un plan supérieur.`,
          availableMinutes,
          requiredMinutes: minutesForThisEco,
        },
        { status: 402 }
      );
    }

    // Débiter les minutes AVANT l'appel OpenAI (dans une transaction)
    let debitSuccess = false;
    // Stocker les valeurs AVANT le débit pour le rollback si nécessaire
    const beforeDebitMinutesUsed = user.minutesUsedMonth;
    const beforeDebitExtraMinutes = user.extraMinutesMonth;

    try {
      // Débiter les minutes dans une transaction
      await prisma.$transaction(async (tx) => {
        // Relire l'utilisateur pour avoir les dernières valeurs
        const currentUser = await tx.user.findUnique({
          where: { id: user.id },
        });

        if (!currentUser) {
          throw new Error("Utilisateur introuvable");
        }

        // Vérifier à nouveau les quotas (au cas où ils auraient changé)
        const currentAvailable = getAvailableMinutes(
          currentUser.plan as PlanType,
          currentUser.minutesUsedMonth,
          currentUser.extraMinutesMonth
        );

        if (minutesForThisEco > currentAvailable) {
          throw new Error("Quota insuffisant");
        }

        // Débiter les minutes (d'abord les extra, puis les included)
        let remainingToDebit = minutesForThisEco;
        let newExtraMinutes = currentUser.extraMinutesMonth;
        let newUsedMinutes = currentUser.minutesUsedMonth;

        // Débiter d'abord les extra minutes
        if (newExtraMinutes > 0 && remainingToDebit > 0) {
          const debitFromExtra = Math.min(newExtraMinutes, remainingToDebit);
          newExtraMinutes -= debitFromExtra;
          remainingToDebit -= debitFromExtra;
        }

        // Débiter ensuite les minutes incluses
        if (remainingToDebit > 0) {
          newUsedMinutes += remainingToDebit;
        }

        // Mettre à jour dans la transaction
        await tx.user.update({
          where: { id: user.id },
          data: {
            minutesUsedMonth: newUsedMinutes,
            extraMinutesMonth: newExtraMinutes,
          },
        });

        debitSuccess = true;
      });
    } catch (debitError) {
      if (debitError instanceof Error && debitError.message === "Quota insuffisant") {
        return NextResponse.json(
          {
            error: `Quota insuffisant. Vous avez ${availableMinutes} minute(s) disponible(s) ce mois-ci, mais cet enregistrement nécessite ${minutesForThisEco} minute(s). Veuillez acheter un pack de minutes ou passer à un plan supérieur.`,
            availableMinutes,
            requiredMinutes: minutesForThisEco,
          },
          { status: 402 }
        );
      }
      throw debitError;
    }

    // Si le débit a réussi, appeler OpenAI
    // Si OpenAI échoue, on devra rollback le débit
    try {
      // 1) Transcription avec Whisper
      const transcriptionResponse = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "fr",
      });

      const transcription = transcriptionResponse.text;

      // 2) Résumé structuré avec GPT
      const systemPrompt =
        "Tu es un assistant chargé de résumer des transcriptions audio en français. " +
        "Tu dois produire un texte structuré, clair, pédagogique, sans ajout d'information non présente dans la transcription.";

      const userPrompt = `
Voici une transcription (en français). Génère un résumé structuré avec le format suivant :

## Résumé global
<un paragraphe synthétique>

## Points clés
- point 1
- point 2
- ...

## Notions importantes à retenir
- notion 1
- notion 2
- ...

Transcription :
"""${transcription}"""
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      });

      const summary =
        completion.choices[0]?.message?.content ??
        "Résumé indisponible. Une erreur est survenue lors de la génération.";

      // Si tout s'est bien passé, retourner le résultat
      return NextResponse.json(
        {
          transcription,
          summary,
        },
        { status: 200 }
      );
    } catch (openaiError) {
      // Rollback : remettre les valeurs d'avant le débit si OpenAI a échoué
      if (debitSuccess) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              minutesUsedMonth: beforeDebitMinutesUsed,
              extraMinutesMonth: beforeDebitExtraMinutes,
            },
          });
        } catch (rollbackError) {
          console.error("Erreur lors du rollback des minutes:", rollbackError);
          // On log l'erreur mais on ne bloque pas la réponse d'erreur OpenAI
        }
      }

      console.error("Erreur API OpenAI:", openaiError);

      // Mode DEV fallback : retourner une réponse demo si en développement
      if (process.env.NODE_ENV === "development") {
        const demoTranscription = `[Mode démo] Transcription simulée de l'enregistrement audio. Dans un environnement de production, cette transcription serait générée automatiquement par OpenAI Whisper à partir de l'audio enregistré. Durée estimée : ${Math.ceil(durationSeconds / 60)} minute(s).`;

        const demoSummary = `## Résumé global

Cette transcription de démonstration illustre le fonctionnement de l'application ECO en mode développement. En production, le contenu serait généré automatiquement à partir de l'audio réel.

## Points clés

- Transcription automatique via OpenAI Whisper
- Génération de résumé structuré via GPT
- Gestion des quotas mensuels
- Interface minimaliste et intuitive

## Notions importantes à retenir

- L'application permet d'enregistrer de l'audio directement depuis le navigateur
- La transcription est générée automatiquement après l'enregistrement
- Les résumés structurés facilitent la compréhension et la mémorisation
- Le système de quotas permet de gérer l'utilisation des ressources`;

        return NextResponse.json(
          {
            transcription: demoTranscription,
            summary: demoSummary,
            demoMode: true,
            warning: "API OpenAI indisponible, mode démo activé",
          },
          { status: 200 }
        );
      }

      // En production : retourner l'erreur normale
      return NextResponse.json(
        {
          error:
            "Impossible de générer la transcription ou le résumé. Les minutes n'ont pas été débitées. Veuillez réessayer ultérieurement.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Erreur générale:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue lors du traitement de l'enregistrement.",
      },
      { status: 500 }
    );
  }
}
