import type { ReactElement } from 'react';
import { useAdmin } from '../../context/AdminContext';
import type { AdminSection } from '../../types/database';

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  icon: ReactElement;
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: 'rooms',
    label: 'Room Management',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 10V20H20V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M2 20H22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 10V20" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 4L18 10H6L12 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'bookings',
    label: 'Reservations',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 3V7M16 3V7M3 10H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

/** Fixed sidebar navigation for desktop and compact tablet layouts. */
export function Sidebar() {
  const { section, setSection, theme, toggleTheme } = useAdmin();

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <h1>Mariam Hotel</h1>
        <span>Admin Portal</span>
      </div>

      <nav className="sidebar-nav" aria-label="Admin sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item${section === item.id ? ' active' : ''}`}
            onClick={() => setSection(item.id)}
            aria-current={section === item.id ? 'page' : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="demo-banner" role="status">
          <span className="demo-banner-dot" aria-hidden="true" />
          Connected to Neon Live
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm footer-label"
          onClick={toggleTheme}
          style={{ width: '100%' }}
        >
          {theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        </button>
      </div>
    </aside>
  );
}
