import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute() {
  const { token, loading } = useAuth()

  // Wait for token validation before deciding to redirect
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}
