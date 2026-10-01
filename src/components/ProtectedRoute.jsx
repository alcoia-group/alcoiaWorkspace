import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';

export default function ProtectedRoute() {
  const { session } = useSession();
  const location = useLocation();
  if (!session) {
    // Remember where they were headed so sign-in can send them back.
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
