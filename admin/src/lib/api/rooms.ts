import type { Room, RoomStatus } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../supabase';
import { DEMO_ROOMS } from '../demoData';

const API_BASE = (import.meta.env.VITE_API_BASE || 'https://hotel-proect.onrender.com').replace(/\/$/, '');

async function fetchRoomsFromApi(): Promise<Room[] | null> {
  try {
    const response = await fetch(`${API_BASE}/api/rooms`);
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const payload = (await response.json()) as { rooms?: Array<Record<string, unknown>> };
    const rows = Array.isArray(payload.rooms) ? payload.rooms : [];
    return rows.map(normalizeRoom);
  } catch {
    return null;
  }
}

/** Fetch all rooms ordered by room number. */
export async function fetchRooms(): Promise<Room[]> {
  const apiRooms = await fetchRoomsFromApi();
  if (apiRooms) {
    return apiRooms;
  }

  if (!isSupabaseConfigured) {
    return structuredClone(DEMO_ROOMS);
  }

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('room_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch rooms: ${error.message}`);
  }

  return (data ?? []).map(normalizeRoom);
}

/** Update a room's availability status. */
export async function updateRoomStatus(
  roomId: string,
  status: RoomStatus
): Promise<Room> {
  const mappedStatus = status.charAt(0).toUpperCase() + status.slice(1);

  try {
    const response = await fetch(`${API_BASE}/api/rooms/${roomId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: mappedStatus }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { room?: Record<string, unknown> };
      if (payload.room) {
        return normalizeRoom(payload.room);
      }
    }
  } catch {
    // Fall back below if the API is unavailable.
  }

  if (!isSupabaseConfigured) {
    const room = DEMO_ROOMS.find((r) => r.id === roomId);
    if (!room) throw new Error('Room not found');
    room.status = status;
    room.updated_at = new Date().toISOString();
    return structuredClone(room);
  }

  const { data, error } = await supabase
    .from('rooms')
    .update({ status })
    .eq('id', roomId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update room status: ${error.message}`);
  }

  return normalizeRoom(data);
}

/** Update a room's nightly base price in Ghana Cedis. */
export async function updateRoomPrice(
  roomId: string,
  basePrice: number
): Promise<Room> {
  if (!isSupabaseConfigured) {
    const room = DEMO_ROOMS.find((r) => r.id === roomId);
    if (!room) throw new Error('Room not found');
    room.base_price = basePrice;
    room.updated_at = new Date().toISOString();
    return structuredClone(room);
  }

  const { data, error } = await supabase
    .from('rooms')
    .update({ base_price: basePrice })
    .eq('id', roomId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update room price: ${error.message}`);
  }

  return normalizeRoom(data);
}

/** Subscribe to realtime room changes; returns unsubscribe cleanup. */
export function subscribeToRooms(onChange: () => void): () => void {
  if (!isSupabaseConfigured) {
    return () => undefined;
  }

  const channel = supabase
    .channel('admin-rooms')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms' },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

function normalizeRoom(row: Record<string, unknown>): Room {
  const rawStatus = String(row.status ?? '').trim().toLowerCase();
  const status: Room['status'] =
    rawStatus === 'occupied'
      ? 'occupied'
      : rawStatus === 'maintenance' || rawStatus === 'under_maintenance'
        ? 'maintenance'
        : 'available';

  return {
    id: String(row.id),
    room_number: String(row.room_number),
    room_type: String(row.room_type),
    base_price: Number(row.base_price ?? row.price_per_night ?? 0),
    status,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}
