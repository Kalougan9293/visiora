import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { SessionsProvider } from '@/context/SessionsContext'
import { VariantProvider, useVariant } from '@/context/VariantContext'
import { AuthProvider } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { AquaHomePage } from '@/pages/AquaHomePage'
import { CreatePage } from '@/pages/CreatePage'
import { AquaCreatePage } from '@/pages/AquaCreatePage'
import { LibraryPage } from '@/pages/LibraryPage'
import { AquaLibraryPage } from '@/pages/AquaLibraryPage'
import { ProgressPage } from '@/pages/ProgressPage'
import { AquaProgressPage } from '@/pages/AquaProgressPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { AdminPage } from '@/pages/AdminPage'

function HomeSwitch() {
  const { isAqua } = useVariant()
  return isAqua ? <AquaHomePage /> : <HomePage />
}

function CreateSwitch() {
  const { isAqua } = useVariant()
  return isAqua ? <AquaCreatePage /> : <CreatePage />
}

function LibrarySwitch() {
  const { isAqua } = useVariant()
  return isAqua ? <AquaLibraryPage /> : <LibraryPage />
}

function ProgressSwitch() {
  const { isAqua } = useVariant()
  return isAqua ? <AquaProgressPage /> : <ProgressPage />
}

export default function App() {
  return (
    <ThemeProvider>
      <VariantProvider>
        <AuthProvider>
          <SessionsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="admin" element={<AdminPage />} />
                <Route element={<AppShell />}>
                  <Route index element={<HomeSwitch />} />
                  <Route path="creer" element={<CreateSwitch />} />
                  <Route path="bibliotheque" element={<LibrarySwitch />} />
                  <Route path="suivi" element={<ProgressSwitch />} />
                  <Route path="profil" element={<ProfilePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SessionsProvider>
        </AuthProvider>
      </VariantProvider>
    </ThemeProvider>
  )
}
