# Visiora AI

Application web de visualisation mentale et méditation guidée (front-end).

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- React Router
- Framer Motion
- PWA (`vite-plugin-pwa`)

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
  context/      # Thème Dark/Light, séances
  data/         # Questionnaire (13 questions), science
  pages/        # Accueil, Créer, Bibliothèque, Suivi, Profil
  services/     # Stubs Supabase / sessions / audio / progress
  types/        # Types prêts pour le backend
```

## Variables d’environnement

Copier `.env.example` → `.env` :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Puis exécuter `supabase/schema.sql` dans le SQL Editor (voir `supabase/README.md`).

## Déploiement (Render)

Le build produit un site statique dans `dist/`. Sur Render : Static Site, build `npm run build`, publish `dist`.
