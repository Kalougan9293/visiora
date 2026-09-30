import { useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { VOICES } from '@/data/wizard'
import {
  formatStorage,
  type AdminUserRow,
  type ProviderUsage,
  type TesterFollow,
  type TesterOverview,
  type TesterPlay,
  type TesterSession,
  type TesterUser,
} from '@/services/admin'

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes <= 0) return `${rest} s`
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`
}

function formatGap(value: number | null) {
  if (value == null) return '—'
  const rounded = Math.round(value * 10) / 10
  const text = rounded.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return rounded > 0 ? `+${text}` : text
}

function formatCount(value: number | null) {
  if (value == null) return '—'
  return Math.round(value).toLocaleString('fr-FR')
}

function readyProviderCells(provider: ProviderUsage | null): [string, string][] {
  if (!provider) return []
  const cells: [string, string][] = []
  if (provider.eleven.status === 'ready') {
    const used = provider.eleven.characters.toLocaleString('fr-FR')
    const value = provider.eleven.limit == null
      ? `${used} car.`
      : `${used} / ${provider.eleven.limit.toLocaleString('fr-FR')}`
    cells.push(['ElevenLabs', value])
  }
  if (provider.anthropic.status === 'ready') {
    const value = `${provider.anthropic.usd.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} $`
    cells.push(['Anthropic', value])
  }
  return cells
}

function voiceName(id: string | null) {
  if (!id) return '—'
  return VOICES.find((voice) => voice.id === id.toLowerCase())?.name ?? id
}

function bedName(id: string | null) {
  const key = (id ?? '').toLowerCase()
  if (key === 'rituel' || key === 'louis') return 'Musique Vanessa'
  if (key === 'onde' || key === 'maelis') return 'Musique Sabrina'
  if (key === 'antoni' || key === 'aurore') return 'Fond Damien'
  return '—'
}

function registerName(id: string | null) {
  if (id === 'neutre') return 'Neutre'
  if (id === 'spirituel') return 'Spirituel'
  return '—'
}

function statusName(status: string) {
  if (status === 'ready') return 'Réussie'
  if (status === 'failed') return 'Échouée'
  if (status === 'generating') return 'En cours'
  return 'Brouillon'
}

function audioLength(session: TesterSession) {
  if (session.listenedSeconds != null) return formatClock(session.listenedSeconds)
  if (session.estimatedSeconds != null) return `${formatClock(session.estimatedSeconds)} (estimée)`
  return '—'
}

function listenReach(play: TesterPlay) {
  const reached = formatClock(play.maxSeconds)
  if (play.durationSeconds > 1) {
    const pct = Math.min(100, Math.round((play.maxSeconds / play.durationSeconds) * 100))
    return `${reached} · ${pct} %`
  }
  return reached
}

export function TesterOverviewBar({
  overview,
  provider,
}: {
  overview: TesterOverview | null
  provider: ProviderUsage | null
}) {
  const cells: [string, string][] = []
  if (overview) {
    const rate = overview.completeRate == null ? '—' : `${Math.round(overview.completeRate * 100)} %`
    cells.push(
      ['Actifs, 7 jours', String(overview.active7d)],
      ['Séances créées', String(overview.created)],
      ['Séances en échec', String(overview.failed)],
      ['Écoutes complètes', rate],
      ['Écart de note', formatGap(overview.scoreGap)],
      ['Génération moyenne', overview.generationSeconds == null ? '—' : formatClock(overview.generationSeconds)],
    )
  }
  cells.push(...readyProviderCells(provider))
  if (!cells.length) return null
  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cells.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-3 text-center">
            <p className="text-lg font-semibold tabular-nums text-black dark:text-white">{value}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-black dark:text-white">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TesterUserList({
  follow,
  deletingId,
  onDelete,
}: {
  follow: TesterFollow
  deletingId: string | null
  onDelete: (row: AdminUserRow) => void
}) {
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [openSession, setOpenSession] = useState<string | null>(null)

  if (!follow.users.length) {
    return <p className="mt-6 text-center text-sm text-black dark:text-white">Aucun testeur.</p>
  }

  return (
    <div className="mt-6 space-y-2">
      {follow.users.map((user) => {
        const open = openUser === user.id
        return (
          <article key={user.id} className="rounded-2xl border border-white/15 bg-white/[0.04]">
            <div className="flex items-start gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => setOpenUser(open ? null : user.id)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-black dark:text-white">
                    {user.firstName || user.email || '—'}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-black dark:text-white">
                    {user.email || '—'} · {user.sessionCount} séance{user.sessionCount !== 1 ? 's' : ''} · vu {formatWhen(user.lastSeenAt)}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={`mt-1 shrink-0 text-black dark:text-white transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </button>
              <button
                type="button"
                onClick={() => void onDelete({
                  id: user.id,
                  firstName: user.firstName,
                  email: user.email,
                  audioCount: user.sessionCount,
                  lastSeenAt: user.lastSeenAt,
                })}
                disabled={deletingId === user.id}
                aria-label="Supprimer"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black dark:text-white disabled:opacity-40"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {open && (
              <UserSheet
                user={user}
                openSession={openSession}
                onOpenSession={setOpenSession}
              />
            )}
          </article>
        )
      })}
    </div>
  )
}

