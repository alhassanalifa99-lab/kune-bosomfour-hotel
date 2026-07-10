const postgres = require('postgres');

function getFirstValue(payload, keys) {
  if (!payload || typeof payload !== 'object') return '';

  const candidates = [];

  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && `${payload[key]}`.trim() !== '') {
      candidates.push(`${payload[key]}`.trim());
    }
  }

  if (candidates.length > 0) return candidates[0];

  const nested = payload.fields || payload.data || payload.form || payload.body;
  if (nested && typeof nested === 'object') {
    for (const key of keys) {
      const value = nested[key] ?? nested[key.toLowerCase()] ?? nested[key.toUpperCase()];
      if (value !== undefined && value !== null && `${value}`.trim() !== '') {
        return `${value}`.trim();
      }
    }
  }

  return '';
}

async function resolveRoomId(sql, requestedRoomType, requestedRoomId) {
  if (requestedRoomId && requestedRoomId.trim()) {
    return requestedRoomId.trim();
  }

  const roomType = requestedRoomType?.trim();
  if (roomType) {
    const matchingRooms = await sql`
      SELECT id
      FROM rooms
      WHERE room_type ILIKE ${`%${roomType}%`}
      ORDER BY room_number ASC
      LIMIT 1
    `;

    if (matchingRooms[0]?.id) {
      return matchingRooms[0].id;
    }
  }

  const fallbackRooms = await sql`
    SELECT id
    FROM rooms
    WHERE status = 'available'
    ORDER BY room_number ASC
    LIMIT 1
  `;

  if (fallbackRooms[0]?.id) {
    return fallbackRooms[0].id;
  }

  throw new Error('No available room found for this booking.');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ ok: false, error: 'DATABASE_URL is not configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    const guestName = getFirstValue(body, ['Guest Name', 'guest_name', 'name', 'fullName']);
    const guestEmail = getFirstValue(body, ['Guest Email', 'guest_email', 'email']);
    const guestPhone = getFirstValue(body, ['Guest Phone', 'guest_phone', 'phone']);
    const checkInDate = getFirstValue(body, ['Check In', 'Check-in', 'check_in', 'checkin', 'check_in_date']);
    const checkOutDate = getFirstValue(body, ['Check Out', 'Check-out', 'check_out', 'checkout', 'check_out_date']);
    const roomType = getFirstValue(body, ['Room Type', 'room_type', 'roomType', 'Room']);
    const roomIdValue = getFirstValue(body, ['Room ID', 'room_id', 'roomId']);
    const amountPaid = getFirstValue(body, ['Amount Paid', 'amount_paid', 'amount', 'total']) || '0';
    const guestCount = getFirstValue(body, ['Guest Count', 'guest_count', 'guests']) || '1';
    const specialRequests = getFirstValue(body, ['Special Requests', 'special_requests', 'notes', 'message']) || null;

    if (!guestName || !checkInDate || !checkOutDate) {
      return res.status(400).json({ ok: false, error: 'Missing required booking details' });
    }

    const sql = postgres(process.env.DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });

    try {
      const resolvedRoomId = await resolveRoomId(sql, roomType, roomIdValue);
      const parsedAmount = Number(amountPaid) || 0;
      const parsedGuestCount = Math.max(1, Number(guestCount) || 1);

      await sql`
        INSERT INTO bookings (
          room_id,
          guest_name,
          guest_email,
          guest_phone,
          check_in_date,
          check_out_date,
          amount_paid,
          status,
          is_walk_in,
          guest_count,
          special_requests,
          created_at,
          updated_at
        ) VALUES (
          ${resolvedRoomId},
          ${guestName},
          ${guestEmail || null},
          ${guestPhone || null},
          ${checkInDate},
          ${checkOutDate},
          ${parsedAmount},
          'pending_confirmation',
          false,
          ${parsedGuestCount},
          ${specialRequests},
          NOW(),
          NOW()
        )
      `;

      return res.status(200).json({ ok: true, message: 'Booking received and saved' });
    } finally {
      await sql.end();
    }
  } catch (error) {
    console.error('Formspree webhook error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to save booking' });
  }
};
