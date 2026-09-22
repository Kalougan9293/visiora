import { cn } from '@/lib/utils'
import { ANNEX_SCRIPT } from '@/data/annexScript'

export type ScriptBlock =
  | { kind: 'movement'; title: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'inner'; text: string }
  | { kind: 'pause'; long: boolean }

const MOVEMENT = /^\[Mouvement\s+([^\]]+)\]$/i
const ANNEX = /^\[Annexe[^\]]*\]$/i
const PAUSE = /^\[pause(\s+longue)?\]$/i
const INNER = /^[«"].+[»"]$/s

/** Parse le format Annexe pour l’affichage (pas le TTS). */
export function parseScriptForDisplay(raw: string): ScriptBlock[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const blocks: ScriptBlock[] = []
  let para: string[] = []

  const flush = () => {
    const text = para.join(' ').replace(/\s+/g, ' ').trim()
    para = []
    if (!text) return
    if (INNER.test(text) || (text.startsWith('«') && text.endsWith('»'))) {
      blocks.push({ kind: 'inner', text: text.replace(/^[«"]|[»"]$/g, '').trim() })
    } else {
      blocks.push({ kind: 'paragraph', text })
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flush()
      continue
    }
    if (ANNEX.test(trimmed)) {
      flush()
      continue
    }
    const mov = trimmed.match(MOVEMENT)
    if (mov) {
      flush()
      blocks.push({ kind: 'movement', title: mov[1]!.trim() })
      continue
    }
    const pause = trimmed.match(PAUSE)
    if (pause) {
      flush()
      blocks.push({ kind: 'pause', long: Boolean(pause[1]) })
      continue
    }
    para.push(trimmed)
  }
  flush()
  return blocks
}

export function ScriptReader({
  script,
  className,
}: {
  script?: string | null
  className?: string
}) {
  const source = (script && script.trim().length > 40 ? script : ANNEX_SCRIPT).trim()
  const isAnnexFallback = /\[Annexe/i.test(source)
  const blocks = parseScriptForDisplay(source)

  return (
    <article
      className={cn(
        'vs-seance mx-auto w-full max-w-[34rem] text-left',
        'text-ink/85 dark:text-[var(--vs-lunaire)]',
        className,
      )}
    >
      {isAnnexFallback && (
        <p
          className={cn(
            'mb-4 text-[11px] leading-relaxed',
            'text-ink/45 dark:text-[var(--vs-brume)]',
          )}
        >
          Script de secours (annexe). Ce n’est pas le texte d’un autre compte — la
          génération IA n’était pas disponible.
        </p>
      )}
      {blocks.map((b, i) => {
        if (b.kind === 'movement') {
          return (
            <h3
              key={i}
              className={cn(
                'mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] first:mt-0',
                'text-ink/45 dark:text-[var(--vs-brume)]',
              )}
            >
              Mouvement {b.title}
            </h3>
          )
        }
        if (b.kind === 'pause') {
          return (
            <div
              key={i}
              aria-hidden
              className={b.long ? 'vs-silence-long' : 'vs-silence-court'}
            />
          )
        }
        if (b.kind === 'inner') {
          return (
            <blockquote key={i} className="vs-voix-interieure">
              « {b.text} »
            </blockquote>
          )
        }
        return (
          <p key={i} className="mt-3 text-sm leading-[1.8]">
            {b.text}
          </p>
        )
      })}
      <p
        className={cn(
          'mt-8 text-[11px] leading-relaxed',
          'text-ink/40 dark:text-[var(--vs-brume)]',
        )}
      >
        Texte généré avec assistance. Tu peux réécouter cette séance autant de fois que tu
        veux.
      </p>
    </article>
  )
}
