import { supabase, supabaseAdmin } from './supabase'

export type ListenSample = {
  current: number
  duration: number
  ended: boolean
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

async function userId() {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export const metricsService = {
  async startPlay(sessionId: string): Promise<string | null> {
    if (!supabase) return null
    const uid = await userId()
    if (!uid) return null
    const { data, error } = await supabase
      .from('listen_plays')
      .insert({ user_id: uid, session_id: sessionId })
      .select('id')
      .single()
    if (error || !data) {
      console.warn('[metrics] start play', error?.message)
      return null
    }
    return data.id
  },

  async updatePlay(
    id: string,
    sample: ListenSample,
    maxSeconds: number,
  ): Promise<void> {
    if (!supabase) return
    const uid = await userId()
    if (!uid) return
    const { error } = await supabase
      .from('listen_plays')
      .update({
        duration_seconds: round1(sample.duration),
        stop_seconds: round1(sample.current),
        max_seconds: round1(Math.max(maxSeconds, sample.current)),
        ...(sample.ended ? { completed: true } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', uid)
    if (error) console.warn('[metrics] update play', error.message)
  },

  async touchWizard(id: string, stepNumber: number, questionIds: string): Promise<void> {
    if (!supabase) return
    const uid = await userId()
    if (!uid) return
    const now = new Date().toISOString()
    const { data: existing, error: readError } = await supabase
      .from('wizard_drops')
      .select('completed')
      .eq('id', id)
      .maybeSingle()
    if (readError) {
      console.warn('[metrics] wizard', readError.message)
      return
    }
    if (existing?.completed) return
    const { error } = existing
      ? await supabase
          .from('wizard_drops')
          .update({ step_number: stepNumber, question_ids: questionIds, updated_at: now })
          .eq('id', id)
          .eq('user_id', uid)
      : await supabase.from('wizard_drops').insert({
          id,
          user_id: uid,
          step_number: stepNumber,
          question_ids: questionIds,
          completed: false,
          updated_at: now,
        })
    if (error) console.warn('[metrics] wizard', error.message)
  },

  async completeWizard(id: string): Promise<void> {
    if (!supabase) return
    const uid = await userId()
    if (!uid) return
    const { error } = await supabase
      .from('wizard_drops')
      .update({ completed: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid)
    if (error) console.warn('[metrics] wizard complete', error.message)
  },

  async saveFeedback(sessionId: string, scale: number, remark: string): Promise<boolean> {
    if (!supabase) return false
    const uid = await userId()
    if (!uid) return false
    const text = remark.trim()
    const { error } = await supabase.from('listen_feedback').insert({
      user_id: uid,
      session_id: sessionId,
      scale,
      remark: text || null,
    })
    if (error) {
      console.warn('[metrics] feedback', error.message)
      return false
    }
    return true
  },
}

type PlayRow = {
  user_id: string
  session_id: string
  started_at: string
  duration_seconds: number
  stop_seconds: number
  max_seconds: number
  completed: boolean
  listen_index: number
  days_since_first: number
}

type DropRow = {
  user_id: string
  step_number: number
  question_ids: string
  completed: boolean
  updated_at: string
}

type FeedbackRow = {
  user_id: string
  session_id: string
  scale: number
  scale_before: number | null
  remark: string | null
  created_at: string
}

function cell(value: unknown) {
  const text = value == null ? '' : String(value)
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function percent(max: number, duration: number) {
  if (!duration || duration <= 0) return ''
  return String(Math.round((max / duration) * 100))
}

export async function downloadMetricsCsv(): Promise<void> {
  if (!supabaseAdmin) throw new Error('Supabase non configuré')
  const { data, error } = await supabaseAdmin.rpc('admin_export_metrics')
  if (error) throw error
  const payload = (data ?? {}) as {
    plays?: PlayRow[]
    drops?: DropRow[]
    feedback?: FeedbackRow[]
  }
  const header = [
    'type',
    'utilisateur',
    'seance',
    'date',
    'duree_s',
    'plus_loin_s',
    'arret_s',
    'pourcent',
    'complete',
    'ecoute_n',
    'jours_depuis_premiere',
    'etape',
    'questions',
    'echelle',
    'remarque',
    'note_avant',
  ]
  const lines = [header.join(';')]
  for (const play of payload.plays ?? []) {
    lines.push(
      [
        'ecoute',
        play.user_id,
        play.session_id,
        play.started_at,
        play.duration_seconds,
        play.max_seconds,
        play.stop_seconds,
        percent(Number(play.max_seconds), Number(play.duration_seconds)),
        play.completed ? 'oui' : 'non',
        play.listen_index,
        play.days_since_first,
        '',
        '',
        '',
        '',
        '',
      ]
        .map(cell)
        .join(';'),
    )
  }
  for (const drop of payload.drops ?? []) {
    lines.push(
      [
        'questionnaire',
        drop.user_id,
        '',
        drop.updated_at,
        '',
        '',
        '',
        '',
        drop.completed ? 'oui' : 'non',
        '',
        '',
        drop.step_number,
        drop.question_ids,
        '',
        '',
        '',
      ]
        .map(cell)
        .join(';'),
    )
  }
  for (const row of payload.feedback ?? []) {
    lines.push(
      [
        'apres',
        row.user_id,
        row.session_id,
        row.created_at,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        row.scale,
        row.remark ?? '',
        row.scale_before ?? '',
      ]
        .map(cell)
        .join(';'),
    )
  }
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = 'visiora-mesures.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}
