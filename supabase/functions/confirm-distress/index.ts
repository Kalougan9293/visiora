/**
 * Confirmation IA après détection d’une expression de détresse.
 * Oui uniquement si intention claire, pour soi, aujourd’hui. En cas de doute → non.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM = `Tu es un filtre de sécurité pour une appli de visualisation guidée.
On t’envoie des réponses à un questionnaire, et éventuellement des expressions déjà repérées par un filtre lexical.

Question unique : la personne exprime-t-elle clairement, pour elle-même et aujourd’hui, une envie de mourir, de se suicider, ou de se faire du mal ?

Réponds uniquement par oui ou non (un seul mot, minuscules).

oui = intention claire de se faire du mal ou de mourir, formulée pour soi, au présent.
non = dans tous les autres cas, notamment :
- sens figuré (« je meurs d’envie de… », « finir un marathon », « peur du mur ») ;
- douleur physique ordinaire (« me fait mal ») ;
- solitude affective, envie de rencontrer quelqu’un ;
- propos sur une autre personne ;
- un passé révolu sans intention actuelle ;
- simple présence de mots isolés sans intention ;
- le moindre doute.

En cas de doute, réponds non.`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function parseOuiNon(raw: string): boolean | null {
  const t = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z]+/g, ' ')
    .trim()
  if (!t) return null
  const first = t.split(/\s+/)[0] ?? ''
  if (first === 'oui' || first === 'yes') return true
  if (first === 'non' || first === 'no') return false
  if (/\boui\b/.test(t) && !/\bnon\b/.test(t)) return true
  if (/\bnon\b/.test(t) && !/\boui\b/.test(t)) return false
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim() ?? ''
  if (!apiKey) {
    console.warn('[confirm-distress] ANTHROPIC_API_KEY manquante → non (doute)')
    return json({ confirmed: false, source: 'fallback' })
  }

  let body: { text?: string; matches?: string[] }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'invalid body' }, 400)
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return json({ confirmed: false, source: 'empty' })

  const matches = Array.isArray(body.matches)
    ? body.matches.filter((m): m is string => typeof m === 'string' && Boolean(m.trim()))
    : []

  const model =
    Deno.env.get('VISIORA_DISTRESS_MODEL')?.trim() ||
    Deno.env.get('VISIORA_OPENAI_MODEL')?.trim() ||
    'claude-haiku-4-5-20251001'

  const userContent = [
    matches.length ? `Expressions détectées (filtre lexical) : ${matches.join(', ')}` : null,
    'Réponses du questionnaire :',
    text.slice(0, 8000),
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        system: SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(12_000),
    })
    const raw = await res.text().catch(() => '')
    if (!res.ok) {
      console.warn('[confirm-distress] anthropic', res.status, raw.slice(0, 160))
      return json({ confirmed: false, source: 'fallback' })
    }
    let data: { content?: { type?: string; text?: string }[] }
    try {
      data = JSON.parse(raw) as typeof data
    } catch {
      console.warn('[confirm-distress] JSON invalide → non')
      return json({ confirmed: false, source: 'fallback' })
    }
    const reply =
      data.content?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ') ?? ''
    const parsed = parseOuiNon(reply)
    if (parsed === null) {
      console.warn('[confirm-distress] ambigu → non', reply.slice(0, 80))
      return json({ confirmed: false, source: 'fallback', raw: reply.slice(0, 80) })
    }
    console.info('[confirm-distress]', parsed ? 'oui' : 'non', matches.join('|'))
    return json({ confirmed: parsed, source: 'claude' })
  } catch (err) {
    console.warn('[confirm-distress]', err instanceof Error ? err.message : err)
    return json({ confirmed: false, source: 'fallback' })
  }
})
