# ECO - Dictaphone IA

Application web SaaS permettant d'enregistrer de l'audio depuis le navigateur et de transformer automatiquement cette information orale en contenu écrit structuré (transcription + résumé).

## Installation

```bash
npm install
```

## Démarrage

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## Fonctionnalités

- ✅ Enregistrement audio via navigateur (MediaRecorder)
- ✅ Focus Mode pendant l'enregistrement
- ✅ Transcription automatique post-enregistrement
- ✅ Résumé structuré en texte
- ✅ Organisation par dossiers (Travail, Études, Personnel)
- ✅ Navigation latérale claire
- ✅ UI minimaliste premium

## Stack Technique

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React

## Notes

- Les données sont stockées localement dans le navigateur (localStorage)
- La transcription et le résumé sont simulés dans cette version MVP
- Pour une version de production, intégrer une API de transcription (ex: OpenAI Whisper) et une API LLM pour le résumé
