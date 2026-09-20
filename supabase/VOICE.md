# Voice API — ElevenLabs + Edge Function

## Architecture (asynchrone)

```
Créer séance (connecté)
  → insert sessions status=generating
  → invoke Edge Function (réponse 202, le HTTP ne reste pas ouvert)
      → JWT user check
      → script Annexe 1 (marqueurs [pause] / [pause longue])
      → TTS ElevenLabs par morceaux + silences MP3
      → upload Storage audios/{userId}/{sessionId}.mp3 (128 kbps)
      → update status=ready + audio_path
  → le front poll la séance jusqu’à ready / failed
  → lecture via <audio playsInline> + URL signée (jamais de TTS live)
```

Invité (non connecté) : séance `draft` locale, **sans** génération audio.

Le prompt de génération de script n’est **pas** utilisé ici. On traite un script déjà rédigé au format annexe.

## Prérequis

1. Compte [ElevenLabs](https://elevenlabs.io) + clé API
2. [Supabase CLI](https://supabase.com/docs/guides/cli) installé et lié au projet
3. Bucket `audios` déjà créé via `schema.sql`

## Déploiement (à refaire après ce changement)

```bash
# Depuis la racine du repo
npx supabase login
npx supabase link --project-ref TON_PROJECT_REF

# Secret (jamais dans VITE_*)
npx supabase secrets set ELEVENLABS_API_KEY=sk_xxxx

npx supabase functions deploy generate-session-audio
```

Mapping voix app → ElevenLabs :

| App (`q12_voice`) | ElevenLabs Voice ID | Fond | Aperçu |
|-------------------|---------------------|------|--------|
| rituel (Vanessa) | `1zaEYJSYmxoQNiDl5C42` (`ELEVENLABS_VOICE_RITUEL`) | oiseaux (+ musique extrait) | `rituel.mp4` / `rituel-preview.mp3` |
| antoni (Damien) | `iYo3urNKUm5TVGCFojl0` (`ELEVENLABS_VOICE_ANTONI`) | — | `damien.mp4` / `damien-preview.mp3` |
| onde (Sabrina) | `JQ2r7F93aKZaFxO6C5Tu` (`ELEVENLABS_VOICE_ONDE`) | eau | gemini / `onde-preview.mp3` |

Fonds sonores liés à la voix (pas de choix séparé). Boucles app : `public/voices/ambiance-*.mp3`.

## Clone voix « Rituel » (Veo → ElevenLabs)

Sample prêt : `public/voices/rituel-clone-sample.mp3` (extrait de `rituel.mp4`).

1. ElevenLabs → **Voices** → **Add a new voice** → **Instant Voice Clone**
2. Upload `rituel-clone-sample.mp3` (idéalement après nettoyage oiseaux si possible)
3. Nomme la voix `Visiora-Rituel`
4. Copie le **Voice ID**
5. Branche le secret :

```bash
npx supabase secrets set ELEVENLABS_VOICE_RITUEL=VOICE_ID_ICI
npx supabase functions deploy generate-session-audio
```

Tant que le secret n’est pas posé, le profil **Rituel** génère encore avec Justine ; l’extrait UI joue déjà le sample Veo.

## 2ᵉ voix « Onde » — brief Veo 3.1

Objectif : un **2ᵉ timbre** distinct de Rituel, utilisable pour Instant Voice Clone.  
Veo ne sort pas une voix TTS : on génère une **vidéo courte**, on extrait l’audio, on clone.

### Prompt à coller dans Veo (FR)

```
Close-up of a French woman in her 30s, calm face, soft natural light, neutral quiet room. She speaks slowly and clearly in French, warm intimate tone for guided visualization / sophrology — not theatrical, not whispering. Solo female voice only: no music, no birds, no nature sounds, no ambiance, no echo. She says exactly, with natural short pauses between sentences:

« Installe-toi confortablement. Les yeux peuvent se fermer. Sens le contact du sol, le poids du corps. À chaque inspiration, tu es un peu plus présent. À chaque expiration, tu relâches. Tu es en sécurité. »

Keep the camera still. Duration 45–60 seconds if possible. Clean studio-like audio, voice centered and dry.
```

### Après le MP4

1. Déposer le fichier dans `Downloads` (ex. `onde.mp4`)
2. Extraire → `public/voices/onde-clone-sample.mp3` (voix seule, 30–60 s)
3. Instant Voice Clone ElevenLabs → nom `Visiora-Onde`
4. Brancher :

```bash
npx supabase secrets set ELEVENLABS_VOICE_ONDE=VOICE_ID_ICI
npx supabase functions deploy generate-session-audio
```

Différence vs Rituel : **pas d’oiseaux / pas de fond** dans le raw — meilleure base de clone.

## Test du verrou audio

1. Connecte-toi dans l’app
2. Crée une séance (voix + fond Eau / Oiseaux / Spa)
3. Bibliothèque → « Audio en préparation… » puis lecteur MP3
4. Écoute **sur téléphone** (Safari iPhone de préférence)
5. En cas d’échec → « réessayer »

## Limites actuelles

- Fixture au format annexe (pas encore le script 15 min verbatim)
- Sample clone ~10 s (court) — un extrait voix seule 30–60 s améliorera le clone
- Job borné par le wall-clock Edge Function (150 s free / 400 s paid)
