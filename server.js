import express from 'express';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

dotenv.config();

const app = express();
const port = 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const fallbackFile = path.join(__dirname, 'data', 'bookings.json');

// ─── Neon connection ────────────────────────────────────────────────────────
const sql = neon(process.env.DATABASE_URL);

// ─── Fallback local store (when Neon is unreachable) ────────────────────────
async function ensureFallbackStore() {
  await mkdir(path.dirname(fallbackFile), { recursive: true });
  if (!existsSync(fallbackFile)) await writeFile(fallbackFile, '[]', 'utf8');
}

async function saveBookingFallback(booking) {
  await ensureFallbackStore();
  const raw   = await readFile(fallbackFile, 'utf8').catch(() => '[]');
  const items = JSON.parse(raw || '[]');
  items.push({ ...booking, stored_locally_at: new Date().toISOString() });
  await writeFile(fallbackFile, JSON.stringify(items, null, 2), 'utf8');
  return items;
}

function isConnectionError(err) {
  return /fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(err?.message || '');
}

await ensureFallbackStore();

// ─── Room type → room_id map (matches the actual rooms table in Neon) ───
const ROOM_ID_MAP = {
  single:      1,
  standard:    3,
  execstandard:5,
  execdouble:  6,
  twin:        5,
  mariam:      7,
  deluxe:      7,
  family:      8,
  executive:   8
};

// ─── Friendly room names for the confirmation email & DB ────────────────────
const ROOM_NAMES = {
  single:      'Single Room',
  standard:    'Standard Room',
  execstandard:'Executive Standard',
  execdouble:  'Executive Double',
  twin:        'Twin Room',
  mariam:      'Mariam Suite',
  deluxe:      'Deluxe',
  family:      'Family Suite',
  executive:   'Executive Suite'
};

