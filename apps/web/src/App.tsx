import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CrewPage from './pages/CrewPage'
import AdminLayout from './pages/admin/AdminLayout'
import RunnersPage from './pages/admin/RunnersPage'
import RunnerDetailPage from './pages/admin/RunnerDetailPage'
import ImportPage from './pages/admin/ImportPage'
import StaffPage from './pages/admin/StaffPage'
import SettingsPage from './pages/admin/SettingsPage'
import AuditPage from './pages/admin/AuditPage'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register/:ticketId?" element={<RegisterPage />} />
            <Route path="/crew" element={<CrewPage />} />

            {/* Staff (admin + official) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<Navigate to="/admin/runners" replace />} />
                <Route path="/admin/runners" element={<RunnersPage />} />
                <Route path="/admin/runners/:id" element={<RunnerDetailPage />} />
                <Route path="/admin/import" element={<ImportPage />} />
                <Route path="/admin/staff" element={<StaffPage />} />
                <Route path="/admin/settings" element={<SettingsPage />} />
                <Route path="/admin/audit" element={<AuditPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/register" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
