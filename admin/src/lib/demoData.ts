import type { BookingWithRoom, Room } from '../types/database';

/** Demo room inventory — used when Supabase credentials are not configured. */
export const DEMO_ROOMS: Room[] = [
  { id: 'r-101', room_number: '101', room_type: 'Single Room', base_price: 600, status: 'occupied', created_at: '', updated_at: '' },
  { id: 'r-102', room_number: '102', room_type: 'Single Room', base_price: 600, status: 'available', created_at: '', updated_at: '' },
  { id: 'r-201', room_number: '201', room_type: 'Standard Room', base_price: 670, status: 'available', created_at: '', updated_at: '' },
  { id: 'r-202', room_number: '202', room_type: 'Standard Room', base_price: 670, status: 'available', created_at: '', updated_at: '' },
  { id: 'r-301', room_number: '301', room_type: 'Executive Standard', base_price: 725, status: 'available', created_at: '', updated_at: '' },
  { id: 'r-401', room_number: '401', room_type: 'Executive Double', base_price: 790, status: 'maintenance', created_at: '', updated_at: '' },
  { id: 'r-501', room_number: '501', room_type: 'Twin Room', base_price: 1000, status: 'available', created_at: '', updated_at: '' },
  { id: 'r-601', room_number: '601', room_type: 'Mariam Suite', base_price: 1100, status: 'available', created_at: '', updated_at: '' },
  { id: 'r-701', room_number: '701', room_type: 'Deluxe', base_price: 1150, status: 'available', created_at: '', updated_at: '' },
  { id: 'r-801', room_number: '801', room_type: 'Family Suite', base_price: 1450, status: 'available', created_at: '', updated_at: '' },
  { id: 'r-901', room_number: '901', room_type: 'Executive Suite', base_price: 2400, status: 'available', created_at: '', updated_at: '' },
];

const today = new Date();
const iso = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

/** Demo bookings with joined room references for local preview. */
export const DEMO_BOOKINGS: BookingWithRoom[] = [
  {
    id: 'b-1',
    room_id: 'r-201',
    guest_name: 'Kwame Asante',
    guest_email: 'kwame.asante@email.com',
    guest_phone: '+233 24 123 4567',
    check_in_date: iso(0),
    check_out_date: iso(3),
    amount_paid: 2010,
    status: 'confirmed',
    is_walk_in: false,
    guest_count: 2,
    special_requests: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rooms: { id: 'r-201', room_number: '201', room_type: 'Standard Room' },
  },
  {
    id: 'b-2',
    room_id: 'r-701',
    guest_name: 'Ama Osei',
    guest_email: 'ama.osei@email.com',
    guest_phone: null,
    check_in_date: iso(1),
    check_out_date: iso(4),
    amount_paid: 3450,
    status: 'pending_confirmation',
    is_walk_in: false,
    guest_count: 2,
    special_requests: 'Late check-in after 20:00',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rooms: { id: 'r-701', room_number: '701', room_type: 'Deluxe' },
  },
  {
    id: 'b-3',
    room_id: 'r-101',
    guest_name: 'Ibrahim Mohammed',
    guest_email: 'ibrahim.m@email.com',
    guest_phone: '+233 55 987 6543',
    check_in_date: iso(-2),
    check_out_date: iso(0),
    amount_paid: 1580,
    status: 'checked_in',
    is_walk_in: true,
    guest_count: 1,
    special_requests: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rooms: { id: 'r-101', room_number: '101', room_type: 'Single Room' },
  },
  {
    id: 'b-4',
    room_id: 'r-901',
    guest_name: 'Efua Mensah',
    guest_email: 'efua.mensah@email.com',
    guest_phone: '+233 20 555 1234',
    check_in_date: iso(-5),
    check_out_date: iso(-1),
    amount_paid: 9600,
    status: 'checked_out',
    is_walk_in: false,
    guest_count: 4,
    special_requests: 'Airport pickup arranged',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rooms: { id: 'r-901', room_number: '901', room_type: 'Executive Suite' },
  },
];
