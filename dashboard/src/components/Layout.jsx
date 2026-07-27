import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const NAV = [
  { to: '/', icon: '■', label: 'Dashboard', title: 'Dashboard', sub: 'Community overview at a glance' },
  { to: '/pickers', icon: '●', label: 'Waste Pickers', title: 'Waste Pickers', sub: 'Registrations, approvals and roles' },
  { to: '/announcements', icon: '✉', label: 'Communication', title: 'Communication', sub: 'Broadcast messages to the community' },
  { to: '/collections', icon: '♻', label: 'Activity', title: 'Collection Activity', sub: 'What the community is collecting' },
  { to: '/reports', icon: '▤', label: 'Reports', title: 'Reports', sub: 'Exportable summaries for partner agencies' },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const current = NAV.find((n) => n.to === pathname) || NAV[0];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">{'♻'}</div>
          <div className="brand-text">
            <strong>Waste Picker MS</strong>
            <span>Western Kenya</span>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="who">{user?.full_name}</div>
          <div className="role">{user?.role}</div>
          <button className="signout" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{current.title}</h1>
          <p>{current.sub}</p>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
