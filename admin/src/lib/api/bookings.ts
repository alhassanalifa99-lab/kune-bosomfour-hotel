import {
  normalizeBookingStatus,
  type BookingFilters,
  type BookingStatus,
  type BookingWithRoom,
  type WalkInBookingInput,
} from '../../types/database';
import { isSupabaseConfigured, supabase } from '../supabase';
import { updateRoomStatus } from './rooms';
import { DEMO_BOOKINGS, DEMO_ROOMS } from '../demoData';

const BOOKING_SELECT = `
  *,
  rooms (
    id,
    room_number,
    room_type
  )
`;

function normalizeBookingRow(row: Record<string, unknown>): BookingWithRoom {
  const roomsRaw = (row.rooms as Record<string, unknown> | null) ?? null;
  const roomNumber = String((row.room_number as string | undefined) ?? roomsRaw?.room_number ?? '');
  const roomType = String((row.room_type as string | undefined) ?? roomsRaw?.room_type ?? '');

  return {
    id: String(row.id ?? ''),
    room_id: String(row.room_id ?? ''),
    guest_name: String(row.guest_name ?? 'Guest'),
    guest_email: row.guest_email ? String(row.guest_email) : null,
    guest_phone: row.guest_phone ? String(row.guest_phone) : null,
    check_in_date: String(row.check_in_date ?? ''),
    check_out_date: String(row.check_out_date ?? ''),
    amount_paid: Number(row.total_amount ?? row.amount_paid ?? 0),
    status: normalizeBookingStatus(String(row.booking_status ?? row.status ?? 'pending_confirmation')),
    is_walk_in: Boolean(row.is_walk_in),
    guest_count: Number(row.guest_count ?? 1),
    special_requests: row.special_requests ? String(row.special_requests) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    rooms:
      roomNumber || roomType || roomsRaw
        ? {
            id: String(roomsRaw?.id ?? ''),
            room_number: roomNumber,
            room_type: roomType,
          }
        : null,
  };
}

async function fetchBookingsFromApi(): Promise<BookingWithRoom[] | null> {
  try {
    const response = await fetch('/api/bookings');
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const payload = (await response.json()) as { bookings?: Array<Record<string, unknown>> };
    const rows = Array.isArray(payload.bookings) ? payload.bookings : [];
    return rows.map(normalizeBookingRow);
  } catch {
    return null;
  }
}

/** Fetch all bookings with joined room data, newest first. */
export async function fetchBookings(): Promise<BookingWithRoom[]> {
  const apiBookings = await fetchBookingsFromApi();
  if (apiBookings !== null) {
    return apiBookings;
  }

  if (!isSupabaseConfigured) {
    return structuredClone(DEMO_BOOKINGS);
  }

  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch bookings: ${error.message}`);
  }

  return (data ?? []).map(normalizeBookingRow);
}

/** Create a walk-in booking and mark the room as occupied if checking in today. */
export async function createWalkInBooking(
  input: WalkInBookingInput
): Promise<BookingWithRoom> {
  const payload = {
    room_id: input.room_id,
    guest_name: input.guest_name,
    guest_email: input.guest_email ?? null,
    guest_phone: input.guest_phone ?? null,
    check_in_date: input.check_in_date,
    check_out_date: input.check_out_date,
    total_amount: input.amount_paid,
    guest_count: input.guest_count ?? 1,
    special_requests: input.special_requests ?? null,
    booking_status: 'confirmed' as BookingStatus,
    is_walk_in: true,
  };

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = (await response.json()) as { booking?: Record<string, unknown> };
      if (result.booking) {
        return normalizeBookingRow(result.booking);
      }
    }
  } catch {
    // Fall back below if the local API is unavailable.
  }

  if (!isSupabaseConfigured) {
    const room = DEMO_ROOMS.find((r) => r.id === input.room_id);
    const booking: BookingWithRoom = {
      id: crypto.randomUUID(),
      room_id: input.room_id,
      guest_name: input.guest_name,
      guest_email: input.guest_email ?? null,
      guest_phone: input.guest_phone ?? null,
      check_in_date: input.check_in_date,
      check_out_date: input.check_out_date,
      amount_paid: input.amount_paid,
      guest_count: input.guest_count ?? 1,
      special_requests: input.special_requests ?? null,
      status: 'confirmed',
      is_walk_in: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rooms: room
        ? { id: room.id, room_number: room.room_number, room_type: room.room_type }
        : null,
    };
    DEMO_BOOKINGS.unshift(booking);
    if (room && input.check_in_date <= new Date().toISOString().split('T')[0]) {
      room.status = 'occupied';
    }
    return structuredClone(booking);
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      room_id: input.room_id,
      guest_name: input.guest_name,
      guest_email: input.guest_email ?? null,
      guest_phone: input.guest_phone ?? null,
      check_in_date: input.check_in_date,
      check_out_date: input.check_out_date,
      amount_paid: input.amount_paid,
      guest_count: input.guest_count ?? 1,
      special_requests: input.special_requests ?? null,
      status: 'confirmed' as BookingStatus,
      is_walk_in: true,
    })
    .select(BOOKING_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create walk-in booking: ${error.message}`);
  }

  const today = new Date().toISOString().split('T')[0];
  if (input.check_in_date <= today) {
    await updateRoomStatus(input.room_id, 'occupied');
  }

  return normalizeBookingRow(data as Record<string, unknown>);
}

