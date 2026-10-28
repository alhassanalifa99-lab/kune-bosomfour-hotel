import { useAdmin } from '../../context/AdminContext';
import { formatGHS } from '../../lib/api/dashboard';
import { MetricCard, LoadingState } from '../ui/StatusBadge';

/** Dashboard analytics section with metric cards and quick actions. */
export function DashboardOverview() {
  const { setWalkInOpen, stats, statsLoading } = useAdmin();

  if (statsLoading) {
    return <LoadingState message="Loading analytics…" />;
  }

  return (
    <>
      <section className="metrics-grid" aria-label="Key metrics">
        <MetricCard
          label="Total Bookings"
          value={stats.totalBookings}
          tone="gold"
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 3V7M16 3V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <MetricCard
          label="Active Bookings"
          value={stats.totalActiveBookings}
          tone="gold"
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <MetricCard
          label="Pending Bookings"
          value={stats.pendingBookings}
          tone="warning"
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 7V12L16 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          }
        />
        <MetricCard
          label="Confirmed Bookings"
          value={stats.confirmedBookings}
          tone="success"
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12L9 16L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <MetricCard
          label="Checking In Today"
          value={stats.checkInsToday}
          tone="success"
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 16V8M8 12L12 16L16 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 20H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <MetricCard
          label="Checking Out Today"
          value={stats.checkOutsToday}
          tone="info"
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 8V16M8 12L12 8L16 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 20H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <MetricCard
          label="Current Month Revenue"
          value={formatGHS(stats.monthRevenue)}
          tone="warning"
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 8V12L15 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
      </section>

      <section className="panel quick-actions" aria-label="Quick actions">
        <div className="quick-actions-copy">
          <h3>Front desk quick action</h3>
          <p>Register a walk-in guest and assign an available room instantly.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setWalkInOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Walk-In Booking
        </button>
      </section>
    </>
  );
}
