import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { SessionsProvider } from '@/context/SessionsContext'
import { AuthProvider } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { CreatePage } from '@/pages/CreatePage'
import { LibraryPage } from '@/pages/LibraryPage'
import { ProgressPage } from '@/pages/ProgressPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { AdminPage } from '@/pages/AdminPage'
import { VoicesLabPage } from '@/pages/VoicesLabPage'
import { ModelsLabPage } from '@/pages/ModelsLabPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SessionsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="admin" element={<AdminPage />} />
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="creer" element={<CreatePage />} />
                <Route path="bibliotheque" element={<LibraryPage />} />
                <Route path="suivi" element={<ProgressPage />} />
                <Route path="profil" element={<ProfilePage />} />
                <Route path="nouveau-mot-de-passe" element={<ResetPasswordPage />} />
                {import.meta.env.DEV && (
                  <>
                    <Route path="voix" element={<VoicesLabPage />} />
                    <Route path="modeles" element={<ModelsLabPage />} />
                  </>
                )}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SessionsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
