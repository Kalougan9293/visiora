import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { MiniPlayer } from '@/components/audio/MiniPlayer'
import { useTheme } from '@/context/ThemeContext'
import { PlaybackProvider, usePlayback } from '@/context/PlaybackContext'
import { cn } from '@/lib/utils'

export function AppShell() {
  return (
    <PlaybackProvider>
      <ShellFrame />
    </PlaybackProvider>
  )
}

function ShellFrame() {
  const { theme } = useTheme()
  const { pathname } = useLocation()
  const playback = usePlayback()
  const createPage = pathname === '/creer'
  const libraryPage = pathname === '/bibliotheque'
  const fillViewport = createPage || libraryPage
  const mini = Boolean(playback.sessionId) && !playback.ended && !libraryPage

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
            mini && '!pb-[calc(8.2rem+env(safe-area-inset-bottom,0px))]',
          )}
        >
          <Outlet />
        </main>
        <MiniPlayer />
        <BottomNav />
      </div>
    </div>
  )
}
