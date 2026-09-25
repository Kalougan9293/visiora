# Voice API — ElevenLabs + Edge Function (+ N8N recommandé)

## Architecture cible (meilleure)

```
App
  → séance generating
  → Edge Function (init + webhook N8N) → 202
  → poll DB + barre eau

N8N
  → boucle : 1 chunk Edge Function jusqu’à ready/failed

Edge Function
  → 1 étape TTS/silence, reprise crédit-safe, Storage MP3
```

Sans N8N : l’Edge Function traite quand même des chunks + filet front (moins fiable sur 15 min / iPhone verrouillé).

**Guide N8N complet :** [`N8N.md`](./N8N.md) + workflow `n8n/visiora-audio-orchestrator.json`.

YouTube / lien externe : **non** pour le produit (séances uniques + lecture privée mobile).

## Durée

Chaque séance part sur le script complet (environ 15 minutes). Il n’y a plus de raccourci à 15 secondes.

## Prérequis

1. ElevenLabs API key  
2. Supabase CLI lié  
3. Bucket `audios` + colonne `audio_job` (`async_audio_job.sql`)  
4. *(Reco)* N8N avec secrets — voir `N8N.md`

## Déploiement function

```bash
npx supabase secrets set ELEVENLABS_API_KEY=sk_xxxx
# optionnel mais recommandé :
npx supabase secrets set VISIORA_ORCHESTRATOR_SECRET=une_longue_chaine
npx supabase secrets set N8N_WEBHOOK_URL=https://TON_N8N/webhook/visiora-audio

npx supabase functions deploy generate-session-audio
```

Mapping voix : voir secrets `ELEVENLABS_VOICE_*` (Rituel / Antoni / Onde).

## Test

1. N8N actif (si branché) + function déployée  
2. Créer une séance connecté  
3. Bibliothèque : barre eau, **pas** de bouton Nouvelle pendant la génération  
4. iPhone Safari, y compris écran verrouillé si N8N orchestre  
5. Réessayer = reprise sans re-facturer les segments déjà OK
