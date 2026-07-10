import { normalizeBookingStatus, type DashboardStats } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../supabase';
import { DEMO_BOOKINGS } from '../demoData';

/** Compute dashboard analytics from live or demo booking data. */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;

  try {
    const response = await fetch('/api/stats');
    if (response.ok) {
      const payload = (await response.json()) as {
        totalActiveBookings?: number;
        checkingInToday?: number;
        checkingOutToday?: number;
        currentMonthRevenue?: number;
      };

      return {
        totalBookings: Number(payload.totalActiveBookings ?? 0),
        checkInsToday: Number(payload.checkingInToday ?? 0),
        checkOutsToday: Number(payload.checkingOutToday ?? 0),
        monthRevenue: Number(payload.currentMonthRevenue ?? 0),
      };
    }
  } catch {
    // Fall back below if the local API is unavailable.
  }

  if (!isSupabaseConfigured) {
    return computeStats(DEMO_BOOKINGS, today, monthStart);
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('check_in_date, check_out_date, amount_paid, status');

  if (error) {
    throw new Error(`Failed to fetch dashboard stats: ${error.message}`);
  }

  return computeStats(data ?? [], today, monthStart);
}

function computeStats(
  rows: Array<{
    check_in_date: string;
    check_out_date: string;
    amount_paid: number;
    status: string;
  }>,
  today: string,
  monthStart: string
): DashboardStats {
  const activeStatuses = new Set([
    'pending_confirmation',
    'confirmed',
    'checked_in',
  ]);

  const activeBookings = rows.filter((row) =>
    activeStatuses.has(normalizeBookingStatus(row.status))
  );

  return {
    totalBookings: activeBookings.length,
    checkInsToday: rows.filter((row) => {
      const status = normalizeBookingStatus(row.status);
      return row.check_in_date === today && (status === 'confirmed' || status === 'checked_in');
    }).length,
    checkOutsToday: rows.filter((row) => {
      const status = normalizeBookingStatus(row.status);
      return row.check_out_date === today && (status === 'checked_in' || status === 'confirmed');
    }).length,
    monthRevenue: rows
      .filter((row) => {
        const status = normalizeBookingStatus(row.status);
        return row.check_in_date >= monthStart && status !== 'pending_confirmation';
      })
      .reduce((sum, row) => sum + Number(row.amount_paid), 0),
  };
}

/** Format amounts in Ghana Cedis for display. */
export function formatGHS(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format ISO date strings for table cells. */
export function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Today's date as YYYY-MM-DD for date inputs. */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Current month name for dashboard subtitle. */
export function currentMonthLabel(): string {
  return new Date().toLocaleDateString('en-GH', {
    month: 'long',
    year: 'numeric',
  });
}
