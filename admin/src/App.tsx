import { AdminProvider, useAdmin } from './context/AdminContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { RoomManagement } from './components/rooms/RoomManagement';
import { BookingsList } from './components/bookings/BookingsList';
import { WalkInModal } from './components/bookings/WalkInModal';

function AdminApp() {
  const { section, error, clearError } = useAdmin();

  return (
    <AdminLayout>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {section === 'dashboard' && <DashboardOverview />}
      {section === 'rooms' && <RoomManagement />}
      {section === 'bookings' && <BookingsList />}

      <WalkInModal />
    </AdminLayout>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <AdminApp />
    </AdminProvider>
  );
}