function normalizeBookingStatus(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'pending':
    case 'pending_confirmation':
    case 'pending-confirmation':
      return 'pending_confirmation';
    case 'confirmed':
    case 'confirm':
      return 'confirmed';
    case 'checked_in':
    case 'checked-in':
    case 'checkin':
      return 'checked_in';
    case 'checked_out':
    case 'checked-out':
    case 'checkout':
      return 'checked_out';
    default:
      return 'pending_confirmation';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/stats  — Dashboard overview numbers
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/stats', async (req, res) => {
  try {
    const [active, checkIns, checkOuts, revenue] = await Promise.all([
      sql`SELECT COUNT(*) FROM bookings WHERE booking_status IN ('Confirmed', 'Checked In')`,
      sql`SELECT COUNT(*) FROM bookings WHERE check_in_date  = CURRENT_DATE`,
      sql`SELECT COUNT(*) FROM bookings WHERE check_out_date = CURRENT_DATE`,
      sql`SELECT COALESCE(SUM(total_amount), 0) AS total
          FROM bookings
          WHERE booking_status IN ('Confirmed', 'Checked In', 'Checked Out')
            AND DATE_TRUNC('month', check_in_date) = DATE_TRUNC('month', CURRENT_DATE)`
    ]);

    res.json({
      success: true,
      totalActiveBookings:  parseInt(active[0].count)     || 0,
      checkingInToday:      parseInt(checkIns[0].count)   || 0,
      checkingOutToday:     parseInt(checkOuts[0].count)  || 0,
      currentMonthRevenue:  parseFloat(revenue[0].total)  || 0
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/rooms  — Room grid for admin dashboard
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await sql`SELECT * FROM rooms ORDER BY room_number ASC`;
    res.json({ success: true, rooms });
  } catch (err) {
    console.error('Rooms error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/bookings  — All bookings for admin dashboard
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await sql`
      SELECT
        b.*,
        r.room_number,
        r.room_type,
        r.price_per_night
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      ORDER BY b.created_at DESC
    `;
    res.json({ success: true, bookings });
  } catch (err) {
    console.error('Bookings error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/bookings  — Create a new booking from the hotel website
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      guest_name,
      guest_email,
      guest_phone,
      room_id,
      room_name,        // friendly name sent from frontend
      check_in_date,
      check_out_date,
      total_amount,
      booking_status,
      status,
      guest_count,
      special_requests
    } = req.body;

    // ── Sanitise inputs ──────────────────────────────────────────────────────
    const safeGuest   = (guest_name   || '').trim() || 'Guest';
    const safeEmail   = (guest_email  || '').trim() || 'guest@example.com';
    const safePhone   = (guest_phone  || '').trim() || 'Not provided';
    const safeCheckIn = (check_in_date  || '').trim();
    const safeCheckOut= (check_out_date || '').trim();
    const safeAmount  = parseFloat(total_amount) || 0;
    const safeStatus  = normalizeBookingStatus(booking_status ?? status ?? 'Pending');
    const safeGuests  = parseInt(guest_count) || 1;
    const safeRequests= (special_requests || 'None').trim();

    // ── Resolve room_id ──────────────────────────────────────────────────────
    let safeRoomId = null;
    const rawRoomKey = String(room_id || '').trim().toLowerCase();

    if (rawRoomKey === '' || rawRoomKey === 'unknown' || rawRoomKey === 'null' || rawRoomKey === 'undefined') {
      safeRoomId = null;
    } else if (/^\d+$/.test(rawRoomKey)) {
      safeRoomId = parseInt(rawRoomKey, 10);
    } else {
      safeRoomId = ROOM_ID_MAP[rawRoomKey] || null;
    }

    if (safeRoomId !== null && (!Number.isInteger(safeRoomId) || safeRoomId <= 0)) {
      safeRoomId = null;
    }

    // Resolve friendly room name
    const safeRoomName = (String(room_name || '')).trim()
      || ROOM_NAMES[rawRoomKey]
      || (safeRoomId ? ROOM_NAMES[Object.keys(ROOM_NAMES).find((key) => ROOM_ID_MAP[key] === safeRoomId)] : null)
      || null;

    // If still no room_id, try a live DB lookup by room_type name
    if (!safeRoomId && safeRoomName) {
      try {
        const [found] = await sql`
          SELECT id FROM rooms
          WHERE LOWER(room_type) = LOWER(${safeRoomName})
          LIMIT 1
        `;
        if (found?.id) safeRoomId = parseInt(found.id, 10);
      } catch {
        // DB lookup failed — proceed without room_id
      }
    }

    // ── Validate ─────────────────────────────────────────────────────────────
    if (!safeCheckIn || !safeCheckOut) {
      return res.status(400).json({ success: false, error: 'Check-in and check-out dates are required.' });
    }
    if (safeAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Total amount must be greater than zero.' });
    }

    // ── Insert into Neon ─────────────────────────────────────────────────────
    // Use two separate queries so room_id never reaches Postgres as a string
    try {
      let booking;

      if (Number.isInteger(safeRoomId) && safeRoomId > 0) {
        // We have a valid integer room_id — include it
        [booking] = await sql`
          INSERT INTO bookings (
            guest_name, guest_email, guest_phone,
            room_id, room_name,
            check_in_date, check_out_date,
            total_amount, booking_status,
            guest_count, special_requests
          ) VALUES (
            ${safeGuest}, ${safeEmail}, ${safePhone},
            ${safeRoomId}, ${safeRoomName},
            ${safeCheckIn}, ${safeCheckOut},
            ${safeAmount}, ${safeStatus},
            ${safeGuests}, ${safeRequests}
          )
          RETURNING *
        `;
      } else {
        // No valid room_id — omit the column entirely, save room_name as text
        [booking] = await sql`
          INSERT INTO bookings (
            guest_name, guest_email, guest_phone,
            room_name,
            check_in_date, check_out_date,
            total_amount, booking_status,
            guest_count, special_requests
          ) VALUES (
            ${safeGuest}, ${safeEmail}, ${safePhone},
            ${safeRoomName},
            ${safeCheckIn}, ${safeCheckOut},
            ${safeAmount}, ${safeStatus},
            ${safeGuests}, ${safeRequests}
          )
          RETURNING *
        `;
      }

      console.log(`✅ Booking saved — ${safeGuest} | ${safeRoomName || 'room #' + safeRoomId} | ${safeCheckIn} → ${safeCheckOut}`);


      return res.json({
        success: true,
        message: 'Booking submitted successfully!',
        booking
      });

    } catch (dbErr) {
      // ── Fallback to local JSON if Neon is unreachable ─────────────────────
      if (isConnectionError(dbErr)) {
        const fallback = {
          guest_name:       safeGuest,
          guest_email:      safeEmail,
          guest_phone:      safePhone,
          room_id:          safeRoomId,
          room_name:        safeRoomName,
          check_in_date:    safeCheckIn,
          check_out_date:   safeCheckOut,
          total_amount:     safeAmount,
          booking_status:   safeStatus,
          guest_count:      safeGuests,
          special_requests: safeRequests
        };
        await saveBookingFallback(fallback);
        console.warn('⚠️  Neon unreachable — booking saved locally:', fallback);
        return res.json({
          success: true,
          message: 'Booking received and stored locally (database temporarily unavailable).',
          booking: fallback,
          stored_locally: true
        });
      }

      // Real DB error — surface it clearly
      console.error('DB insert error:', dbErr.message);
      throw dbErr;
    }

  } catch (err) {
    console.error('Booking endpoint error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PATCH /api/rooms/:id/status  — Toggle room status (admin)
// ══════════════════════════════════════════════════════════════════════════════
app.patch('/api/rooms/:id/status', async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const allowed = ['Available', 'Occupied', 'Under Maintenance'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: `Status must be one of: ${allowed.join(', ')}` });
    }

    const [room] = await sql`
      UPDATE rooms SET status = ${status} WHERE id = ${id} RETURNING *
    `;
    if (!room) return res.status(404).json({ success: false, error: 'Room not found.' });

    res.json({ success: true, room });
  } catch (err) {
    console.error('Room status error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PATCH /api/bookings/:id/status  — Update booking status (check in / out)
// ══════════════════════════════════════════════════════════════════════════════
app.patch('/api/bookings/:id/status', async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;
    console.log('📦 Incoming booking payload:', JSON.stringify(req.body, null, 2));

    const safeStatus = normalizeBookingStatus(status);
    const allowed = ['pending_confirmation', 'confirmed', 'checked_in', 'checked_out'];
    if (!allowed.includes(safeStatus)) {
      return res.status(400).json({ success: false, error: `Status must be one of: ${allowed.join(', ')}` });
    }

    const [booking] = await sql`
      UPDATE bookings SET booking_status = ${safeStatus} WHERE id = ${id} RETURNING *
    `;
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });

    // Auto-update linked room status when guest checks in / out
    if (booking.room_id) {
      if (safeStatus === 'checked_in') {
        await sql`UPDATE rooms SET status = 'Occupied'  WHERE id = ${booking.room_id}`;
      } else if (safeStatus === 'checked_out') {
        await sql`UPDATE rooms SET status = 'Available' WHERE id = ${booking.room_id}`;
      }
    }

    res.json({ success: true, booking });
  } catch (err) {
    console.error('Booking status error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Only run app.listen if we are running locally, otherwise export the app instance for Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`🔌 Secure Neon API Bridge active on http://localhost:${port}`);
  });
}

export default app;