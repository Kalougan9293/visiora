import { useState } from 'react'
import { User } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { LegalFooter } from '@/components/layout/LegalFooter'
import { useSessions } from '@/context/SessionsContext'
import { useAuth } from '@/context/AuthContext'
import { AI_DISCLOSURE } from '@/data/uiCopy'
import { supabase } from '@/services/supabase'

export function ProfilePage() {
  const { sessions, stats } = useSessions()
  const { user, profile, signOut, configured, refreshProfile } = useAuth()
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState('')

  const heardName = sessions
    .slice()
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((session) => session.answers.q13)
    .find((value) => typeof value === 'string' && value.trim())
  const display =
    profile?.first_name?.trim() ||
    (typeof user?.user_metadata?.first_name === 'string' ? user.user_metadata.first_name.trim() : '') ||
    (typeof heardName === 'string' ? heardName.trim() : '') ||
    user?.email ||
    'Profil'

  return (
    <div className="flex w-full flex-col items-center space-y-6 pb-4">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--vs-azur)]/15 text-[var(--vs-azur)] dark:bg-[var(--vs-abysse)]">
          <User size={28} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="font-display text-3xl tracking-tight">{display}</h1>
          <p className="mt-1 text-sm text-ink/82 dark:text-champagne/90">
            {user
              ? profile?.email || user.email
              : configured
                ? 'Non connecté'
                : 'Compte local — configure Supabase'}
          </p>
        </div>
      </div>

      <Card className="w-full !p-4 space-y-4">
        <Row label="Séances créées" value={String(sessions.length)} />
        <Row label="Jours de pratique" value={String(stats.daysCompletedTowardMilestone)} />
        <Row label="Séances écoutées" value={String(stats.totalListens)} />
        {profile?.cgu_accepted && <Row label="CGU" value="Acceptées" />}
      </Card>

      {user && (
        <Card className="w-full !p-4 text-left">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink/80 dark:text-champagne/90">
            <input
              type="checkbox"
              checked={Boolean(profile?.share_sessions)}
              disabled={shareBusy}
              onChange={(e) => {
                const next = e.target.checked
                if (!supabase) return
                setShareBusy(true)
                setShareError('')
                void (async () => {
                  const { error } = await supabase
                    .from('profiles')
                    .update({ share_sessions: next })
                    .eq('id', user.id)
                  if (error) {
                    setShareError('Le réglage n’a pas pu être enregistré.')
                  } else {
                    await refreshProfile()
                  }
                  setShareBusy(false)
                })()
              }}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--vs-azur)]"
            />
            <span>
              {AI_DISCLOSURE.shareCheckbox}
              <span className="mt-1 block text-xs text-ink/55 dark:text-champagne/70">
                {AI_DISCLOSURE.shareRevoke}
              </span>
            </span>
          </label>
          {shareError && <p className="mt-2 text-center text-xs text-[var(--vs-or)]">{shareError}</p>}
        </Card>
      )}

      {user && (
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-xs uppercase tracking-[0.14em] text-ink/62 transition hover:text-[var(--vs-azur)] dark:text-[var(--vs-brume)] dark:hover:text-[var(--vs-azur)]"
        >
          Déconnexion
        </button>
      )}
      <LegalFooter />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-sm">
      <span className="text-ink/82 dark:text-champagne/92">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
