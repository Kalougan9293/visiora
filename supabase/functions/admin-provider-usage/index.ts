import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type ElevenMeter =
  | { status: 'ready'; characters: number; limit: number | null }
  | { status: 'missing' }
  | { status: 'error' }

type AnthropicMeter =
  | { status: 'ready'; usd: number }
  | { status: 'missing' }
  | { status: 'error' }

function monthWindow(): { startingAt: string; endingAt: string } {
  const now = new Date()
  const startingAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const endingAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
  return { startingAt, endingAt }
}

async function readEleven(key: string | undefined): Promise<ElevenMeter> {
  if (!key?.trim()) return { status: 'missing' }
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': key.trim(), Accept: 'application/json' },
    })
    if (!res.ok) return { status: 'error' }
    const body = await res.json() as {
      subscription?: { character_count?: unknown; character_limit?: unknown }
    }
    const characters = Number(body.subscription?.character_count)
    const limit = Number(body.subscription?.character_limit)
    if (!Number.isFinite(characters)) return { status: 'error' }
    return {
      status: 'ready',
      characters,
      limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    }
  } catch {
    return { status: 'error' }
  }
}

async function readAnthropic(key: string | undefined): Promise<AnthropicMeter> {
  if (!key?.trim()) return { status: 'missing' }
  const { startingAt, endingAt } = monthWindow()
  let page: string | null = null
  let cents = 0
  try {
    for (let guard = 0; guard < 6; guard++) {
      const url = new URL('https://api.anthropic.com/v1/organizations/cost_report')
      url.searchParams.set('starting_at', startingAt)
      url.searchParams.set('ending_at', endingAt)
      url.searchParams.set('bucket_width', '1d')
      url.searchParams.set('limit', '31')
      if (page) url.searchParams.set('page', page)
      const res = await fetch(url, {
        headers: {
          'x-api-key': key.trim(),
          'anthropic-version': '2023-06-01',
          Accept: 'application/json',
        },
      })
      if (!res.ok) return { status: 'error' }
      const body = await res.json() as {
        data?: { results?: { amount?: unknown }[] }[]
        has_more?: boolean
        next_page?: string | null
      }
      for (const bucket of body.data ?? []) {
        for (const row of bucket.results ?? []) {
          const amount = Number(row.amount)
          if (Number.isFinite(amount)) cents += amount
        }
      }
      if (!body.has_more || !body.next_page) break
      page = body.next_page
    }
    // Le rapport Anthropic donne des centimes de dollar.
  } catch {
    return { status: 'error' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!supabaseUrl || !anonKey || !authHeader) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()
  if (userError || !user) return json({ error: 'Unauthorized' }, 401)

  const { data: isAdmin, error: adminErr } = await userClient.rpc('is_current_user_admin')
  if (adminErr || !isAdmin) return json({ error: 'Compte non admin' }, 403)

  const adminKey = Deno.env.get('ANTHROPIC_ADMIN_KEY')?.trim() ?? ''
  if (!adminKey) {
    return json({
      eleven: { status: 'missing' },
      anthropic: { status: 'missing' },
    })
  }

  const [eleven, anthropic] = await Promise.all([
    readEleven(Deno.env.get('ELEVENLABS_API_KEY')),
    readAnthropic(adminKey),
  ])
  return json({ eleven, anthropic })
})
