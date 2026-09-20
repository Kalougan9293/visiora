import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CURRENT: Record<string, string> = {
  zPy2sgLU4pZ7Xrjh87uz: 'rachel',
  iYo3urNKUm5TVGCFojl0: 'antoni',
  EXAVITQu4vr4xnSDxMaL: 'bella',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const elevenKey = Deno.env.get('ELEVENLABS_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!elevenKey || !supabaseUrl || !anonKey) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()
  if (userError || !user) return json({ error: 'Unauthorized' }, 401)

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': elevenKey, Accept: 'application/json' },
  })
  if (!res.ok) {
    const detail = await res.text()
    return json({ error: `ElevenLabs ${res.status}: ${detail.slice(0, 200)}` }, 502)
  }

  const payload = (await res.json()) as {
    voices?: Array<{
      voice_id: string
      name: string
      preview_url?: string | null
      category?: string
      labels?: Record<string, string>
      description?: string | null
    }>
  }

  const voices = (payload.voices ?? [])
    .filter((v) => Boolean(v.preview_url))
    .map((v) => ({
      id: v.voice_id,
      name: v.name,
      previewUrl: v.preview_url as string,
      category: v.category ?? '',
      gender: v.labels?.gender ?? '',
      accent: v.labels?.accent ?? '',
      description: v.description ?? '',
      slot: CURRENT[v.voice_id] ?? null,
    }))
    .sort((a, b) => {
      if (a.slot && !b.slot) return -1
      if (!a.slot && b.slot) return 1
      return a.name.localeCompare(b.name, 'fr')
    })

  return json({ voices })
})
