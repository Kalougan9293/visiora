import { HEALTH_KEYWORDS, healthMatchKey } from '@/services/healthGate'
import { isSupabaseConfigured, supabase, supabaseAdmin } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

const LS_KEY = 'visiora-health-keywords'
const LS_REMOVED = 'visiora-health-keywords-removed'

function normalizeWord(text: string) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function sameKey(a: string, b: string) {
  return healthMatchKey(a) === healthMatchKey(b)
}

function readJsonList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((w): w is string => typeof w === 'string' && Boolean(w.trim()))
  } catch {
    return []
  }
}

function writeJsonList(key: string, words: string[]) {
  const next = uniqueByMatchKey(words).sort((a, b) => a.localeCompare(b, 'fr'))
  localStorage.setItem(key, JSON.stringify(next))
  return next
}

function preferredLabel(key: string, candidates: string[]) {
  const fromDefault = HEALTH_KEYWORDS.find((w) => healthMatchKey(w) === key)
  if (fromDefault) return fromDefault
  return normalizeWord(candidates[0] ?? key)
}

function uniqueByMatchKey(words: string[]): string[] {
  const groups = new Map<string, string[]>()
  for (const raw of words) {
    const key = healthMatchKey(raw)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(raw)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([key, group]) => preferredLabel(key, group))
    .sort((a, b) => a.localeCompare(b, 'fr'))
}

export type HealthKeywordsSnapshot = {
  all: string[]
  base: string[]
  extras: string[]
}

export const healthKeywordsService = {
  normalizeWord,
  matchKey: healthMatchKey,

  defaults(): string[] {
    return uniqueByMatchKey([...HEALTH_KEYWORDS])
  },

  async snapshot(client?: DbClient | null): Promise<HealthKeywordsSnapshot> {
    const all = await this.list(client)
    const defaultKeys = new Set(this.defaults().map(healthMatchKey))
    const extras = all.filter((w) => !defaultKeys.has(healthMatchKey(w)))
    const base = all.filter((w) => defaultKeys.has(healthMatchKey(w)))
    return { all, base, extras }
  },

  async list(client?: DbClient | null): Promise<string[]> {
    const dbClient = client ?? supabase
    let db: string[] = []
    if (isSupabaseConfigured() && dbClient) {
      const { data, error } = await dbClient.from('health_keywords').select('word').order('word')
      if (!error && data) {
        db = data.map((row) => String(row.word ?? '')).filter(Boolean)
      }
    }
    const extra = readJsonList(LS_KEY)
    const removed = readJsonList(LS_REMOVED)
    const merged = uniqueByMatchKey([...HEALTH_KEYWORDS, ...db, ...extra])
    return merged.filter((w) => !removed.some((r) => sameKey(r, w)))
  },

  async add(word: string, client?: DbClient | null): Promise<string[]> {
    const dbClient = client ?? supabaseAdmin ?? supabase
    const normalized = normalizeWord(word)
    if (!healthMatchKey(normalized)) return this.list(dbClient)
    const current = await this.list(dbClient)
    if (current.some((w) => sameKey(w, normalized))) return current
    if (isSupabaseConfigured() && dbClient) {
      const { error } = await dbClient.from('health_keywords').insert({ word: normalized })
      if (error && !/relation|does not exist|schema cache|duplicate/i.test(error.message)) {
        console.warn('[health-keywords] insert', error.message)
      }
    }
    writeJsonList(
      LS_REMOVED,
      readJsonList(LS_REMOVED).filter((w) => !sameKey(w, normalized)),
    )
    writeJsonList(LS_KEY, [...readJsonList(LS_KEY), normalized])
    return this.list(dbClient)
  },

  async remove(word: string, client?: DbClient | null): Promise<string[]> {
    const dbClient = client ?? supabaseAdmin ?? supabase
    const key = healthMatchKey(word)
    if (!key) return this.list(dbClient)
    const aliases = uniqueByMatchKey([
      word,
      ...this.defaults(),
      ...readJsonList(LS_KEY),
      ...readJsonList(LS_REMOVED),
    ]).filter((w) => healthMatchKey(w) === key)

    if (isSupabaseConfigured() && dbClient) {
      const { data } = await dbClient.from('health_keywords').select('word')
      const toDelete = (data ?? [])
        .map((row) => String(row.word ?? ''))
        .filter((w) => healthMatchKey(w) === key)
      if (toDelete.length) {
        const { error } = await dbClient.from('health_keywords').delete().in('word', toDelete)
        if (error && !/relation|does not exist|schema cache/i.test(error.message)) {
          console.warn('[health-keywords] delete', error.message)
        }
      }
    }
    writeJsonList(
      LS_KEY,
      readJsonList(LS_KEY).filter((w) => healthMatchKey(w) !== key),
    )
    writeJsonList(LS_REMOVED, [...readJsonList(LS_REMOVED), ...aliases, word])
    return this.list(dbClient)
  },
}
