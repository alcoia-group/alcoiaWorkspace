import { Link, Outlet } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';

export default function AppLayout() {
  const { session, signOut } = useSession();
  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-brand">alcoia</Link>
        {session && (
          <div className="app-header-right">
            {session.email && <span>{session.email}</span>}
            <button type="button" className="secondary" onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
