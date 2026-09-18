import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AppVariant = 'classic' | 'aqua'

interface VariantContextValue {
  variant: AppVariant
  isAqua: boolean
  toggleVariant: () => void
  setVariant: (v: AppVariant) => void
}

const VariantContext = createContext<VariantContextValue | null>(null)
const STORAGE_KEY = 'visiora-variant'

function getInitial(): AppVariant {
  if (typeof window === 'undefined') return 'classic'
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'aqua' ? 'aqua' : 'classic'
}

export function VariantProvider({ children }: { children: ReactNode }) {
  const [variant, setVariantState] = useState<AppVariant>(getInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('variant-aqua', variant === 'aqua')
    document.documentElement.classList.toggle('variant-classic', variant === 'classic')
    localStorage.setItem(STORAGE_KEY, variant)
  }, [variant])

  const setVariant = useCallback((v: AppVariant) => setVariantState(v), [])
  const toggleVariant = useCallback(
    () => setVariantState((v) => (v === 'classic' ? 'aqua' : 'classic')),
    [],
  )

  const value = useMemo(
    () => ({
      variant,
      isAqua: variant === 'aqua',
      toggleVariant,
      setVariant,
    }),
    [variant, toggleVariant, setVariant],
  )

  return <VariantContext.Provider value={value}>{children}</VariantContext.Provider>
}

export function useVariant() {
  const ctx = useContext(VariantContext)
  if (!ctx) throw new Error('useVariant must be used within VariantProvider')
  return ctx
}
