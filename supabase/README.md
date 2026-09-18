# Setup Supabase — Visiora

## 1. Créer le projet
Dashboard Supabase → New project (dédié client Visiora).

## 2. Schéma SQL
SQL Editor → coller et exécuter `supabase/schema.sql`

Cela crée :
- `profiles` (prénom, nom, mail, CGU, last_seen)
- `sessions` (métadonnées séances + chemins audio)
- trigger profil à l’inscription
- bucket Storage privé `audios` + policies RLS

## 2b. Admin (tableau de bord)
SQL Editor → exécuter aussi `supabase/admin.sql`

RPCs : `admin_list_users`, `admin_dashboard_stats` (lecture globale pour `/admin`).
À durcir plus tard (ne plus exposer en `anon`).

## 3. Auth
Authentication → Providers → Email activé.
Optionnel : désactiver “Confirm email” en dev pour tester sans boîte mail.

## 4. Clés front
Copier Project URL + anon key dans `.env` :

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Puis relancer `npm run dev`.

## Stockage audio (plus tard)
Convention : `audios/{user_id}/{session_id}.mp3`  
Champs DB prêts : `audio_path`, `audio_url`, `audio_bytes`, `voice_id`.  
Upload / quotas / garde-fous : à brancher dans `src/services/audioStorage.ts`.
