import { type DashboardStats } from '../../types/database';

// ─── Render API base URL ──────────────────────────────────────────────────────
const API_BASE = 'https://hotel-proect.onrender.com';

// ─── Types matching your Neon bookings table ──────────────────────────────────
interface NeonBooking {
  id: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  room_id: number | null;
  room_name: string | null;
  check_in_date: string;
  check_out_date: string;
  total_amount: number;
  booking_status: string;
  guest_count: number;
  special_requests: string;
  created_at: string;
}

// ─── Normalise booking_status to lowercase with underscores ──────────────────
function normalizeStatus(status: string): string {
  return (status || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

// ══════════════════════════════════════════════════════════════════════════════
// fetchDashboardStats — pulls live numbers from Render/Neon
// ══════════════════════════════════════════════════════════════════════════════
export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const bookings = await fetchAllBookings();
    return computeStats(bookings);
  } catch {
    try {
      const response = await fetch(`${API_BASE}/api/stats`);

      if (response.ok) {
        const payload = await response.json() as {
          totalBookings?: number;
          pendingBookings?: number;
          confirmedBookings?: number;
          totalActiveBookings?: number;
          checkingInToday?: number;
          checkingOutToday?: number;
          currentMonthRevenue?: number;
        };

        return {
          totalBookings:       Number(payload.totalBookings ?? payload.totalActiveBookings ?? 0),
          pendingBookings:     Number(payload.pendingBookings ?? 0),
          confirmedBookings:   Number(payload.confirmedBookings ?? 0),
          totalActiveBookings: Number(payload.totalActiveBookings ?? payload.totalBookings ?? 0),
          checkInsToday:       Number(payload.checkingInToday ?? 0),
          checkOutsToday:      Number(payload.checkingOutToday ?? 0),
          monthRevenue:        Number(payload.currentMonthRevenue ?? 0),
        };
      }
    } catch {
      // Fall through to a hard error below.
    }

    throw new Error('Failed to fetch dashboard statistics');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// fetchAllBookings — pulls all reservations from Render/Neon
// ══════════════════════════════════════════════════════════════════════════════
export async function fetchAllBookings(): Promise<NeonBooking[]> {
  const response = await fetch(`${API_BASE}/api/bookings`);

  if (!response.ok) {
    throw new Error(`Failed to fetch bookings: ${response.statusText}`);
  }

  const payload = await response.json() as { success: boolean; bookings: NeonBooking[] };
  return payload.bookings ?? [];
}

// ══════════════════════════════════════════════════════════════════════════════
// updateBookingStatus — check in / check out a guest
// ══════════════════════════════════════════════════════════════════════════════
export async function updateBookingStatus(
  bookingId: number,
  status: 'Confirmed' | 'Checked In' | 'Checked Out' | 'Cancelled'
): Promise<NeonBooking> {
  const response = await fetch(`${API_BASE}/api/bookings/${bookingId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'Failed to update booking status');
  }

  const payload = await response.json() as { booking: NeonBooking };
  return payload.booking;
}

// ══════════════════════════════════════════════════════════════════════════════
// updateRoomStatus — toggle room available / occupied / maintenance
// ══════════════════════════════════════════════════════════════════════════════
export async function updateRoomStatus(
  roomId: number,
  status: 'Available' | 'Occupied' | 'Under Maintenance'
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'Failed to update room status');
  }
}

// ─── Internal: compute stats from bookings array ─────────────────────────────
function computeStats(bookings: NeonBooking[]): DashboardStats {
  const today      = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;

  const pending    = bookings.filter(b => normalizeStatus(b.booking_status) === 'pending');
  const confirmed  = bookings.filter(b => normalizeStatus(b.booking_status) === 'confirmed');
  const checkedIn  = bookings.filter(b => normalizeStatus(b.booking_status) === 'checked_in');
  const active     = [...pending, ...confirmed, ...checkedIn];

  return {
    totalBookings:       bookings.length,
    pendingBookings:     pending.length,
    confirmedBookings:   confirmed.length,
    totalActiveBookings: active.length,

    checkInsToday: bookings.filter(b => {
      const s = normalizeStatus(b.booking_status);
      return b.check_in_date === today && (s === 'pending' || s === 'confirmed');
    }).length,

    checkOutsToday: bookings.filter(b => {
      const s = normalizeStatus(b.booking_status);
      return b.check_out_date === today && s === 'checked_in';
    }).length,

    monthRevenue: bookings
      .filter(b => {
        const s = normalizeStatus(b.booking_status);
        return b.check_in_date >= monthStart &&
          (s === 'confirmed' || s === 'checked_in' || s === 'checked_out');
      })
      .reduce((sum, b) => sum + Number(b.total_amount), 0),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Formatting helpers
// ══════════════════════════════════════════════════════════════════════════════

/** Format amounts in Ghana Cedis. */
export function formatGHS(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format ISO date string for table cells. */
export function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Today's date as YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Current month label e.g. "July 2026". */
export function currentMonthLabel(): string {
  return new Date().toLocaleDateString('en-GH', {
    month: 'long',
    year: 'numeric',
  });
}