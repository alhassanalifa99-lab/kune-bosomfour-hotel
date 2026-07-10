-- ============================================================
-- Mariam Hotel — Supabase Database Schema
-- Run this in the Supabase SQL Editor for your project.
-- ============================================================

-- Custom enum types for room and booking lifecycle
CREATE TYPE room_status AS ENUM ('available', 'occupied', 'maintenance');
CREATE TYPE booking_status AS ENUM (
  'pending_confirmation',
  'confirmed',
  'checked_in',
  'checked_out'
);

-- Staff profiles linked to Supabase Auth users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Physical hotel rooms inventory
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL,
  base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
  status room_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guest reservations (online or walk-in)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status booking_status NOT NULL DEFAULT 'pending_confirmation',
  is_walk_in BOOLEAN NOT NULL DEFAULT FALSE,
  guest_count INTEGER NOT NULL DEFAULT 1 CHECK (guest_count >= 1),
  special_requests TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_stay_dates CHECK (check_out_date > check_in_date)
);

-- Indexes for common admin queries
CREATE INDEX idx_bookings_check_in ON bookings(check_in_date);
CREATE INDEX idx_bookings_check_out ON bookings(check_out_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_room_id ON bookings(room_id);
CREATE INDEX idx_rooms_status ON rooms(status);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- Authenticated staff can read/write; public can insert bookings
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Profiles: staff read own profile; admins read all
CREATE POLICY "Staff can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Staff can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Rooms: authenticated staff full access; public read for booking page
CREATE POLICY "Anyone can view available rooms"
  ON rooms FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Staff can manage rooms"
  ON rooms FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

-- Bookings: public can create; staff manage all
CREATE POLICY "Anyone can create a booking"
  ON bookings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Staff can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

-- Allow anon read for realtime on bookings (optional — restrict in production)
CREATE POLICY "Anon can read bookings for realtime"
  ON bookings FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- Realtime: enable live updates on rooms and bookings
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- ============================================================
-- Seed data — Mariam Hotel room inventory
-- ============================================================

INSERT INTO rooms (room_number, room_type, base_price, status) VALUES
  ('101', 'Single Room', 600.00, 'available'),
  ('102', 'Single Room', 600.00, 'available'),
  ('201', 'Standard Room', 670.00, 'available'),
  ('202', 'Standard Room', 670.00, 'available'),
  ('203', 'Standard Room', 670.00, 'available'),
  ('301', 'Executive Standard', 725.00, 'available'),
  ('302', 'Executive Standard', 725.00, 'available'),
  ('401', 'Executive Double', 790.00, 'available'),
  ('402', 'Executive Double', 790.00, 'available'),
  ('501', 'Twin Room', 1000.00, 'available'),
  ('502', 'Twin Room', 1000.00, 'available'),
  ('601', 'Mariam Suite', 1100.00, 'available'),
  ('701', 'Deluxe', 1150.00, 'available'),
  ('702', 'Deluxe', 1150.00, 'available'),
  ('801', 'Family Suite', 1450.00, 'available'),
  ('901', 'Executive Suite', 2400.00, 'available');

-- Sample bookings for dashboard demo (remove in production if undesired)
INSERT INTO bookings (room_id, guest_name, guest_email, guest_phone, check_in_date, check_out_date, amount_paid, status, guest_count)
SELECT
  r.id,
  'Kwame Asante',
  'kwame.asante@email.com',
  '+233 24 123 4567',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '3 days',
  2010.00,
  'confirmed',
  2
FROM rooms r WHERE r.room_number = '201';

INSERT INTO bookings (room_id, guest_name, guest_email, check_in_date, check_out_date, amount_paid, status, guest_count)
SELECT
  r.id,
  'Ama Osei',
  'ama.osei@email.com',
  CURRENT_DATE + INTERVAL '1 day',
  CURRENT_DATE + INTERVAL '4 days',
  3450.00,
  'pending_confirmation',
  2
FROM rooms r WHERE r.room_number = '701';

INSERT INTO bookings (room_id, guest_name, guest_email, check_in_date, check_out_date, amount_paid, status, guest_count, is_walk_in)
SELECT
  r.id,
  'Ibrahim Mohammed',
  'ibrahim.m@email.com',
  CURRENT_DATE - INTERVAL '2 days',
  CURRENT_DATE,
  1580.00,
  'checked_in',
  1
FROM rooms r WHERE r.room_number = '101';

UPDATE rooms SET status = 'occupied' WHERE room_number = '101';
