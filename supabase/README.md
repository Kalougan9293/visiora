# Setup Supabase — Visiora

## 1. Créer le projet
Dashboard Supabase → New project (dédié client Visiora).

## 2. Schéma SQL (projet neuf)
SQL Editor → coller et exécuter dans l’ordre :
1. `supabase/schema.sql`
2. `supabase/admin.sql`

Cela crée :
- `profiles` (prénom, nom, mail, CGU, `is_admin`, last_seen)
- `sessions` (métadonnées séances + chemins audio)
- trigger profil à l’inscription + protection `is_admin`
- bucket Storage privé `audios` + policies RLS
- RPCs admin **réservées** aux profils `is_admin = true` (plus d’accès `anon`)

## 2b. Projet déjà en prod (Phase 1 — durcissement)
SQL Editor → `supabase/phase1_hardening.sql`  
Puis : `update public.profiles set is_admin = true where email = '…';`

## 2c. Admin temporaire (jonathan / france)
Le front `/admin` utilise encore le login UI `jonathan` / `france`.  
Si tu as déjà exécuté `phase1_hardening.sql`, le dashboard peut afficher `not authorized` :
→ exécute alors **`supabase/admin_temp_dev.sql`** pour rouvrir les RPCs le temps du dev.  
Quand tu bascules sur le vrai admin : ré-exécute `phase1_hardening.sql`.

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

## Admin `/admin`
Connexion avec le **même compte Supabase Auth** que l’app (email + mot de passe).
Sans `is_admin = true` → accès refusé. Les RPCs refusent aussi les non-admins côté base.

## Stockage audio / Voice API
Voir **`supabase/VOICE.md`** pour déployer l’Edge Function `generate-session-audio` et configurer `ELEVENLABS_API_KEY`.

Convention : `audios/{user_id}/{session_id}.mp3`  
Champs DB : `audio_path`, `audio_url`, `audio_bytes`, `voice_id`, `status`.
