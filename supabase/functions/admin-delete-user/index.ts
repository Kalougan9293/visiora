import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type StorageAdmin = {
  storage: {
    from: (bucket: string) => {
      list: (
        prefix: string,
        opts: { limit: number },
      ) => Promise<{ data: { name: string; id: string | null }[] | null }>
      remove: (paths: string[]) => Promise<unknown>
    }
  }
}

async function listAudioPaths(admin: StorageAdmin, prefix: string): Promise<string[]> {
  const { data } = await admin.storage.from('audios').list(prefix, { limit: 1000 })
  const paths: string[] = []
  for (const file of data ?? []) {
    if (!file.name) continue
    const path = `${prefix}/${file.name}`
    if (file.id === null) paths.push(...(await listAudioPaths(admin, path)))
    else paths.push(path)
  }
  return paths
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!supabaseUrl || !anonKey || !serviceKey || !authHeader) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let targetId = ''
  try {
    const body = (await req.json()) as { targetId?: string; target_id?: string }
    targetId = (body.targetId || body.target_id || '').trim()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (!targetId) return json({ error: 'targetId required' }, 400)

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
  if (targetId === user.id) return json({ error: 'Tu ne peux pas supprimer ton propre compte.' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: profile } = await admin
    .from('profiles')
    .select('id, is_admin')
    .eq('id', targetId)
    .maybeSingle()
  if (profile?.is_admin) return json({ error: 'Impossible de supprimer un admin.' }, 400)

  try {
    const paths = await listAudioPaths(admin, targetId)
    if (paths.length) await admin.storage.from('audios').remove(paths)
  } catch (err) {
    console.warn('[admin-delete-user] storage', err)
  }

  const { error } = await admin.auth.admin.deleteUser(targetId)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
})
