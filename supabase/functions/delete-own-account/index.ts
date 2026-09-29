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

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()
  if (userError || !user) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await admin
    .from('profiles')
    .select('id, is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.is_admin) return json({ error: 'cannot delete an admin account' }, 400)

  try {
    const paths = await listAudioPaths(admin, user.id)
    if (paths.length) await admin.storage.from('audios').remove(paths)
  } catch (err) {
    console.warn('[delete-own-account] storage', err)
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
})
