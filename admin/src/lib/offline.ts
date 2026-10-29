import type { BookingWithRoom, DashboardStats, Room, RoomStatus } from '../types/database';

const STORAGE_PREFIX = 'mariam-admin-cache';
const STORAGE_KEYS = {
  rooms: `${STORAGE_PREFIX}:rooms`,
  bookings: `${STORAGE_PREFIX}:bookings`,
  stats: `${STORAGE_PREFIX}:stats`,
  queuedActions: `${STORAGE_PREFIX}:queued-actions`,
} as const;

export type OfflineAction =
  | { type: 'room-status'; payload: { roomId: string; status: RoomStatus } }
  | { type: 'room-price'; payload: { roomId: string; basePrice: number } }
  | { type: 'booking-status'; payload: { bookingId: string; roomId: string; status: BookingWithRoom['status'] } }
  | { type: 'booking-create'; payload: BookingWithRoom }
  | { type: 'walk-in'; payload: BookingWithRoom };

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota/storage issues and continue with in-memory state.
  }
}

export function isOfflineMode(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return !navigator.onLine;
}

export function saveCachedRooms(rooms: Room[]): void {
  writeStorage(STORAGE_KEYS.rooms, rooms);
}

export function getCachedRooms(): Room[] {
  return readStorage<Room[]>(STORAGE_KEYS.rooms, []);
}

export function saveCachedBookings(bookings: BookingWithRoom[]): void {
  writeStorage(STORAGE_KEYS.bookings, bookings);
}

export function getCachedBookings(): BookingWithRoom[] {
  return readStorage<BookingWithRoom[]>(STORAGE_KEYS.bookings, []);
}

export function saveCachedStats(stats: DashboardStats): void {
  writeStorage(STORAGE_KEYS.stats, stats);
}

export function getCachedStats(): DashboardStats | null {
  return readStorage<DashboardStats | null>(STORAGE_KEYS.stats, null);
}

export function getQueuedActions(): OfflineAction[] {
  return readStorage<OfflineAction[]>(STORAGE_KEYS.queuedActions, []);
}

export function queueOfflineAction(action: OfflineAction): void {
  const queued = getQueuedActions();
  queued.push(action);
  writeStorage(STORAGE_KEYS.queuedActions, queued);
}

export function clearQueuedActions(): void {
  writeStorage(STORAGE_KEYS.queuedActions, []);
}

export function computeDashboardStatsFromBookings(bookings: BookingWithRoom[]): DashboardStats {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;

  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter((booking) => booking.status === 'pending_confirmation').length;
  const confirmedBookings = bookings.filter((booking) => booking.status === 'confirmed').length;
  const totalActiveBookings = bookings.filter((booking) =>
    booking.status === 'pending_confirmation' || booking.status === 'confirmed' || booking.status === 'checked_in'
  ).length;

  const checkInsToday = bookings.filter((booking) => {
    return booking.check_in_date === today &&
      (booking.status === 'pending_confirmation' || booking.status === 'confirmed' || booking.status === 'checked_in');
  }).length;

  const checkOutsToday = bookings.filter((booking) => {
    return booking.check_out_date === today &&
      (booking.status === 'confirmed' || booking.status === 'checked_in' || booking.status === 'checked_out');
  }).length;

  const monthRevenue = bookings
    .filter((booking) => booking.check_in_date >= monthStart && booking.status !== 'checked_out')
    .reduce((sum, booking) => sum + Number(booking.amount_paid ?? 0), 0);

  return {
    totalBookings,
    pendingBookings,
    confirmedBookings,
    totalActiveBookings,
    checkInsToday,
    checkOutsToday,
    monthRevenue,
  };
}
