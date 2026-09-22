import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

export function AppShell() {
  const { theme } = useTheme()
  const { pathname } = useLocation()
  const createPage = pathname === '/creer'
  const libraryPage = pathname === '/bibliotheque'
  const fillViewport = createPage || libraryPage

  return (
    <div
      className={cn(
        'flex min-h-dvh w-full flex-col',
        theme === 'dark' ? 'bg-atmosphere-dark' : 'bg-atmosphere-light',
      )}
    >
      <div
        className={cn(
          'relative mx-auto flex min-h-dvh w-full max-w-[35rem] flex-1 flex-col',
          fillViewport && 'h-dvh max-h-dvh overflow-hidden',
        )}
      >
        <Header />
        <main
          className={cn(
            'flex w-full flex-1 flex-col text-center',
            fillViewport
              ? 'min-h-0 overflow-hidden px-5 pt-3 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]'
              : 'page-pad px-5 pt-5',
          )}
        >
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