/** Check a guest in: update booking status and set room to occupied. */
export async function checkInGuest(booking: BookingWithRoom): Promise<BookingWithRoom> {
  if (!booking.room_id) {
    throw new Error('Booking has no assigned room');
  }

  try {
    const response = await fetch(`/api/bookings/${booking.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'checked_in' }),
    });

    if (response.ok) {
      const result = (await response.json()) as { booking?: Record<string, unknown> };
      if (result.booking) {
        return normalizeBookingRow(result.booking);
      }
    }
  } catch {
    // Fall back below if the local API is unavailable.
  }

  if (!isSupabaseConfigured) {
    const match = DEMO_BOOKINGS.find((b) => b.id === booking.id);
    if (match) {
      match.status = 'checked_in';
      match.updated_at = new Date().toISOString();
    }
    const room = DEMO_ROOMS.find((r) => r.id === booking.room_id);
    if (room) room.status = 'occupied';
    return structuredClone(match ?? booking);
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'checked_in' })
    .eq('id', booking.id)
    .select(BOOKING_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to check in guest: ${error.message}`);
  }

  await updateRoomStatus(booking.room_id, 'occupied');
  return normalizeBookingRow(data as Record<string, unknown>);
}

/** Check a guest out: update booking status and set room to available. */
export async function checkOutGuest(booking: BookingWithRoom): Promise<BookingWithRoom> {
  if (!booking.room_id) {
    throw new Error('Booking has no assigned room');
  }

  try {
    const response = await fetch(`/api/bookings/${booking.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'checked_out' }),
    });

    if (response.ok) {
      const result = (await response.json()) as { booking?: Record<string, unknown> };
      if (result.booking) {
        return normalizeBookingRow(result.booking);
      }
    }
  } catch {
    // Fall back below if the local API is unavailable.
  }

  if (!isSupabaseConfigured) {
    const match = DEMO_BOOKINGS.find((b) => b.id === booking.id);
    if (match) {
      match.status = 'checked_out';
      match.updated_at = new Date().toISOString();
    }
    const room = DEMO_ROOMS.find((r) => r.id === booking.room_id);
    if (room) room.status = 'available';
    return structuredClone(match ?? booking);
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'checked_out' })
    .eq('id', booking.id)
    .select(BOOKING_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to check out guest: ${error.message}`);
  }

  await updateRoomStatus(booking.room_id, 'available');
  return normalizeBookingRow(data as Record<string, unknown>);
}

/** Subscribe to realtime booking changes; returns unsubscribe cleanup. */
export function subscribeToBookings(onChange: () => void): () => void {
  if (!isSupabaseConfigured) {
    return () => undefined;
  }

  const channel = supabase
    .channel('admin-bookings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings' },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Client-side filter for the bookings table. */
export function filterBookings(
  bookings: BookingWithRoom[],
  filters: BookingFilters
): BookingWithRoom[] {
  const query = filters.search.trim().toLowerCase();

  return bookings.filter((booking) => {
    if (filters.status !== 'all' && booking.status !== filters.status) {
      return false;
    }

    if (filters.dateFrom && booking.check_in_date < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && booking.check_in_date > filters.dateTo) {
      return false;
    }

    if (!query) return true;

    const roomLabel = booking.rooms
      ? `${booking.rooms.room_number} ${booking.rooms.room_type}`.toLowerCase()
      : '';

    return (
      booking.guest_name.toLowerCase().includes(query) ||
      (booking.guest_email?.toLowerCase().includes(query) ?? false) ||
      roomLabel.includes(query)
    );
  });
}
