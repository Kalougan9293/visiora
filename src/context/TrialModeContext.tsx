import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface TrialModeValue {
  atelier: boolean
  toggleAtelier: () => void
}

const TrialModeContext = createContext<TrialModeValue | null>(null)
const STORAGE_KEY = 'visiora-atelier'

function getInitial(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export function TrialModeProvider({ children }: { children: ReactNode }) {
  const [atelier, setAtelier] = useState(getInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('vs-atelier', atelier)
    localStorage.setItem(STORAGE_KEY, atelier ? '1' : '0')
  }, [atelier])

  const toggleAtelier = useCallback(() => setAtelier((v) => !v), [])

  const value = useMemo(() => ({ atelier, toggleAtelier }), [atelier, toggleAtelier])

  return <TrialModeContext.Provider value={value}>{children}</TrialModeContext.Provider>
}

export function useTrialMode() {
  const ctx = useContext(TrialModeContext)
  if (!ctx) throw new Error('useTrialMode must be used within TrialModeProvider')
  return ctx
}