function UserSheet({
  user,
  openSession,
  onOpenSession,
}: {
  user: TesterUser
  openSession: string | null
  onOpenSession: (id: string | null) => void
}) {
  const notes = user.sessions.flatMap((session) =>
    session.notes.map((note) => ({ ...note, title: session.title, before: session.scaleBefore })),
  )
  return (
    <div className="border-t border-white/10 px-4 py-4">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-center sm:grid-cols-3">
        <Fact label="Compte créé" value={formatWhen(user.createdAt)} />
        <Fact label="Dernière connexion" value={formatWhen(user.lastSeenAt)} />
        <Fact label="Séances" value={String(user.sessionCount)} />
        <Fact label="Écoutes" value={String(user.listenCount)} />
        <Fact label="Jours de pratique" value={String(user.practiceDays)} />
        <Fact label="Espace" value={formatStorage(user.storageBytes)} />
        <Fact label="Partage" value={user.share ? 'Accepté' : 'Non'} />
        <Fact label="Appareil" value={user.clientLabel ?? '—'} />
      </dl>
      <p className="mt-3 text-center text-[11px] text-black/80 dark:text-white/80">
        Les écoutes sont celles comptées après 80 %. Chaque lecture est dans la séance.
      </p>

      <p className="mt-5 text-center text-[10px] uppercase tracking-[0.14em] text-black dark:text-white">Notes</p>
      {notes.length === 0 ? (
        <p className="mt-2 text-center text-sm text-black dark:text-white">—</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {notes.map((note, index) => {
            const gap = note.before == null ? null : note.scale - note.before
            return (
              <li key={`${note.createdAt}-${index}`} className="text-center text-sm text-black dark:text-white">
                <span className="block text-[11px]">{formatWhen(note.createdAt)} · {note.title || 'Séance'}</span>
                <span>
                  {note.before ?? '—'} → {note.scale}
                  {gap != null ? ` · écart ${formatGap(gap)}` : ''}
                </span>
                {user.share && (
                  <span className="mt-0.5 block text-[12px]">{note.remark || '—'}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-5 text-center text-[10px] uppercase tracking-[0.14em] text-black dark:text-white">Séances</p>
      {user.sessions.length === 0 ? (
        <p className="mt-2 text-center text-sm text-black dark:text-white">—</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {user.sessions.map((session) => {
            const open = openSession === session.id
            return (
              <li key={session.id} className="rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => onOpenSession(open ? null : session.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-black dark:text-white">{session.title || 'Séance'}</span>
                    <span className="block text-[11px] text-black dark:text-white">
                      {formatWhen(session.createdAt)} · {statusName(session.status)}
                    </span>
                  </span>
                  <ChevronDown size={14} className={`shrink-0 text-black dark:text-white ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && <SessionSheet session={session} share={user.share} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SessionSheet({ session, share }: { session: TesterSession; share: boolean }) {
  const after = session.notes[0]?.scale ?? null
  const gap = session.scaleBefore == null || after == null ? null : after - session.scaleBefore
  return (
    <div className="border-t border-white/10 px-3 py-3">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-center">
        <Fact label="Créée" value={formatWhen(session.createdAt)} />
        <Fact label="Prompt" value={session.promptVersion ?? '—'} />
        <Fact label="Génération" value={session.generationSeconds == null ? '—' : formatClock(session.generationSeconds)} />
        <Fact label="Statut" value={statusName(session.status)} />
        <Fact label="Durée audio" value={audioLength(session)} />
        <Fact label="Mots du script" value={session.scriptWords == null ? '—' : formatCount(session.scriptWords)} />
        <Fact label="Voix" value={voiceName(session.voiceId)} />
        <Fact label="Fond" value={bedName(session.voiceId)} />
        <Fact label="Registre" value={registerName(session.register)} />
        <Fact label="Fichier" value={session.fileBytes == null ? '—' : formatStorage(session.fileBytes)} />
        <Fact label="Note avant" value={session.scaleBefore == null ? '—' : String(session.scaleBefore)} />
        <Fact label="Note après" value={after == null ? '—' : String(after)} />
        <Fact label="Écart" value={formatGap(gap)} />
      </dl>
      {session.status === 'failed' && (
        <p className="mt-3 text-center text-xs text-black dark:text-white">{session.error || 'Échec, sans message enregistré.'}</p>
      )}
      {share && (
        <p className="mt-3 text-center text-sm text-black dark:text-white">
          Commentaire : {session.notes.find((note) => note.remark)?.remark || '—'}
        </p>
      )}
      <p className="mt-4 text-center text-[10px] uppercase tracking-[0.14em] text-black dark:text-white">Lectures</p>
      {session.plays.length === 0 ? (
        <p className="mt-2 text-center text-sm text-black dark:text-white">—</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {session.plays.map((play) => (
            <li key={play.id} className="text-center text-[12px] text-black dark:text-white">
              {formatWhen(play.startedAt)} · {listenReach(play)} · terminée {play.completed ? 'oui' : 'non'}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-black dark:text-white">{label}</dt>
      <dd className="mt-0.5 text-sm text-black dark:text-white">{value}</dd>
    </div>
  )
}
