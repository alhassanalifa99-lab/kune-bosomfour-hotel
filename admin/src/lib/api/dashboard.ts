import { type DashboardStats } from '../../types/database';

// ─── Render API base URL; override with VITE_API_BASE for local/dev testing ─
const API_BASE = (import.meta.env.VITE_API_BASE || 'https://hotel-proect.onrender.com').replace(/\/$/, '');

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
    const response = await fetch(`${API_BASE}/api/stats`);

    if (response.ok) {
      const payload = await response.json() as {
        totalActiveBookings?: number;
        checkingInToday?: number;
        checkingOutToday?: number;
        currentMonthRevenue?: number;
      };

      return {
        totalBookings:  Number(payload.totalActiveBookings  ?? 0),
        checkInsToday:  Number(payload.checkingInToday      ?? 0),
        checkOutsToday: Number(payload.checkingOutToday     ?? 0),
        monthRevenue:   Number(payload.currentMonthRevenue  ?? 0),
      };
    }
  } catch {
    // Stats endpoint unreachable — fall through to manual compute
  }

  // ── Fallback: compute stats from the bookings list ────────────────────────
  const bookings = await fetchAllBookings();
  return computeStats(bookings);
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

  const activeStatuses = new Set(['pending', 'confirmed', 'checked_in']);

  return {
    totalBookings: bookings.filter(b =>
      activeStatuses.has(normalizeStatus(b.booking_status))
    ).length,

    checkInsToday: bookings.filter(b => {
      const s = normalizeStatus(b.booking_status);
      return b.check_in_date === today && (s === 'confirmed' || s === 'checked_in');
    }).length,

    checkOutsToday: bookings.filter(b => {
      const s = normalizeStatus(b.booking_status);
      return b.check_out_date === today && (s === 'checked_in' || s === 'confirmed');
    }).length,

    monthRevenue: bookings
      .filter(b =>
        b.check_in_date >= monthStart &&
        normalizeStatus(b.booking_status) !== 'pending'
      )
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

/** Format a booking date string for table cells without crashing on older/alternate DB values. */
export function formatDate(dateStr: string): string {
  const value = String(dateStr ?? '').trim();
  if (!value) {
    return '—';
  }

  const candidates = [
    value.includes('T') || value.includes(' ') ? value.replace(' ', 'T') : `${value}T00:00:00`,
    value,
  ];

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-GH', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  }

  return '—';
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