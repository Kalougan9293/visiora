# Visiora × N8N — orchestration audio (recommandé)

## Pourquoi N8N

Un MP3 de ~15 min = beaucoup d’appels ElevenLabs. Les **Edge Functions Supabase** ont un plafond de durée : elles doivent rester des **workers 1 étape**.

**N8N** (que tu maîtrises) devient le **chef d’orchestre** :
- tourne aussi longtemps que nécessaire
- rappels fiables même si le téléphone est verrouillé
- retries / logs visibles

```
App Visiora
  → crée séance (status=generating)
  → invoke generate-session-audio (JWT user)
      → init audio_job
      → webhook N8N
      → 202 orchestrated:true
  → poll DB (barre eau)

N8N (boucle)
  → POST generate-session-audio (service role + secret orchestrateur)
  → 1 chunk TTS / silences
  → si generating → wait 2s → recommence
  → si ready / failed → stop

Supabase Storage = MP3 final
```

YouTube / lien externe : **non** (séances uniques, privées, critère iPhone).

## Secrets Supabase

```bash
# Secret partagé app ↔ N8N (génère une longue chaîne aléatoire)
npx supabase secrets set VISIORA_ORCHESTRATOR_SECRET=ton_secret_long

# URL du webhook N8N (après import du workflow)
npx supabase secrets set N8N_WEBHOOK_URL=https://TON_N8N/webhook/visiora-audio

npx supabase functions deploy generate-session-audio
```

Sans `N8N_WEBHOOK_URL`, l’app retombe sur le mode Edge seul (filet front).

## Variables N8N

Dans N8N → Settings → Variables (ou env du host) :

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (Dashboard → Settings → API) |
| `VISIORA_ORCHESTRATOR_SECRET` | **le même** que le secret Supabase |

## Import workflow

1. N8N → Workflows → Import from File  
2. Fichier : `n8n/visiora-audio-orchestrator.json`  
3. Active le workflow  
4. Copie l’URL Production du Webhook → `N8N_WEBHOOK_URL`

## Test

1. Secrets posés + function déployée + N8N actif  
2. Crée une séance dans Visiora  
3. Tu dois voir le % / barre eau avancer **sans garder l’app au premier plan**  
4. N8N → Executions : une run qui boucle jusqu’à `ready`

## Sécurité

- Le webhook N8N vérifie `secret`  
- L’Edge Function exige `x-visiora-orchestrator-secret` pour le mode worker  
- Ne jamais exposer `service_role` dans le front (`VITE_*`)
