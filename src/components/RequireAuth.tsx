import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Spinner from './Spinner'

export default function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="py-20 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
