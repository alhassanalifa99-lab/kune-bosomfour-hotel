import { useState, type FormEvent } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { formatGHS } from '../../lib/api/dashboard';
import type { Room } from '../../types/database';

interface RoomEditModalProps {
  room: Room;
  onClose: () => void;
}

/** Modal for editing a room's nightly base price. */
export function RoomEditModal({ room, onClose }: RoomEditModalProps) {
  const { editRoomPrice, actionLoadingId } = useAdmin();
  const [price, setPrice] = useState(String(room.base_price));
  const [error, setError] = useState('');
  const isSaving = actionLoadingId === room.id;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number.parseFloat(price);

    if (Number.isNaN(parsed) || parsed < 0) {
      setError('Enter a valid price of zero or greater.');
      return;
    }

    await editRoomPrice(room.id, parsed);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-room-title">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3 id="edit-room-title">Edit Room {room.room_number}</h3>
            <p>{room.room_type} — current rate {formatGHS(room.base_price)}</p>
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body">
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}
            <div className="field">
              <label htmlFor="room-price">Base price per night (GH₵)</label>
              <input
                id="room-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save Price'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
