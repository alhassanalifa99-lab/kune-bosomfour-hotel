import { useAdmin } from '../../context/AdminContext';
import { currentMonthLabel } from '../../lib/api/dashboard';
import type { AdminSection } from '../../types/database';

const SECTION_META: Record<
  AdminSection,
  { title: string; subtitle: string }
> = {
  dashboard: {
    title: 'Dashboard Overview',
    subtitle: `Analytics for ${currentMonthLabel()}`,
  },
  rooms: {
    title: 'Room Management',
    subtitle: 'Update availability, pricing, and maintenance status',
  },
  bookings: {
    title: 'Reservations & Bookings',
    subtitle: 'Manage guest arrivals, departures, and confirmations',
  },
};

/** Top header bar with section title and refresh control. */
export function Header() {
  const { section, refreshAll, setWalkInOpen } = useAdmin();
  const meta = SECTION_META[section];

  return (
    <header className="admin-header">
      <div className="header-title-block">
        <h2>{meta.title}</h2>
        <p>{meta.subtitle}</p>
      </div>

      <div className="header-actions">
        {section === 'dashboard' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setWalkInOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New Walk-In Booking
          </button>
        )}
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => void refreshAll()}
          aria-label="Refresh data"
          title="Refresh data"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 12a8 8 0 1 1-2.34-5.66"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M20 4V10H14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
