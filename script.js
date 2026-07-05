document.addEventListener('DOMContentLoaded', () => {

  // Initialise EmailJS
  emailjs.init('k8OZoohO9UmeZxieT');

  // Mobile nav toggle
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('click', (e) => {
      if (!navToggle.contains(e.target) && !mainNav.contains(e.target)) {
        mainNav.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Contact form — sends to Formspree
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status  = document.getElementById('form-status');
      const name    = document.getElementById('name').value.trim();
      const email   = document.getElementById('email').value.trim();
      const message = document.getElementById('message').value.trim();

      if (!name || !email || !message) {
        status.textContent = 'Please fill in all required fields.';
        status.style.color = 'var(--terracotta)';
        return;
      }

      status.textContent = 'Sending…';
      status.style.color = 'var(--gold-soft)';

      try {
        const res = await fetch('https://formspree.io/f/xaqgvygj', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, email, message,
            subject: document.getElementById('subject')?.value || 'General enquiry',
            _subject: `Mariam Hotel Enquiry from ${name}`
          })
        });
        if (res.ok) {
          status.textContent = `Thank you, ${name}. We'll be in touch within 24 hours.`;
          contactForm.reset();
        } else { throw new Error(); }
      } catch {
        status.style.color = 'var(--terracotta)';
        status.textContent = 'Something went wrong. Please call us on +233 55 809 1276.';
      }
    });
  }

  // Booking form — Formspree (hotel copy) + EmailJS (guest confirmation)
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    const checkin     = document.getElementById('checkin');
    const checkout    = document.getElementById('checkout');
    const roomType    = document.getElementById('room-type');
    const guests      = document.getElementById('guests');
    const summary     = document.getElementById('booking-summary');
    const summaryRows = document.getElementById('summary-rows');
    const status      = document.getElementById('form-status');

    const rates = {
      single: 600, standard: 670, execstandard: 725,
      execdouble: 790, twin: 1000, mariam: 1100,
      deluxe: 1150, family: 1450, executive: 2400
    };

    const roomNames = {
      single: 'Single Room', standard: 'Standard Room',
      execstandard: 'Executive Standard', execdouble: 'Executive Double',
      twin: 'Twin Room', mariam: 'Mariam Suite',
      deluxe: 'Deluxe', family: 'Family Suite', executive: 'Executive Suite'
    };

    const today = new Date().toISOString().split('T')[0];
    checkin.min  = today;
    checkout.min = today;

    checkin.addEventListener('change', () => {
      if (checkin.value) {
        const next = new Date(checkin.value);
        next.setDate(next.getDate() + 1);
        checkout.min = next.toISOString().split('T')[0];
        if (checkout.value && checkout.value <= checkin.value) {
          checkout.value = checkout.min;
        }
      }
      updateSummary();
    });

    checkout.addEventListener('change', updateSummary);
    roomType.addEventListener('change', updateSummary);
    guests.addEventListener('change', updateSummary);

    function updateSummary() {
      if (!checkin.value || !checkout.value || !roomType.value) {
        summary.style.display = 'none'; return;
      }
      const nights = Math.round(
        (new Date(checkout.value) - new Date(checkin.value)) / (1000 * 60 * 60 * 24)
      );
      if (nights < 1) { summary.style.display = 'none'; return; }

      const rate  = rates[roomType.value] || 0;
      const total = rate * nights;
      const room  = roomNames[roomType.value] || roomType.value;

      summaryRows.innerHTML = `
        <div class="summary-row"><span>Room</span><strong>${room}</strong></div>
        <div class="summary-row"><span>Check-in</span><strong>${formatDate(checkin.value)}</strong></div>
        <div class="summary-row"><span>Check-out</span><strong>${formatDate(checkout.value)}</strong></div>
        <div class="summary-row"><span>Nights</span><strong>${nights}</strong></div>
        <div class="summary-row"><span>Guests</span><strong>${guests.value}</strong></div>
        <div class="summary-row"><span>Rate</span><strong>₵${rate.toLocaleString()} / night</strong></div>
        <div class="summary-row"><span>Total estimate</span><strong>₵${total.toLocaleString()}</strong></div>
      `;
      summary.style.display = 'block';
    }

    function formatDate(dateStr) {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GH', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
    }

    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.style.color = 'var(--terracotta)';

      const name    = document.getElementById('guest-name').value.trim();
      const email   = document.getElementById('guest-email').value.trim();
      const phone   = document.getElementById('guest-phone').value.trim();
      const special = document.getElementById('special-requests').value.trim();

      if (!name || !email) {
        status.textContent = 'Please enter your name and email address.'; return;
      }
      if (!checkin.value || !checkout.value) {
        status.textContent = 'Please select your check-in and check-out dates.'; return;
      }
      if (checkout.value <= checkin.value) {
        status.textContent = 'Check-out must be after check-in.'; return;
      }
      if (!roomType.value) {
        status.textContent = 'Please select a room type.'; return;
      }

      const nights = Math.round(
        (new Date(checkout.value) - new Date(checkin.value)) / (1000 * 60 * 60 * 24)
      );
      const rate  = rates[roomType.value] || 0;
      const total = rate * nights;
      const room  = roomNames[roomType.value];

      status.textContent = 'Submitting your reservation…';
      status.style.color = 'var(--gold-soft)';

      try {
        // 1 — Send booking details to hotel via Formspree
        const formRes = await fetch('https://formspree.io/f/xaqgvygj', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _subject:           `New Booking — ${room} — ${name}`,
            'Guest Name':       name,
            'Guest Email':      email,
            'Guest Phone':      phone || 'Not provided',
            'Room Type':        room,
            'Check-in':         formatDate(checkin.value),
            'Check-out':        formatDate(checkout.value),
            'Nights':           nights,
            'Guests':           guests.value,
            'Rate per Night':   `₵${rate.toLocaleString()}`,
            'Total Estimate':   `₵${total.toLocaleString()}`,
            'Special Requests': special || 'None'
          })
        });
        if (!formRes.ok) throw new Error('Formspree failed');

        // 2 — Send confirmation email to guest via EmailJS
        await emailjs.send('service_om2fcka', 'template_3w1mfbl', {
          guest_name:  name,
          guest_email: email,
          room_type:   room,
          checkin:     formatDate(checkin.value),
          checkout:    formatDate(checkout.value),
          nights:      nights,
          guests:      guests.value,
          total:       `₵${total.toLocaleString()}`,
          phone:       phone || 'Not provided',
          special:     special || 'None'
        });

        // Both succeeded
        status.style.color = 'var(--gold-soft)';
        status.textContent = `Booking received! Thank you, ${name}. A confirmation has been sent to ${email}. We'll confirm within 24 hours.`;
        bookingForm.reset();
        summary.style.display = 'none';

      } catch (err) {
        status.style.color = 'var(--terracotta)';
        status.textContent = 'Something went wrong. Please call us on +233 55 809 1276 to complete your booking.';
      }
    });
  }

});