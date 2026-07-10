import { neon } from '@neondatabase/serverless';
import type {
  BookingWithRoom,
  DashboardStats,
  Room,
  RoomStatus,
  WalkInBookingInput,
} from '../types/database';

const DATABASE_URL =
  (import.meta.env.VITE_DATABASE_URL as string | undefined) ??
  (import.meta.env.DATABASE_URL as string | undefined);

function getSql() {
  if (!DATABASE_URL) {
    throw new Error('Set VITE_DATABASE_URL or DATABASE_URL to enable Neon PostgreSQL access.');
  }

  return neon(DATABASE_URL);
}

/**
 * Fetch dashboard metrics from a Neon Postgres instance.
 * This is intended for server-side API routes or Next.js server actions.
 */
export async function fetchDashboardStatsFromNeon(): Promise<DashboardStats> {
  const sql = getSql();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;

  const rows = (await sql`SELECT check_in_date, check_out_date, amount_paid, status FROM bookings`) as Array<{
    check_in_date: string;
    check_out_date: string;
    amount_paid: number;
    status: string;
  }>;

  const activeStatuses = new Set(['pending_confirmation', 'confirmed', 'checked_in']);
  const activeBookings = rows.filter((row) => activeStatuses.has(row.status));

  return {
    totalBookings: activeBookings.length,
    checkInsToday: rows.filter(
      (row) => row.check_in_date === today && ['confirmed', 'checked_in'].includes(row.status)
    ).length,
    checkOutsToday: rows.filter(
      (row) => row.check_out_date === today && ['checked_in', 'confirmed'].includes(row.status)
    ).length,
    monthRevenue: rows
      .filter((row) => row.check_in_date >= monthStart && row.status !== 'pending_confirmation')
      .reduce((sum, row) => sum + Number(row.amount_paid), 0),
  };
}

/**
 * Update a room's availability state in Neon.
 */
export async function updateRoomStatusInNeon(roomId: string, status: RoomStatus): Promise<Room> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE rooms
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${roomId}
    RETURNING id, room_number, room_type, base_price, status, created_at, updated_at
  `) as Room[];

  const [row] = rows;
  if (!row) {
    throw new Error('Room not found in Neon database.');
  }

  return row;
}

/**
 * Insert a new booking and optionally mark the assigned room occupied for same-day arrivals.
 */
export async function logBookingInNeon(input: WalkInBookingInput): Promise<BookingWithRoom> {
  const sql = getSql();
  const today = new Date().toISOString().split('T')[0];

  const [booking] = (await sql`
    INSERT INTO bookings (
      room_id,
      guest_name,
      guest_email,
      guest_phone,
      check_in_date,
      check_out_date,
      amount_paid,
      guest_count,
      special_requests,
      status,
      is_walk_in,
      created_at,
      updated_at
    ) VALUES (
      ${input.room_id},
      ${input.guest_name},
      ${input.guest_email ?? null},
      ${input.guest_phone ?? null},
      ${input.check_in_date},
      ${input.check_out_date},
      ${input.amount_paid},
      ${input.guest_count ?? 1},
      ${input.special_requests ?? null},
      'confirmed',
      true,
      NOW(),
      NOW()
    ) RETURNING *
  `) as BookingWithRoom[];

  if (!booking) {
    throw new Error('Failed to persist the booking in Neon.');
  }

  if (input.check_in_date <= today) {
    await updateRoomStatusInNeon(input.room_id, 'occupied');
  }

  return booking;
}

/**
 * Hook this into your server action or route handler for cache revalidation.
 */
export async function revalidateHotelAdmin(): Promise<void> {
  if (typeof globalThis !== 'undefined') {
    // In a framework like Next.js, call revalidatePath('/admin') or revalidateTag('hotel-admin') here.
  }
}
