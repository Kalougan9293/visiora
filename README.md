# Visiora AI

Application web de visualisation guidée (front-end + Supabase).

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- React Router
- Framer Motion
- PWA (`vite-plugin-pwa`)
- Supabase (Auth, Postgres, Storage)

## Démarrage

```bash
npm install
npm run dev
```

Build production :

```bash
npm run build
npm run preview
```

## Structure

```
src/
  components/   # UI, layout, lecteur audio
  context/      # Auth, thème, séances, variante
  data/         # Wizard (13 questions), science
  pages/        # Accueil, Créer, Bibliothèque, Suivi, Profil, Admin
  services/     # Supabase / sessions / audio / progress
  types/        # Types alignés sur le schéma DB
supabase/       # SQL (schema, admin, phase1_hardening)
```

## Variables d’environnement

Copier `.env.example` → `.env` :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Puis exécuter le SQL (voir `supabase/README.md`).

## Déploiement (Render)

Static Site — config dans `render.yaml` :
- Build : `npm install && npm run build`
- Publish : `dist`
- Rewrite SPA : `/*` → `/index.html`
- Env **Build** obligatoires : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Voice API (ElevenLabs)

Pipeline documenté dans `supabase/VOICE.md` :
1. Déployer l’Edge Function `generate-session-audio`
2. Secret serveur `ELEVENLABS_API_KEY` (jamais dans `.env` Vite)
3. Créer une séance **connecté** → job asynchrone → MP3 en Bibliothèque
