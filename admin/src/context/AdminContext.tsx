import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  checkInGuest,
  checkOutGuest,
  createWalkInBooking,
  fetchBookings,
  subscribeToBookings,
} from '../lib/api/bookings';
import { fetchDashboardStats } from '../lib/api/dashboard';
import {
  fetchRooms,
  subscribeToRooms,
  updateRoomPrice,
  updateRoomStatus,
} from '../lib/api/rooms';
import { isSupabaseConfigured } from '../lib/supabase';
import type {
  AdminSection,
  BookingFilters,
  BookingWithRoom,
  DashboardStats,
  Room,
  RoomStatus,
  WalkInBookingInput,
} from '../types/database';
import { ROOM_STATUS_CYCLE } from '../types/database';

interface AdminContextValue {
  section: AdminSection;
  setSection: (section: AdminSection) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  rooms: Room[];
  bookings: BookingWithRoom[];
  stats: DashboardStats;
  roomsLoading: boolean;
  bookingsLoading: boolean;
  statsLoading: boolean;
  error: string | null;
  clearError: () => void;
  bookingFilters: BookingFilters;
  setBookingFilters: (filters: Partial<BookingFilters>) => void;
  refreshAll: () => Promise<void>;
  cycleRoomStatus: (roomId: string) => Promise<void>;
  setRoomStatus: (roomId: string, status: RoomStatus) => Promise<void>;
  editRoomPrice: (roomId: string, price: number) => Promise<void>;
  handleCheckIn: (booking: BookingWithRoom) => Promise<void>;
  handleCheckOut: (booking: BookingWithRoom) => Promise<void>;
  submitWalkIn: (input: WalkInBookingInput) => Promise<void>;
  actionLoadingId: string | null;
  isDemoMode: boolean;
  walkInOpen: boolean;
  setWalkInOpen: (open: boolean) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

const EMPTY_STATS: DashboardStats = {
  totalBookings: 0,
  checkInsToday: 0,
  checkOutsToday: 0,
  monthRevenue: 0,
};

export function AdminProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('mariam-admin-theme');
    return stored === 'light' ? 'light' : 'dark';
  });

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<BookingWithRoom[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [roomsLoading, setRoomsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const [bookingFilters, setFilters] = useState<BookingFilters>({
    status: 'all',
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  const setBookingFilters = useCallback((partial: Partial<BookingFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('mariam-admin-theme', next);
      return next;
    });
  }, []);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const data = await fetchRooms();
      setRooms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const data = await fetchBookings();
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    await Promise.all([loadRooms(), loadBookings(), loadStats()]);
  }, [loadRooms, loadBookings, loadStats]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Realtime subscriptions keep the dashboard in sync with guest bookings
  useEffect(() => {
    const unsubRooms = subscribeToRooms(() => {
      void loadRooms();
      void loadStats();
    });
    const unsubBookings = subscribeToBookings(() => {
      void loadBookings();
      void loadStats();
    });
    return () => {
      unsubRooms();
      unsubBookings();
    };
  }, [loadRooms, loadBookings, loadStats]);

  const cycleRoomStatus = useCallback(
    async (roomId: string) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;

      const currentIndex = ROOM_STATUS_CYCLE.indexOf(room.status);
      const nextStatus = ROOM_STATUS_CYCLE[(currentIndex + 1) % ROOM_STATUS_CYCLE.length];

      setActionLoadingId(roomId);
      try {
        const updated = await updateRoomStatus(roomId, nextStatus);
        setRooms((prev) => prev.map((r) => (r.id === roomId ? updated : r)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update room');
      } finally {
        setActionLoadingId(null);
      }
    },
    [rooms]
  );

  const setRoomStatus = useCallback(async (roomId: string, status: RoomStatus) => {
    setActionLoadingId(roomId);
    try {
      const updated = await updateRoomStatus(roomId, status);
      setRooms((prev) => prev.map((r) => (r.id === roomId ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update room');
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const editRoomPrice = useCallback(async (roomId: string, price: number) => {
    setActionLoadingId(roomId);
    try {
      const updated = await updateRoomPrice(roomId, price);
      setRooms((prev) => prev.map((r) => (r.id === roomId ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price');
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const handleCheckIn = useCallback(
    async (booking: BookingWithRoom) => {
      setActionLoadingId(booking.id);
      try {
        const updated = await checkInGuest(booking);
        setBookings((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
        await loadRooms();
        await loadStats();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Check-in failed');
      } finally {
        setActionLoadingId(null);
      }
    },
    [loadRooms, loadStats]
  );

  const handleCheckOut = useCallback(
    async (booking: BookingWithRoom) => {
      setActionLoadingId(booking.id);
      try {
        const updated = await checkOutGuest(booking);
        setBookings((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
        await loadRooms();
        await loadStats();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Check-out failed');
      } finally {
        setActionLoadingId(null);
      }
    },
    [loadRooms, loadStats]
  );

  const submitWalkIn = useCallback(
    async (input: WalkInBookingInput) => {
      setActionLoadingId('walk-in');
      try {
        const created = await createWalkInBooking(input);
        setBookings((prev) => [created, ...prev]);
        await loadRooms();
        await loadStats();
        setWalkInOpen(false);
        setSection('bookings');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Walk-in booking failed');
      } finally {
        setActionLoadingId(null);
      }
    },
    [loadRooms, loadStats]
  );

  const value = useMemo<AdminContextValue>(
    () => ({
      section,
      setSection,
      theme,
      toggleTheme,
      rooms,
      bookings,
      stats: stats ?? EMPTY_STATS,
      roomsLoading,
      bookingsLoading,
      statsLoading,
      error,
      clearError,
      bookingFilters,
      setBookingFilters,
      refreshAll,
      cycleRoomStatus,
      setRoomStatus,
      editRoomPrice,
      handleCheckIn,
      handleCheckOut,
      submitWalkIn,
      actionLoadingId,
      isDemoMode: !isSupabaseConfigured,
      walkInOpen,
      setWalkInOpen,
    }),
    [
      section,
      theme,
      toggleTheme,
      rooms,
      bookings,
      stats,
      roomsLoading,
      bookingsLoading,
      statsLoading,
      error,
      clearError,
      bookingFilters,
      setBookingFilters,
      refreshAll,
      cycleRoomStatus,
      setRoomStatus,
      editRoomPrice,
      handleCheckIn,
      handleCheckOut,
      submitWalkIn,
      actionLoadingId,
      walkInOpen,
    ]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return ctx;
}
