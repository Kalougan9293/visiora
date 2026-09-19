import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { useTheme } from '@/context/ThemeContext'
import { useVariant } from '@/context/VariantContext'
import { cn } from '@/lib/utils'

export function AppShell() {
  const { theme } = useTheme()
  const { isAqua } = useVariant()
  const { pathname } = useLocation()
  const aquaHome = isAqua && pathname === '/'
  const createPage = pathname === '/creer'
  const libraryPage = pathname === '/bibliotheque'
  const fillViewport = aquaHome || createPage || libraryPage

  return (
    <div
      className={cn(
        'flex min-h-dvh w-full flex-col',
        isAqua
          ? 'bg-atmosphere-aqua'
          : theme === 'dark'
            ? 'bg-atmosphere-dark'
            : 'bg-atmosphere-light',
      )}
    >
      <div
        className={cn(
          'relative mx-auto flex min-h-dvh w-full flex-1 flex-col',
          isAqua ? 'max-w-none' : 'max-w-[35rem]',
          fillViewport && 'h-dvh max-h-dvh overflow-hidden',
        )}
      >
        <Header />
        <main
          className={cn(
            'flex w-full flex-1 flex-col text-center',
            fillViewport
              ? cn(
                  'min-h-0 overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]',
                  aquaHome ? 'px-0 pt-0' : 'px-5 pt-3',
                )
              : cn('page-pad px-5 pt-5', isAqua && 'mx-auto max-w-md md:max-w-3xl'),
          )}
        >
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
