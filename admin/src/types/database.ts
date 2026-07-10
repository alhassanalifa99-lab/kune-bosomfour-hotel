/** Room availability states used across the admin dashboard. */
export type RoomStatus = 'available' | 'occupied' | 'maintenance';

/** Booking lifecycle states from reservation through checkout. */
export type BookingStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out';

export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'staff';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  room_number: string;
  room_type: string;
  base_price: number;
  status: RoomStatus;
  created_at: string;
  updated_at: string;
}

/** Booking row joined with room details for table display. */
export interface BookingWithRoom extends Booking {
  rooms: Pick<Room, 'room_number' | 'room_type' | 'id'> | null;
}

export interface Booking {
  id: string;
  room_id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  amount_paid: number;
  status: BookingStatus;
  is_walk_in: boolean;
  guest_count: number;
  special_requests: string | null;
  created_at: string;
  updated_at: string;
}

/** Aggregated metrics shown on the dashboard overview. */
export interface DashboardStats {
  totalBookings: number;
  checkInsToday: number;
  checkOutsToday: number;
  monthRevenue: number;
}

export interface WalkInBookingInput {
  room_id: string;
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;
  check_in_date: string;
  check_out_date: string;
  amount_paid: number;
  guest_count?: number;
  special_requests?: string;
}

export type AdminSection = 'dashboard' | 'rooms' | 'bookings';

export interface BookingFilters {
  status: BookingStatus | 'all';
  search: string;
  dateFrom: string;
  dateTo: string;
}

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  maintenance: 'Under Maintenance',
};

export function normalizeBookingStatus(status: string | null | undefined): BookingStatus {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'pending':
    case 'pending_confirmation':
    case 'pending-confirmation':
      return 'pending_confirmation';
    case 'confirmed':
    case 'confirm':
      return 'confirmed';
    case 'checked_in':
    case 'checked-in':
    case 'checkin':
      return 'checked_in';
    case 'checked_out':
    case 'checked-out':
    case 'checkout':
      return 'checked_out';
    default:
      return 'pending_confirmation';
  }
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending_confirmation: 'Pending Confirmation',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
};

/** Cycle room status: available → occupied → maintenance → available */
export const ROOM_STATUS_CYCLE: RoomStatus[] = [
  'available',
  'occupied',
  'maintenance',
];
