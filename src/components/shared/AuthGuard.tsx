import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface AuthGuardProps {
  children: React.ReactNode
  requireHousehold?: boolean
}

export function AuthGuard({ children, requireHousehold = true }: AuthGuardProps) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireHousehold && !profile?.household_id) {
    return <Navigate to="/setup-household" replace />
  }

  return <>{children}</>
}
