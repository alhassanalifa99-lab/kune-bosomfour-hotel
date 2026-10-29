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
import {
  clearQueuedActions,
  computeDashboardStatsFromBookings,
  getCachedBookings,
  getCachedRooms,
  getCachedStats,
  getQueuedActions,
  isOfflineMode,
  saveCachedBookings,
  saveCachedRooms,
  saveCachedStats,
} from '../lib/offline';
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
  isOffline: boolean;
  pendingSyncCount: number;
  syncStatus: string | null;
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
  pendingBookings: 0,
  confirmedBookings: 0,
  totalActiveBookings: 0,
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
  const [isOffline, setIsOffline] = useState<boolean>(() => isOfflineMode());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => getQueuedActions().length);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const [rooms, setRooms] = useState<Room[]>(() => getCachedRooms());
  const [bookings, setBookings] = useState<BookingWithRoom[]>(() => getCachedBookings());
  const [stats, setStats] = useState<DashboardStats | null>(() => getCachedStats());

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
  const refreshQueuedActionCount = useCallback(() => {
    setPendingSyncCount(getQueuedActions().length);
  }, []);

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
      saveCachedRooms(data);
    } catch (err) {
      const cachedRooms = getCachedRooms();
      if (cachedRooms.length > 0) {
        setRooms(cachedRooms);
      }
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
      saveCachedBookings(data);
    } catch (err) {
      const cachedBookings = getCachedBookings();
      if (cachedBookings.length > 0) {
        setBookings(cachedBookings);
      }
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
      saveCachedStats(data);
    } catch (err) {
      const cachedStats = getCachedStats() ?? computeDashboardStatsFromBookings(getCachedBookings());
      if (cachedStats) {
        setStats(cachedStats);
        saveCachedStats(cachedStats);
      }
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    await Promise.all([loadRooms(), loadBookings(), loadStats()]);
  }, [loadRooms, loadBookings, loadStats]);

  const syncQueuedActions = useCallback(async () => {
    if (isOfflineMode()) {
      refreshQueuedActionCount();
      return 0;
    }

    const queued = getQueuedActions();
    if (queued.length === 0) {
      setPendingSyncCount(0);
      setSyncStatus(null);
      return 0;
    }

    let synced = 0;

    for (const action of queued) {
      try {
        if (action.type === 'room-status') {
          await updateRoomStatus(action.payload.roomId, action.payload.status);
        } else if (action.type === 'room-price') {
          await updateRoomPrice(action.payload.roomId, action.payload.basePrice);
        } else if (action.type === 'booking-status') {
          const localBooking = getCachedBookings().find((booking) => booking.id === action.payload.bookingId)
            ?? bookings.find((booking) => booking.id === action.payload.bookingId);

          if (!localBooking) {
            continue;
          }

          if (action.payload.status === 'checked_in') {
            await checkInGuest(localBooking);
          } else if (action.payload.status === 'checked_out') {
            await checkOutGuest(localBooking);
          }
        } else if (action.type === 'walk-in') {
          const nextBooking = action.payload;
          await createWalkInBooking({
            room_id: nextBooking.room_id,
            guest_name: nextBooking.guest_name,
            guest_email: nextBooking.guest_email ?? undefined,
            guest_phone: nextBooking.guest_phone ?? undefined,
            check_in_date: nextBooking.check_in_date,
            check_out_date: nextBooking.check_out_date,
            amount_paid: nextBooking.amount_paid,
            guest_count: nextBooking.guest_count ?? 1,
            special_requests: nextBooking.special_requests ?? undefined,
          });
        }

        synced += 1;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Queued offline update failed to sync');
      }
    }

    clearQueuedActions();
    setPendingSyncCount(0);
    if (synced > 0) {
      setSyncStatus(`${synced} saved change${synced === 1 ? '' : 's'} synced`);
    }

    await refreshAll();
    return synced;
  }, [bookings, refreshAll, refreshQueuedActionCount]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onNetworkChange = () => {
      const offline = isOfflineMode();
      setIsOffline(offline);

      if (!offline) {
        void syncQueuedActions();
      } else {
        refreshQueuedActionCount();
      }
    };

    window.addEventListener('online', onNetworkChange);
    window.addEventListener('offline', onNetworkChange);

    return () => {
      window.removeEventListener('online', onNetworkChange);
      window.removeEventListener('offline', onNetworkChange);
    };
  }, [refreshQueuedActionCount, syncQueuedActions]);

  useEffect(() => {
    setIsOffline(isOfflineMode());
    refreshQueuedActionCount();
  }, [refreshQueuedActionCount]);

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
        refreshQueuedActionCount();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update room');
      } finally {
        setActionLoadingId(null);
      }
    },
    [refreshQueuedActionCount, rooms]
  );

  const setRoomStatus = useCallback(async (roomId: string, status: RoomStatus) => {
    setActionLoadingId(roomId);
    try {
      const updated = await updateRoomStatus(roomId, status);
      setRooms((prev) => prev.map((r) => (r.id === roomId ? updated : r)));
      refreshQueuedActionCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update room');
    } finally {
      setActionLoadingId(null);
    }
  }, [refreshQueuedActionCount]);

  const editRoomPrice = useCallback(async (roomId: string, price: number) => {
    setActionLoadingId(roomId);
    try {
      const updated = await updateRoomPrice(roomId, price);
      setRooms((prev) => prev.map((r) => (r.id === roomId ? updated : r)));
      refreshQueuedActionCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price');
    } finally {
      setActionLoadingId(null);
    }
  }, [refreshQueuedActionCount]);

  const handleCheckIn = useCallback(
    async (booking: BookingWithRoom) => {
      setActionLoadingId(booking.id);
      try {
        const updated = await checkInGuest(booking);
        setBookings((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
        refreshQueuedActionCount();
        await loadRooms();
        await loadStats();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Check-in failed');
      } finally {
        setActionLoadingId(null);
      }
    },
    [loadRooms, loadStats, refreshQueuedActionCount]
  );

  const handleCheckOut = useCallback(
    async (booking: BookingWithRoom) => {
      setActionLoadingId(booking.id);
      try {
        const updated = await checkOutGuest(booking);
        setBookings((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
        refreshQueuedActionCount();
        await loadRooms();
        await loadStats();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Check-out failed');
      } finally {
        setActionLoadingId(null);
      }
    },
    [loadRooms, loadStats, refreshQueuedActionCount]
  );

  const submitWalkIn = useCallback(
    async (input: WalkInBookingInput) => {
      setActionLoadingId('walk-in');
      try {
        const created = await createWalkInBooking(input);
        setBookings((prev) => [created, ...prev]);
        refreshQueuedActionCount();
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
    [loadRooms, loadStats, refreshQueuedActionCount]
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
      isOffline,
      pendingSyncCount,
      syncStatus,
      cycleRoomStatus,
      setRoomStatus,
      editRoomPrice,
      handleCheckIn,
      handleCheckOut,
      submitWalkIn,
      actionLoadingId,
      isDemoMode: false,
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
      isOffline,
      pendingSyncCount,
      syncStatus,
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
