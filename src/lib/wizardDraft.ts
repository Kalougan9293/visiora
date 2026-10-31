/** Brouillon questionnaire — survit au changement d’onglet / freeze Safari iPhone. */

const PREFIX = 'visiora-wizard-draft'

export type WizardDraft = {
  v: 1
  stepIdx: number
  answers: Record<string, string>
  shareRead: boolean
  updatedAt: number
}

function key(userId: string | null | undefined) {
  return `${PREFIX}:${userId?.trim() || 'anon'}`
}

export function loadWizardDraft(userId: string | null | undefined): WizardDraft | null {
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return null
    const data = JSON.parse(raw) as WizardDraft
    if (data?.v !== 1 || typeof data.stepIdx !== 'number' || !data.answers || typeof data.answers !== 'object') {
      return null
    }
    return data
  } catch {
    return null
  }
}

export function saveWizardDraft(
  userId: string | null | undefined,
  draft: { stepIdx: number; answers: Record<string, string>; shareRead: boolean },
) {
  try {
    const payload: WizardDraft = {
      v: 1,
      stepIdx: draft.stepIdx,
      answers: draft.answers,
      shareRead: draft.shareRead,
      updatedAt: Date.now(),
    }
    localStorage.setItem(key(userId), JSON.stringify(payload))
  } catch {
    /* quota / mode privé */
  }
}

export function clearWizardDraft(userId: string | null | undefined) {
  try {
    localStorage.removeItem(key(userId))
    if (userId) localStorage.removeItem(key(null))
  } catch {
    /* ignore */
  }
}
