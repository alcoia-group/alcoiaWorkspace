import { Link, NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import Logo from './Logo.jsx';
import { useSessionKeepAlive } from '../lib/keepalive.js';
import { initials } from '../lib/format.js';

export default function AppLayout() {
  const { session, signOut } = useSession();
  useSessionKeepAlive(session);
  return (
    <>
      <header className="global-bar">
        <Link to={session ? '/home' : '/sign-in'} className="global-brand" aria-label="alcoia home"><Logo onDark /></Link>
        {session && (
          <>
            <nav className="global-nav" aria-label="Main">
              <NavLink to="/home">Overview</NavLink>
              <NavLink to="/assignments">Materials</NavLink>
              <NavLink to="/files">My files</NavLink>
              <NavLink to="/analytics">Learner analytics</NavLink>
              {/* EXAM MODE OFF FOR LAUNCH (AI cost): <Link to="/exam">Exam Mode</Link> */}
              <NavLink to="/settings">Settings</NavLink>
            </nav>
            <div className="global-user">
              <span className="avatar" aria-hidden="true">{initials(session.email)}</span>
              {session.email && <span className="global-email">{session.email}</span>}
              <button type="button" className="link-button" onClick={signOut}>Sign out</button>
            </div>
          </>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
