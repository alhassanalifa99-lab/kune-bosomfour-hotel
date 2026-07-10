import { useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { formatGHS } from '../../lib/api/dashboard';
import { ROOM_STATUS_LABELS } from '../../types/database';
import type { Room } from '../../types/database';
import { StatusBadge, EmptyState } from '../ui/StatusBadge';
import { RoomEditModal } from './RoomEditModal';

/** Room card with status toggle and price edit entry point. */
function RoomCard({ room }: { room: Room }) {
  const { cycleRoomStatus, actionLoadingId } = useAdmin();
  const [editOpen, setEditOpen] = useState(false);
  const isLoading = actionLoadingId === room.id;

  return (
    <>
      <article className="room-card">
        <div className="room-card-top">
          <div>
            <p className="room-number">Room {room.room_number}</p>
            <p className="room-type">{room.room_type}</p>
          </div>
          <StatusBadge variant={room.status} label={ROOM_STATUS_LABELS[room.status]} />
        </div>

        <div className="room-price-row">
          <span className="room-price-label">Base price / night</span>
          <span className="room-price-value">{formatGHS(room.base_price)}</span>
        </div>

        <div className="room-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void cycleRoomStatus(room.id)}
            disabled={isLoading}
          >
            {isLoading ? 'Updating…' : 'Toggle Status'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEditOpen(true)}
            disabled={isLoading}
          >
            Edit Price
          </button>
        </div>
      </article>

      {editOpen && (
        <RoomEditModal room={room} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}

/** Visual grid of all hotel rooms with CRUD controls. */
export function RoomManagement() {
  const { rooms, roomsLoading } = useAdmin();

  if (roomsLoading) {
    return (
      <div className="skeleton-grid" aria-busy="true" aria-label="Loading rooms">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-card" />
        ))}
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <EmptyState
        title="No rooms configured"
        description="Run the Supabase schema seed script to populate your room inventory, or add rooms directly in the database."
      />
    );
  }

  const available = rooms.filter((r) => r.status === 'available').length;
  const occupied = rooms.filter((r) => r.status === 'occupied').length;
  const maintenance = rooms.filter((r) => r.status === 'maintenance').length;

  return (
    <>
      <div className="rooms-toolbar">
        <div className="rooms-stats">
          <span>
            <strong>{rooms.length}</strong> total rooms
          </span>
          <span>
            <strong>{available}</strong> available
          </span>
          <span>
            <strong>{occupied}</strong> occupied
          </span>
          <span>
            <strong>{maintenance}</strong> maintenance
          </span>
        </div>
      </div>

      <div className="rooms-grid">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </>
  );
}
