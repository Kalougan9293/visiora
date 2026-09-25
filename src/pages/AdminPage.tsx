import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { ADMIN_LIMITS, adminService, formatStorage, type AdminSharedSession, type AdminUserRow } from '@/services/admin'
import { WIZARD_STEPS } from '@/data/wizard'
import { healthKeywordsService } from '@/services/healthKeywords'
import { downloadMetricsCsv } from '@/services/metrics'
import { authService } from '@/services/auth'
import { isSupabaseConfigured, supabaseAdmin as supabase } from '@/services/supabase'

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
  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    root.classList.add('dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    const prev = meta?.getAttribute('content') ?? null
    meta?.setAttribute('content', '#020C25')
    return () => {
      if (!hadDark) root.classList.remove('dark')
      if (meta && prev) meta.setAttribute('content', prev)
    }
  }, [])

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
  const [tab, setTab] = useState<'users' | 'liste' | 'partage'>('users')
  const [shared, setShared] = useState<AdminSharedSession[]>([])
  const [sharedError, setSharedError] = useState('')
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)

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
    setSharedError('')
    void adminService.listSharedSessions().then(setShared).catch((err: unknown) => {
      setShared([])
      setSharedError(err instanceof Error ? err.message : 'Lecture impossible')
    })
    void healthKeywordsService.snapshot(supabase).then((snap) => {
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
      await healthKeywordsService.add(draft, supabase)
      const snap = await healthKeywordsService.snapshot(supabase)
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
      await healthKeywordsService.remove(word, supabase)
      const snap = await healthKeywordsService.snapshot(supabase)
      setBaseKeywords(snap.base)
      setExtraKeywords(snap.extras)
      setKeywordHint(`« ${word} » retiré.`)
    } finally {
      setKeywordBusy(false)
    }
  }

  async function onDelete(row: AdminUserRow) {
    const label = row.firstName || row.email || 'ce profil'
    if (!window.confirm(`Supprimer ${label} ?`)) return
    setDeletingId(row.id)
    setLoadError('')
    try {
      await adminService.deleteUser(row.id)
      refresh()
      setShared((prev) => prev.filter((session) => session.userId !== row.id))
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
        await supabase.auth.signOut({ scope: 'local' })
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
    if (supabase) await supabase.auth.signOut({ scope: 'local' })
    setAuthed(false)
    setEmail('')
    setPass('')
    setError('')
  }

  if (checking) {
    return (
      <div className="admin-root dark flex min-h-dvh items-center justify-center bg-[#020c25] px-6 text-sm text-[#e9eff4]">
        …
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="admin-root dark flex min-h-dvh items-center justify-center bg-[#020c25] px-6">
        <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-[240px] space-y-3">
          <input
            type="email"
            autoComplete="off"
            name="visiora-admin-email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-black/25 bg-black/[0.03] dark:border-white/20 dark:bg-white/10 px-3 py-2.5 text-center text-base text-black dark:text-white outline-none placeholder:text-black/50 dark:placeholder:text-white focus:border-[var(--vs-azur)]/50"
            disabled={busy}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="w-full rounded-xl border border-black/25 bg-black/[0.03] dark:border-white/20 dark:bg-white/10 px-3 py-2.5 text-center text-base text-black dark:text-white outline-none placeholder:text-black/50 dark:placeholder:text-white focus:border-[var(--vs-azur)]/50"
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!email.trim()) {
                setError('Indique l’e-mail')
                return
              }
              setBusy(true)
              setError('')
              void authService
                .requestPasswordReset(email)
                .then(() => setError('Un e-mail vient de partir pour choisir un nouveau mot de passe.'))
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Envoi impossible'))
                .finally(() => setBusy(false))
            }}
            className="w-full text-[11px] text-black dark:text-white hover:text-black dark:hover:text-white"
          >
            Mot de passe oublié ?
          </button>
          {error && (
            <p className="text-xs text-black dark:text-white">
              {error}
            </p>
          )}
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
      className="admin-root dark min-h-dvh bg-[#020c25] px-4 py-10 text-[#e9eff4] sm:px-6"
    >
      <div className="mx-auto w-full max-w-4xl">
        <div className="relative flex items-center justify-center">
          <h1 className="text-center font-display text-2xl tracking-tight text-black dark:text-white sm:text-[1.75rem]">
            Tableau de bord
          </h1>
          <button
            type="button"
            onClick={() => void logout()}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wider text-black dark:text-white transition hover:text-black dark:hover:text-white"
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

        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => {
              setExporting(true)
              setExportError('')
              void downloadMetricsCsv()
                .catch((err: unknown) => {
                  setExportError(err instanceof Error ? err.message : 'Export impossible')
                })
                .finally(() => setExporting(false))
            }}
            className="text-base font-medium text-black dark:text-white underline decoration-black/40 dark:decoration-white/70 underline-offset-4 disabled:opacity-40"
          >
            {exporting ? '…' : 'Télécharger les mesures'}
          </button>
          {exportError && <p className="text-center text-xs text-black dark:text-white">{exportError}</p>}
        </div>

        {loadError && tab === 'users' && (
          <p className="mt-4 text-center text-xs text-black dark:text-white">{loadError}</p>
        )}

        <div className="mt-8 flex justify-center gap-2">
          <TabBubble active={tab === 'users'} onClick={() => setTab('users')}>
            Users
          </TabBubble>
          <TabBubble active={tab === 'liste'} onClick={() => setTab('liste')}>
            Liste
          </TabBubble>
          <TabBubble active={tab === 'partage'} onClick={() => setTab('partage')}>
            Partagées
          </TabBubble>
        </div>

        {tab === 'users' && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/15 bg-white/[0.04]">
          <table className="w-full min-w-[480px] border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-black dark:text-white">
                <th className="px-3 py-3 font-medium">Prénom</th>
                <th className="px-3 py-3 font-medium">Mail</th>
                <th className="px-3 py-3 font-medium">Audios</th>
                <th className="px-3 py-3 font-medium">Dernière connexion</th>
                <th className="w-10 px-2 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-black dark:text-white">
                    …
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-black dark:text-white">
                    —
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-3 py-3">{r.firstName || '—'}</td>
                    <td className="px-3 py-3 text-black dark:text-white">{r.email || '—'}</td>
                    <td className="px-3 py-3 tabular-nums">{r.audioCount}</td>
                    <td className="px-3 py-3 tabular-nums text-black dark:text-white">
                      {formatDate(r.lastSeenAt)}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => void onDelete(r)}
                        disabled={deletingId === r.id}
                        aria-label="Supprimer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-black dark:text-white transition hover:text-black dark:hover:text-white disabled:opacity-40"
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

        {tab === 'partage' && (
          <SharedSessions sessions={shared} error={sharedError} />
        )}

        {tab === 'liste' && (
        <div className="mt-6 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-5">
          <p className="text-center text-[12px] text-black dark:text-white">
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
              className="flex-1 rounded-xl border border-black/25 bg-black/[0.03] dark:border-white/20 dark:bg-white/10 px-3 py-2 text-sm text-black dark:text-white outline-none placeholder:text-black/50 dark:placeholder:text-white focus:border-[var(--vs-azur)]/50"
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
            <p className="mt-2 text-center text-[11px] text-black dark:text-white">{keywordHint}</p>
          )}

          <KeywordGrid
            words={baseKeywords}
            busy={keywordBusy}
            onRemove={onRemoveKeyword}
          />
          {extraKeywords.length > 0 && (
            <>
              <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-black dark:text-white">
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

const ANSWER_LABELS = new Map(
  WIZARD_STEPS.flatMap((step) => step.fields.map((field) => [field.id, field.label] as const)),
)

function answerLines(answers: Record<string, unknown>) {
  const skip = new Set(['health_ack', 'health_ack_at', 'q12_tutoiement', 'duration_minutes'])
  return Object.entries(answers).flatMap(([key, value]) => {
    if (skip.has(key) || value == null || String(value).trim() === '') return []
    const text = Array.isArray(value) ? value.join(', ') : String(value)
    const label = key === 'q6_scale' ? 'Note avant (1 à 10)' : (ANSWER_LABELS.get(key) ?? key)
    return [{ label, text }]
  })
}

function SharedSessions({
  sessions,
  error,
}: {
  sessions: AdminSharedSession[]
  error: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (error) {
    return <p className="mt-6 text-center text-xs text-black dark:text-white">{error}</p>
  }
  if (!sessions.length) {
    return (
      <p className="mt-6 text-center text-sm text-black dark:text-white">
        Aucune personne n’a autorisé la lecture de ses séances.
      </p>
    )
  }
  return (
    <div className="mt-6 space-y-2">
      {sessions.map((session) => {
        const name = session.firstName || session.email
        const open = openId === session.sessionId
        return (
          <article
            key={session.sessionId}
            className="rounded-2xl border border-white/15 bg-white/[0.04] text-center"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : session.sessionId)}
              aria-expanded={open}
              className="flex w-full flex-col items-center gap-1 px-4 py-3 text-center"
            >
              <span className="block w-full truncate text-sm text-black dark:text-white">{session.title || 'Séance'}</span>
              <span className="block w-full truncate text-[11px] text-black dark:text-white">
                {name} · {formatDate(session.createdAt)} · {session.listens} écoute
                {session.listens !== 1 ? 's' : ''}
              </span>
              <ChevronDown
                size={16}
                className={`text-black dark:text-white transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
            {open && (
              <div className="border-t border-white/10 px-4 py-4 text-center">
                <dl className="space-y-2">
                  {answerLines(session.answers).map((line) => (
                    <div key={line.label}>
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-black dark:text-white">{line.label}</dt>
                      <dd className="text-sm text-black dark:text-white">{line.text}</dd>
                    </div>
                  ))}
                </dl>
                {session.script?.trim() && (
                  <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap text-center text-xs leading-relaxed text-black dark:text-white">
                    {session.script}
                  </pre>
                )}
              </div>
            )}
          </article>
        )
      })}
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
          : 'rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-xs text-black dark:text-white hover:border-[var(--vs-azur)]/40 hover:text-black dark:hover:text-white'
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
    return <p className="mt-3 text-center text-[13px] text-black dark:text-white">—</p>
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
          <span className="truncate text-center text-xs text-black dark:text-white">{word}</span>
          <button
            type="button"
            onClick={() => onRemove(word)}
            disabled={busy}
            aria-label={`Retirer ${word}`}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-xs leading-none text-black dark:text-white hover:text-black dark:hover:text-white disabled:opacity-40"
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
        <p className="text-xl font-semibold tabular-nums text-black dark:text-white sm:text-2xl">{value}</p>
        <p className="text-[9px] uppercase tracking-[0.12em] text-black dark:text-white">{label}</p>
      </div>
      <p className="mt-1.5 text-[9px] tabular-nums text-black dark:text-white">max {limit}</p>
    </div>
  )
}
