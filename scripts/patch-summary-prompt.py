#!/usr/bin/env python3
# Remplace le prompt système par le format JSON structuré (generate-summary)
import re

path = "app/api/generate-summary/route.ts"
with open(path, "r", encoding="utf-8") as f:
    s = f.read()

# Début du prompt actuel (unique)
start_marker = "    const systemPrompt = `Tu es un expert en synthèse de contenu audio. Tu génères des résumés structurés"
# Fin : dernier caractère avant "`;" du systemPrompt
# On cherche la fin du bloc backtick qui termine le prompt
pattern = r"(\s+)const systemPrompt = `.*?`;"
# On va plutôt faire : trouver "const systemPrompt = `" puis trouver "`;" qui suit (dernier backtick-quote-semicolon du bloc)
idx = s.find("const systemPrompt = `")
if idx == -1:
    print("systemPrompt start not found")
    exit(1)
# Trouver le closing "`;" - le prompt contient des backticks dans le texte ? Non, pas de ` dans le contenu.
# Cherchons "AUCUNE EXCEPTION.`;" qui est la fin actuelle
end_marker = "AUCUNE EXCEPTION.`;"
idx_end = s.find(end_marker)
if idx_end == -1:
    print("end marker not found")
    exit(1)
idx_end += len(end_marker)

before = s[:idx]
after = s[idx_end:]

new_prompt = '''    const systemPrompt = `Tu es un expert en synthèse de contenu audio.

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
   - Générer ''' + "${targetPointsCles}" + ''' points clés maximum
   - Phrases courtes et percutantes

5. NOTIONS
   - Générer ''' + "${targetNotions}" + ''' notions maximum
   - Chaque notion DOIT avoir un "terme" ET une "definition"
   - La définition doit être claire et complète (1-2 phrases)

6. LONGUEUR
   - Le texte total (introduction + contenu + conclusion) doit faire environ ''' + "${targetSummaryWords}" + ''' mots (±10%)

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

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;'''

new_s = before + new_prompt + after
with open(path, "w", encoding="utf-8") as f:
    f.write(new_s)
print("Prompt replaced OK")
