import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { adminService, formatStorage, type AdminUserRow } from '@/services/admin'
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
  }, [authed, refresh])

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
      <div className="flex min-h-dvh items-center justify-center bg-atmosphere-aqua px-6 text-sm text-[#b8e4ea]/70">
        …
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-atmosphere-aqua px-6">
        <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-[240px] space-y-3">
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-center text-sm text-[#e8f7f9] outline-none placeholder:text-[#b8e4ea]/45 focus:border-[#7ed4df]/50"
            style={{ fontFamily: 'Figtree, Outfit, sans-serif' }}
            disabled={busy}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-center text-sm text-[#e8f7f9] outline-none placeholder:text-[#b8e4ea]/45 focus:border-[#7ed4df]/50"
            style={{ fontFamily: 'Figtree, Outfit, sans-serif' }}
            disabled={busy}
          />
          {error && <p className="text-xs text-[#f0a0a0]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="aqua-cta w-full !py-2.5 text-sm disabled:opacity-60"
            style={{ fontFamily: 'Figtree, Outfit, sans-serif' }}
          >
            <span>{busy ? '…' : 'OK'}</span>
          </button>
        </form>
      </div>
    )
  }

  return (
    <div
      className="min-h-dvh bg-atmosphere-aqua px-4 py-10 text-[#e8f7f9] sm:px-6"
      style={{ fontFamily: 'Figtree, Outfit, sans-serif' }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative flex items-center justify-center">
          <h1
            className="text-center text-2xl tracking-tight text-[#f4fcfd] sm:text-[1.75rem]"
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 450 }}
          >
            Tableau de bord
          </h1>
          <button
            type="button"
            onClick={() => void logout()}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wider text-[#b8e4ea]/50 transition hover:text-[#7ed4df]"
          >
            Sortir
          </button>
        </div>

        <div className="mt-10 flex justify-center gap-3 sm:gap-4">
          <StatSquare value={loading ? '…' : String(usersCount)} label="Utilisateurs" />
          <StatSquare value={loading ? '…' : String(audios)} label="Audios" />
          <StatSquare value={loading ? '…' : storageLabel} label="Stockage" />
        </div>

        {loadError && (
          <p className="mt-4 text-center text-xs text-[#f0a0a0]">{loadError}</p>
        )}

        <div className="mt-10 overflow-x-auto rounded-2xl border border-white/15 bg-white/[0.04]">
          <table className="w-full min-w-[580px] border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-[#7ed4df]/80">
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
                  <td colSpan={6} className="px-3 py-8 text-[#b8e4ea]/40">
                    …
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-[#b8e4ea]/40">
                    —
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-3 py-3">{r.firstName || '—'}</td>
                    <td className="px-3 py-3">{r.lastName || '—'}</td>
                    <td className="px-3 py-3 text-[#b8e4ea]/85">{r.email || '—'}</td>
                    <td className="px-3 py-3 tabular-nums">{r.audioCount}</td>
                    <td className="px-3 py-3 tabular-nums text-[#b8e4ea]/55">
                      {formatDate(r.lastSeenAt)}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => void onDelete(r)}
                        disabled={deletingId === r.id}
                        aria-label="Supprimer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#b8e4ea]/45 transition hover:bg-red-500/15 hover:text-red-400 disabled:opacity-40"
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
      </div>
    </div>
  )
}

function StatSquare({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/[0.05] sm:h-24 sm:w-24">
      <p className="text-xl font-semibold tabular-nums text-[#f4fcfd] sm:text-2xl">{value}</p>
      <p className="text-[9px] uppercase tracking-[0.12em] text-[#7ed4df]/75">{label}</p>
    </div>
  )
}
