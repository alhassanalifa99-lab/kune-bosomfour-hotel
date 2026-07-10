import type { BookingFilters, BookingStatus } from '../../types/database';

interface BookingFiltersBarProps {
  filters: BookingFilters;
  statusOptions: Array<{ value: BookingStatus | 'all'; label: string }>;
  onChange: (partial: Partial<BookingFilters>) => void;
  resultCount: number;
  totalCount: number;
}

/** Search and filter controls for the bookings table. */
export function BookingFiltersBar({
  filters,
  statusOptions,
  onChange,
  resultCount,
  totalCount,
}: BookingFiltersBarProps) {
  return (
    <div className="filters-bar" role="search">
      <div className="field field-grow">
        <label htmlFor="booking-search">Search guests or rooms</label>
        <input
          id="booking-search"
          type="search"
          placeholder="Search by guest name, email, or room…"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="booking-status">Status</label>
        <select
          id="booking-status"
          value={filters.status}
          onChange={(e) =>
            onChange({ status: e.target.value as BookingStatus | 'all' })
          }
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="date-from">From</label>
        <input
          id="date-from"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ dateFrom: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="date-to">To</label>
        <input
          id="date-to"
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange({ dateTo: e.target.value })}
        />
      </div>

      <p style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
        Showing <strong style={{ color: 'var(--text-primary)' }}>{resultCount}</strong> of{' '}
        {totalCount} reservations
      </p>
    </div>
  );
}
