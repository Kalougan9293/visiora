import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { ADMIN_LIMITS, adminService, formatStorage, type AdminUserRow } from '@/services/admin'
import { healthKeywordsService } from '@/services/healthKeywords'
import { isSupabaseConfigured, supabase } from '@/services/supabase'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

export function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [usersCount, setUsersCount] = useState(0)
  const [audios, setAudios] = useState(0)
  const [storageLabel, setStorageLabel] = useState('—')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [baseKeywords, setBaseKeywords] = useState<string[]>([])
  const [extraKeywords, setExtraKeywords] = useState<string[]>([])
  const [keywordDraft, setKeywordDraft] = useState('')
  const [keywordHint, setKeywordHint] = useState('')
  const [keywordBusy, setKeywordBusy] = useState(false)
  const [tab, setTab] = useState<'users' | 'liste'>('users')

  const refresh = useCallback(() => {
    setLoading(true)
    setLoadError('')
    void adminService
      .loadDashboard()
      .then(({ rows: nextRows, stats }) => {
        setRows(nextRows)
        setUsersCount(stats.users)
        setAudios(stats.audios)
        setStorageLabel(formatStorage(stats.storageBytes))
        if (!isSupabaseConfigured()) {
          setLoadError('Supabase non configuré')
        }
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Erreur chargement')
        setRows([])
        setUsersCount(0)
        setAudios(0)
        setStorageLabel('—')
      })
      .finally(() => setLoading(false))
  }, [])

  /** Session Supabase + flag is_admin */
  useEffect(() => {
    if (!supabase) {
      setChecking(false)
      return
    }

    let mounted = true

    async function checkAdmin() {
      if (!supabase) return
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) {
        if (mounted) {
          setAuthed(false)
          setChecking(false)
        }
        return
      }
      const { data: isAdmin, error: adminErr } = await supabase.rpc('is_current_user_admin')
      if (!mounted) return
      if (adminErr || !isAdmin) {
        setAuthed(false)
        setError(adminErr ? adminErr.message : 'Compte non admin')
        setChecking(false)
        return
      }
      setAuthed(true)
      setChecking(false)
    }

    void checkAdmin()

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void checkAdmin()
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    refresh()
    void healthKeywordsService.snapshot().then((snap) => {
      setBaseKeywords(snap.base)
      setExtraKeywords(snap.extras)
    })
  }, [authed, refresh])

  async function onAddKeyword(e: FormEvent) {
    e.preventDefault()
    const draft = keywordDraft.trim()
    if (!draft || keywordBusy) return
    setKeywordBusy(true)
    setKeywordHint('')
    try {
      const already = [...baseKeywords, ...extraKeywords].some(
        (w) => healthKeywordsService.matchKey(w) === healthKeywordsService.matchKey(draft),
      )
      await healthKeywordsService.add(draft)
      const snap = await healthKeywordsService.snapshot()
      setBaseKeywords(snap.base)
      setExtraKeywords(snap.extras)
      setKeywordDraft('')
      const label = healthKeywordsService.normalizeWord(draft)
      setKeywordHint(already ? `« ${label} » est déjà dans la liste.` : `« ${label} » ajouté.`)
    } finally {
      setKeywordBusy(false)
    }
  }

  async function onRemoveKeyword(word: string) {
    setKeywordBusy(true)
    setKeywordHint('')
    try {
      await healthKeywordsService.remove(word)
      const snap = await healthKeywordsService.snapshot()
      setBaseKeywords(snap.base)
      setExtraKeywords(snap.extras)
      setKeywordHint(`« ${word} » retiré.`)
    } finally {
      setKeywordBusy(false)
    }
  }

  async function onDelete(row: AdminUserRow) {
    const label = [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email || 'ce profil'
    if (!window.confirm(`Supprimer ${label} ?`)) return
    setDeletingId(row.id)
    setLoadError('')
    try {
      await adminService.deleteUser(row.id)
      refresh()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Suppression impossible')
    } finally {
      setDeletingId(null)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) {
      setError('Supabase non configuré')
      return
    }
    if (!email.trim() || !pass) {
      setError('Champs requis')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      })
      if (signErr) {
        setError('Identifiants incorrects')
        return
      }
      const { data: isAdmin, error: adminErr } = await supabase.rpc('is_current_user_admin')
      if (adminErr || !isAdmin) {
        await supabase.auth.signOut()
        setError('Compte non admin')
        return
      }
      setAuthed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut()
    setAuthed(false)
    setEmail('')
    setPass('')
    setError('')
  }

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-atmosphere-dark px-6 text-sm text-[var(--vs-brume)]/70">
        …
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-atmosphere-dark px-6">
        <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-[240px] space-y-3">
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-center text-base text-[var(--vs-lunaire)] outline-none placeholder:text-[var(--vs-brume)]/45 focus:border-[var(--vs-azur)]/50"
            disabled={busy}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-center text-base text-[var(--vs-lunaire)] outline-none placeholder:text-[var(--vs-brume)]/45 focus:border-[var(--vs-azur)]/50"
            disabled={busy}
          />
          {error && <p className="text-xs text-[var(--vs-or)]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[var(--vs-or)] !py-2.5 text-sm font-semibold text-[var(--vs-nuit)] disabled:opacity-60"
          >
            <span>{busy ? '…' : 'OK'}</span>
          </button>
        </form>
      </div>
    )
  }

  return (
    <div
      className="min-h-dvh bg-atmosphere-dark px-4 py-10 text-[var(--vs-lunaire)] sm:px-6"
    >
      <div className="mx-auto w-full max-w-4xl">
        <div className="relative flex items-center justify-center">
          <h1 className="text-center font-display text-2xl tracking-tight text-[var(--vs-ecume)] sm:text-[1.75rem]">
            Tableau de bord
          </h1>
          <button
            type="button"
            onClick={() => void logout()}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wider text-[var(--vs-brume)]/50 transition hover:text-[var(--vs-azur)]"
          >
            Sortir
          </button>
        </div>

        <div className="mt-10 flex justify-center gap-3 sm:gap-4">
          <StatSquare
            value={loading ? '…' : String(usersCount)}
            label="Utilisateurs"
            limit={ADMIN_LIMITS.users}
          />
          <StatSquare
            value={loading ? '…' : String(audios)}
            label="Audios"
            limit={ADMIN_LIMITS.audios}
          />
          <StatSquare
            value={loading ? '…' : storageLabel}
            label="Stockage"
            limit={ADMIN_LIMITS.storage}
          />
        </div>

        {loadError && tab === 'users' && (
          <p className="mt-4 text-center text-xs text-[var(--vs-or)]">{loadError}</p>
        )}

        <div className="mt-8 flex justify-center gap-2">
          <TabBubble active={tab === 'users'} onClick={() => setTab('users')}>
            Users
          </TabBubble>
          <TabBubble active={tab === 'liste'} onClick={() => setTab('liste')}>
            Liste
          </TabBubble>
        </div>

        {tab === 'users' && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/15 bg-white/[0.04]">
          <table className="w-full min-w-[580px] border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-[var(--vs-azur)]/80">
                <th className="px-3 py-3 font-medium">Prénom</th>
                <th className="px-3 py-3 font-medium">Nom</th>
                <th className="px-3 py-3 font-medium">Mail</th>
                <th className="px-3 py-3 font-medium">Audios</th>
                <th className="px-3 py-3 font-medium">Dernière connexion</th>
                <th className="w-10 px-2 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-[var(--vs-brume)]/40">
                    …
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-[var(--vs-brume)]/40">
                    —
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-3 py-3">{r.firstName || '—'}</td>
                    <td className="px-3 py-3">{r.lastName || '—'}</td>
                    <td className="px-3 py-3 text-[var(--vs-brume)]/85">{r.email || '—'}</td>
                    <td className="px-3 py-3 tabular-nums">{r.audioCount}</td>
                    <td className="px-3 py-3 tabular-nums text-[var(--vs-brume)]/55">
                      {formatDate(r.lastSeenAt)}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => void onDelete(r)}
                        disabled={deletingId === r.id}
                        aria-label="Supprimer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--vs-brume)]/45 transition hover:text-[var(--vs-or)] disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}

        {tab === 'liste' && (
        <div className="mt-6 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-5">
          <p className="text-center text-[12px] text-[var(--vs-brume)]/55">
            Si quelqu’un écrit l’un de ces mots dans le questionnaire, l’écran santé s’affiche.
          </p>

          <form onSubmit={(e) => void onAddKeyword(e)} className="mt-4 flex gap-2">
            <input
              type="text"
              value={keywordDraft}
              onChange={(e) => {
                setKeywordDraft(e.target.value)
                if (keywordHint) setKeywordHint('')
              }}
              placeholder="Ajouter un mot"
              className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-[var(--vs-lunaire)] outline-none placeholder:text-[var(--vs-brume)]/40 focus:border-[var(--vs-azur)]/50"
              disabled={keywordBusy}
            />
            <button
              type="submit"
              disabled={keywordBusy || !keywordDraft.trim()}
              className="rounded-xl bg-[var(--vs-lunaire)] px-3 py-2 text-xs font-semibold text-[var(--vs-nuit)] disabled:opacity-40"
            >
              Ajouter
            </button>
          </form>
          {keywordHint && (
            <p className="mt-2 text-center text-[11px] text-[var(--vs-azur)]/80">{keywordHint}</p>
          )}

          <KeywordGrid
            words={baseKeywords}
            busy={keywordBusy}
            onRemove={onRemoveKeyword}
          />
          {extraKeywords.length > 0 && (
            <>
              <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-[var(--vs-azur)]/75">
                Ajoutés
              </p>
              <KeywordGrid
                words={extraKeywords}
                busy={keywordBusy}
                onRemove={onRemoveKeyword}
                added
              />
            </>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

function TabBubble({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-[var(--vs-lunaire)] px-4 py-1.5 text-xs font-semibold text-[var(--vs-nuit)]'
          : 'rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-xs text-[var(--vs-brume)]/80 hover:border-[var(--vs-azur)]/40 hover:text-[var(--vs-lunaire)]'
      }
    >
      {children}
    </button>
  )
}

function KeywordGrid({
  words,
  busy,
  onRemove,
  added = false,
}: {
  words: string[]
  busy: boolean
  onRemove: (word: string) => void
  added?: boolean
}) {
  if (!words.length) {
    return <p className="mt-3 text-center text-[13px] text-[var(--vs-lunaire)]/45">—</p>
  }
  return (
    <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
      {words.map((word) => (
        <li
          key={word}
          className={
            added
              ? 'relative flex min-w-0 items-center justify-center rounded-lg border border-[var(--vs-azur)]/35 bg-[var(--vs-azur)]/10 px-5 py-2'
              : 'relative flex min-w-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-5 py-2'
          }
        >
          <span className="truncate text-center text-xs text-[var(--vs-lunaire)]">{word}</span>
          <button
            type="button"
            onClick={() => onRemove(word)}
            disabled={busy}
            aria-label={`Retirer ${word}`}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-xs leading-none text-[var(--vs-brume)]/50 hover:text-[var(--vs-or)] disabled:opacity-40"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

function StatSquare({
  value,
  label,
  limit,
}: {
  value: string
  label: string
  limit: string
}) {
  return (
    <div className="flex w-[5.5rem] flex-col items-center sm:w-24">
      <div className="flex h-[5.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/[0.05] sm:h-24">
        <p className="text-xl font-semibold tabular-nums text-[var(--vs-ecume)] sm:text-2xl">{value}</p>
        <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--vs-azur)]/75">{label}</p>
      </div>
      <p className="mt-1.5 text-[9px] tabular-nums text-[var(--vs-brume)]/45">max {limit}</p>
    </div>
  )
}
