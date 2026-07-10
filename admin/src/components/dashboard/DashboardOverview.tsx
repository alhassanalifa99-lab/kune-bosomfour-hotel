import { useEffect, useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { formatGHS } from '../../lib/api/dashboard';
import { MetricCard, LoadingState } from '../ui/StatusBadge';

const EMPTY_STATS = {
  totalActiveBookings: 0,
  checkingInToday: 0,
  checkingOutToday: 0,
  currentMonthRevenue: 0,
};

/** Dashboard analytics section with metric cards and quick actions. */
export function DashboardOverview() {
  const { setWalkInOpen } = useAdmin();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      try {
        const response = await fetch('/api/stats');
        if (!response.ok) {
          throw new Error('Unable to load dashboard statistics');
        }

        const payload = (await response.json()) as typeof EMPTY_STATS;

        if (!isMounted) return;

        setStats({
          totalActiveBookings: Number(payload.totalActiveBookings ?? 0),
          checkingInToday: Number(payload.checkingInToday ?? 0),
          checkingOutToday: Number(payload.checkingOutToday ?? 0),
          currentMonthRevenue: Number(payload.currentMonthRevenue ?? 0),
        });
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        if (isMounted) {
          setStats(EMPTY_STATS);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <LoadingState message="Loading analytics…" />;
  }

  return (
    <>
      <section className="metrics-grid" aria-label="Key metrics">
        <MetricCard
          label="Total Active Bookings"
          value={stats.totalActiveBookings}
          tone="gold"
          icon={
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 3V7M16 3V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <MetricCard
          label="Checking In Today"
          value={stats.checkingInToday}
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
          value={stats.checkingOutToday}
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
          value={formatGHS(stats.currentMonthRevenue)}
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
