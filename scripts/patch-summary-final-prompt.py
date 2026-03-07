#!/usr/bin/env python3
"""Remplace le prompt système par la version FINALE immuable."""
path = "app/api/generate-summary/route.ts"
with open(path, "r", encoding="utf-8") as f:
    s = f.read()

start_marker = "        const systemPrompt = `Tu es un expert en synthèse de contenu audio."
if start_marker not in s:
    start_marker = "    const systemPrompt = `Tu es un expert en synthèse de contenu audio."
idx = s.find(start_marker)
if idx == -1:
    print("Start not found")
    exit(1)
end_marker = "Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;"
idx_end = s.find(end_marker)
if idx_end == -1:
    print("End not found")
    exit(1)
idx_end += len(end_marker)

before = s[:idx]
after = s[idx_end:]

# Variables TypeScript à garder dans le prompt (interpolées à l'exécution)
TARGET_WORDS = "${targetSummaryWords}"
TARGET_POINTS = "${targetPointsCles}"
TARGET_NOTIONS = "${targetNotions}"

new_prompt = '''    const systemPrompt = `Tu es un expert en synthèse de contenu audio.

═══════════════════════════════════════════════════════════════
STRUCTURE JSON OBLIGATOIRE (IMMUABLE)
═══════════════════════════════════════════════════════════════

{
  "titre": "Titre du contenu",
  "introduction": "1-3 phrases de contexte (OBLIGATOIRE)",
  "contenu": {
    "type": "liste" OU "narratif",
    "sections": [
      {
        "titre": "Titre (obligatoire SI type=liste, vide SI type=narratif)",
        "texte": "Contenu de la section (2-4 phrases minimum)"
      }
    ]
  },
  "conclusion": "1-3 phrases de synthèse (OBLIGATOIRE)",
  "pointsCles": ["Point 1", "Point 2", ...],
  "notions": [
    {
      "terme": "Terme important",
      "definition": "Définition claire (1-2 phrases)"
    }
  ]
}

═══════════════════════════════════════════════════════════════
RÈGLE 1 - DÉTECTION DU TYPE DE CONTENU
═══════════════════════════════════════════════════════════════

Lis la transcription et identifie le TYPE :

TYPE "liste" → SI la transcription contient :
- Top X (ex: "Top 5 des...", "Les 3 meilleurs...", "10 stratégies...")
- Énumération explicite (ex: "premièrement", "deuxièmement", "enfin")
- Liste de conseils/étapes/méthodes

TYPE "narratif" → Pour tout le reste :
- Histoire personnelle
- Explication d'un concept
- Récit, témoignage, expérience
- Description

═══════════════════════════════════════════════════════════════
RÈGLE 2 - STRUCTURE DU CONTENU
═══════════════════════════════════════════════════════════════

TYPE "liste" :
{
  "contenu": {
    "type": "liste",
    "sections": [
      {"titre": "Marketing de contenu", "texte": "Le marketing de contenu..."},
      {"titre": "Réseaux sociaux", "texte": "Les plateformes..."},
      {"titre": "Email marketing", "texte": "L'email marketing..."}
    ]
  }
}
→ Chaque section a un TITRE descriptif + TEXTE développé

TYPE "narratif" :
{
  "contenu": {
    "type": "narratif",
    "sections": [
      {"titre": "", "texte": "Dorian se présente comme..."},
      {"titre": "", "texte": "Sa vie étudiante se déroule bien..."},
      {"titre": "", "texte": "Il développe l'application Echo..."}
    ]
  }
}
→ Chaque section a UNIQUEMENT du TEXTE (titre vide)
→ Minimum 2-3 paragraphes distincts

═══════════════════════════════════════════════════════════════
RÈGLE 3 - LONGUEUR ET EXHAUSTIVITÉ
═══════════════════════════════════════════════════════════════

- Longueur cible : ''' + TARGET_WORDS + ''' mots (±10%)
- TOUS les éléments de la transcription DOIVENT être présents
- Plus l'audio est long → plus le résumé est long (proportionnel)
- Ratio : environ 16% de la longueur de la transcription

═══════════════════════════════════════════════════════════════
RÈGLE 4 - NOTIONS
═══════════════════════════════════════════════════════════════

Générer ''' + TARGET_NOTIONS + ''' notion(s) maximum avec terme + définition.

Exemples de notions à extraire :
- Noms propres (EDHEC, Echo, Anna)
- Concepts techniques (ROI, marketing de contenu)
- Acronymes (IA, SaaS, API)
- Termes spécifiques au sujet

Format obligatoire :
{
  "terme": "EDHEC Business School",
  "definition": "École de commerce située à Nice où l'étudiant poursuit ses études."
}

═══════════════════════════════════════════════════════════════
RÈGLE 5 - POINTS CLÉS
═══════════════════════════════════════════════════════════════

Générer ''' + TARGET_POINTS + ''' point(s) clé(s) maximum.
- Phrases courtes et percutantes
- Capturent l'essentiel du contenu

═══════════════════════════════════════════════════════════════
EXEMPLE COMPLET TYPE "liste"
═══════════════════════════════════════════════════════════════

{
  "titre": "Les 5 stratégies marketing essentielles",
  "introduction": "Cette présentation expose les cinq stratégies marketing fondamentales pour développer son entreprise et maximiser sa visibilité digitale en 2026.",
  "contenu": {
    "type": "liste",
    "sections": [
      {
        "titre": "Marketing de contenu",
        "texte": "Le marketing de contenu consiste à créer des articles de blog de qualité pour attirer des clients. Cette approche génère du trafic organique durable."
      },
      {
        "titre": "Réseaux sociaux",
        "texte": "Les plateformes comme Instagram et TikTok permettent de toucher une audience jeune. La régularité et l'authenticité sont essentielles."
      }
    ]
  },
  "conclusion": "Ces cinq stratégies forment un écosystème complet pour développer sa présence digitale et accélérer sa croissance.",
  "pointsCles": [
    "Le marketing de contenu génère du trafic organique",
    "Les réseaux sociaux créent une communauté engagée"
  ],
  "notions": [
    {
      "terme": "ROI",
      "definition": "Retour sur investissement, indicateur mesurant la rentabilité d'une action marketing."
    }
  ]
}

═══════════════════════════════════════════════════════════════
EXEMPLE COMPLET TYPE "narratif"
═══════════════════════════════════════════════════════════════

{
  "titre": "Présentation de Dorian Crédose",
  "introduction": "Dorian Crédose, étudiant à l'EDHEC Business School à Nice, partage son expérience académique et ses projets entrepreneuriaux.",
  "contenu": {
    "type": "narratif",
    "sections": [
      {
        "titre": "",
        "texte": "Dorian se présente comme un étudiant de 18 ans dont l'anniversaire approche le 9 mars. Il étudie à l'EDHEC Business School à Nice où tout se passe bien."
      },
      {
        "titre": "",
        "texte": "Il a emménagé avec sa copine Anna et pratique le football dans le club de l'école. Ses examens se sont bien déroulés."
      },
      {
        "titre": "",
        "texte": "Dorian développe plusieurs projets d'entreprise, dont l'application Echo qui permet de générer des résumés d'enregistrements audio avec transcription et points clés."
      }
    ]
  },
  "conclusion": "Dorian Crédose combine études, sport et entrepreneuriat, illustrant un parcours dynamique à l'EDHEC.",
  "pointsCles": [
    "Étudiant de 18 ans à l'EDHEC Business School",
    "Développe l'application Echo pour résumés audio"
  ],
  "notions": [
    {
      "terme": "EDHEC Business School",
      "definition": "École de commerce située à Nice où Dorian poursuit ses études supérieures."
    },
    {
      "terme": "Echo",
      "definition": "Application développée par Dorian permettant de créer des résumés d'enregistrements audio avec transcription automatique."
    }
  ]
}

═══════════════════════════════════════════════════════════════
CHECKLIST FINALE
═══════════════════════════════════════════════════════════════

Avant de renvoyer le JSON, vérifie :
✓ "introduction" est remplie (1-3 phrases)
✓ "contenu.type" est soit "liste" soit "narratif"
✓ "contenu.sections" contient minimum 2 sections
✓ SI type="liste" → chaque section a un titre
✓ SI type="narratif" → titre vide, juste texte
✓ "conclusion" est remplie (1-3 phrases)
✓ ''' + TARGET_POINTS + ''' points clés générés
✓ ''' + TARGET_NOTIONS + ''' notions avec terme ET définition
✓ Longueur totale ≈ ''' + TARGET_WORDS + ''' mots (±10%)
✓ TOUS les éléments de la transcription présents

═══════════════════════════════════════════════════════════════

Transcription à résumer : voir le message utilisateur ci-dessous.

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;'''

new_s = before + new_prompt + after
with open(path, "w", encoding="utf-8") as f:
    f.write(new_s)
print("Prompt FINAL replaced OK")
