import { useMemo, useState, type FormEvent } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { todayISO } from '../../lib/api/dashboard';

/** Modal form for registering a front-desk walk-in booking. */
export function WalkInModal() {
  const { walkInOpen, setWalkInOpen, rooms, submitWalkIn, actionLoadingId } = useAdmin();
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState(todayISO());
  const [checkOut, setCheckOut] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [guestCount, setGuestCount] = useState('1');
  const [specialRequests, setSpecialRequests] = useState('');
  const [error, setError] = useState('');

  const availableRooms = useMemo(
    () => rooms.filter((r) => r.status === 'available'),
    [rooms]
  );

  const isSaving = actionLoadingId === 'walk-in';

  if (!walkInOpen) return null;

  function resetForm() {
    setGuestName('');
    setGuestEmail('');
    setGuestPhone('');
    setRoomId('');
    setCheckIn(todayISO());
    setCheckOut('');
    setAmountPaid('');
    setGuestCount('1');
    setSpecialRequests('');
    setError('');
  }

  function handleClose() {
    resetForm();
    setWalkInOpen(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!guestName.trim()) {
      setError('Guest name is required.');
      return;
    }
    if (!roomId) {
      setError('Select an available room.');
      return;
    }
    if (!checkIn || !checkOut) {
      setError('Check-in and check-out dates are required.');
      return;
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }

    const paid = Number.parseFloat(amountPaid);
    if (Number.isNaN(paid) || paid < 0) {
      setError('Enter a valid amount paid.');
      return;
    }

    const selectedRoom = rooms.find((r) => r.id === roomId);
    if (!selectedRoom) {
      setError('Selected room is no longer available.');
      return;
    }

    // Auto-calculate suggested total if staff left amount blank
    const nights = Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
    );
    const suggestedTotal = selectedRoom.base_price * nights;
    const finalAmount = paid > 0 ? paid : suggestedTotal;

    await submitWalkIn({
      room_id: roomId,
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim() || undefined,
      guest_phone: guestPhone.trim() || undefined,
      check_in_date: checkIn,
      check_out_date: checkOut,
      amount_paid: finalAmount,
      guest_count: Number.parseInt(guestCount, 10) || 1,
      special_requests: specialRequests.trim() || undefined,
    });

    resetForm();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="walkin-title">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3 id="walkin-title">New Walk-In Booking</h3>
            <p>Register a guest arriving at the front desk without a prior online reservation.</p>
          </div>
          <button type="button" className="btn btn-icon" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body">
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}

            <div className="field">
              <label htmlFor="walkin-name">Guest full name</label>
              <input
                id="walkin-name"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="walkin-email">Email</label>
                <input
                  id="walkin-email"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="walkin-phone">Phone</label>
                <input
                  id="walkin-phone"
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="walkin-room">Assign room</label>
              <select
                id="walkin-room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
              >
                <option value="">Select an available room</option>
                {availableRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number} — {room.room_type} (GH₵{room.base_price}/night)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="walkin-checkin">Check-in date</label>
                <input
                  id="walkin-checkin"
                  type="date"
                  value={checkIn}
                  min={todayISO()}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (checkOut && checkOut <= e.target.value) {
                      setCheckOut('');
                    }
                  }}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="walkin-checkout">Check-out date</label>
                <input
                  id="walkin-checkout"
                  type="date"
                  value={checkOut}
                  min={checkIn || todayISO()}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="walkin-amount">Amount paid (GH₵)</label>
                <input
                  id="walkin-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Leave blank to auto-calculate"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="walkin-guests">Guest count</label>
                <select
                  id="walkin-guests"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={String(n)}>
                      {n} {n === 1 ? 'Guest' : 'Guests'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="walkin-notes">Special requests</label>
              <textarea
                id="walkin-notes"
                rows={3}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Creating booking…' : 'Confirm Walk-In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
