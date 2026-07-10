import { useMemo } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { filterBookings } from '../../lib/api/bookings';
import { formatDate, formatGHS } from '../../lib/api/dashboard';
import { BOOKING_STATUS_LABELS } from '../../types/database';
import type { BookingStatus, BookingWithRoom } from '../../types/database';
import { StatusBadge, EmptyState } from '../ui/StatusBadge';
import { BookingFiltersBar } from './BookingFilters';

/** Single booking row with check-in / check-out actions. */
function BookingRow({ booking }: { booking: BookingWithRoom }) {
  const { handleCheckIn, handleCheckOut, actionLoadingId } = useAdmin();
  const isLoading = actionLoadingId === booking.id;

  const canCheckIn =
    booking.status === 'confirmed' || booking.status === 'pending_confirmation';
  const canCheckOut = booking.status === 'checked_in';

  return (
    <tr>
      <td>
        <span className="table-guest">{booking.guest_name}</span>
        {booking.is_walk_in && (
          <span className="badge badge--confirmed" style={{ marginLeft: 8 }}>
            Walk-in
          </span>
        )}
      </td>
      <td>
        <span className="table-guest">{booking.rooms?.room_number ?? '—'}</span>
        <br />
        <span className="table-room">{booking.rooms?.room_type ?? 'Unassigned'}</span>
      </td>
      <td>{formatDate(booking.check_in_date)}</td>
      <td>{formatDate(booking.check_out_date)}</td>
      <td>{formatGHS(booking.amount_paid)}</td>
      <td>
        <StatusBadge
          variant={booking.status}
          label={BOOKING_STATUS_LABELS[booking.status]}
        />
      </td>
      <td>
        <div className="table-actions">
          {canCheckIn && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleCheckIn(booking)}
              disabled={isLoading}
            >
              Check In
            </button>
          )}
          {canCheckOut && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleCheckOut(booking)}
              disabled={isLoading}
            >
              Check Out
            </button>
          )}
          {!canCheckIn && !canCheckOut && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>
          )}
        </div>
      </td>
    </tr>
  );
}

const STATUS_OPTIONS: Array<{ value: BookingStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_confirmation', label: BOOKING_STATUS_LABELS.pending_confirmation },
  { value: 'confirmed', label: BOOKING_STATUS_LABELS.confirmed },
  { value: 'checked_in', label: BOOKING_STATUS_LABELS.checked_in },
  { value: 'checked_out', label: BOOKING_STATUS_LABELS.checked_out },
];

/** Filterable reservations table with guest actions. */
export function BookingsList() {
  const { bookings, bookingsLoading, bookingFilters, setBookingFilters, setWalkInOpen } =
    useAdmin();

  const filtered = useMemo(
    () => filterBookings(bookings, bookingFilters),
    [bookings, bookingFilters]
  );

  if (bookingsLoading) {
    return (
      <div aria-busy="true" aria-label="Loading bookings">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </div>
    );
  }

  return (
    <>
      <BookingFiltersBar
        filters={bookingFilters}
        statusOptions={STATUS_OPTIONS}
        onChange={setBookingFilters}
        resultCount={filtered.length}
        totalCount={bookings.length}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={bookings.length === 0 ? 'No reservations yet' : 'No matching reservations'}
          description={
            bookings.length === 0
              ? 'Guest bookings from the website will appear here in real time once Supabase is connected.'
              : 'Try adjusting your search or filter criteria to find the reservation you need.'
          }
          action={
            bookings.length === 0 ? (
              <button type="button" className="btn btn-primary" onClick={() => setWalkInOpen(true)}>
                Register Walk-In Guest
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Guest Name</th>
                <th scope="col">Room</th>
                <th scope="col">Check-in</th>
                <th scope="col">Check-out</th>
                <th scope="col">Amount Paid</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((booking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
