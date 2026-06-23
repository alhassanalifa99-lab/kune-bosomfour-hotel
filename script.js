document.addEventListener('DOMContentLoaded', () => {

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

  // Contact form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = document.getElementById('form-status');
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const message = document.getElementById('message').value.trim();
      if (!name || !email || !message) {
        status.textContent = 'Please fill in all required fields.';
        status.style.color = 'var(--terracotta)';
        return;
      }
      status.textContent = `Thank you, ${name}. We'll be in touch within 24 hours.`;
      status.style.color = 'var(--gold-soft)';
      contactForm.reset();
    });
  }

  // Booking form
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    const checkin  = document.getElementById('checkin');
    const checkout = document.getElementById('checkout');
    const roomType = document.getElementById('room-type');
    const guests   = document.getElementById('guests');
    const summary  = document.getElementById('booking-summary');
    const summaryRows = document.getElementById('summary-rows');
    const status   = document.getElementById('form-status');

    const rates = {
      regular: 650, double: 950, triple: 1250,
      vip: 1950, vvip: 2950, presidential: 4200
    };

    const roomNames = {
      regular: 'Regular Room', double: 'Double Room', triple: 'Triple Room',
      vip: 'VIP Room', vvip: 'VVIP Room', presidential: 'Presidential Suite'
    };

    // Set min dates
    const today = new Date().toISOString().split('T')[0];
    checkin.min = today;
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
        summary.style.display = 'none';
        return;
      }
      const nights = Math.round(
        (new Date(checkout.value) - new Date(checkin.value)) / (1000 * 60 * 60 * 24)
      );
      if (nights < 1) { summary.style.display = 'none'; return; }

      const rate = rates[roomType.value] || 0;
      const total = rate * nights;
      const room = roomNames[roomType.value] || roomType.value;

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

    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      status.style.color = 'var(--terracotta)';

      const name  = document.getElementById('guest-name').value.trim();
      const email = document.getElementById('guest-email').value.trim();

      if (!name || !email) {
        status.textContent = 'Please enter your name and email address.';
        return;
      }
      if (!checkin.value || !checkout.value) {
        status.textContent = 'Please select your check-in and check-out dates.';
        return;
      }
      if (checkout.value <= checkin.value) {
        status.textContent = 'Check-out must be after check-in.';
        return;
      }
      if (!roomType.value) {
        status.textContent = 'Please select a room type.';
        return;
      }

      // Success — in production this would POST to a backend or email service
      status.style.color = 'var(--gold-soft)';
      const nights = Math.round(
        (new Date(checkout.value) - new Date(checkin.value)) / (1000 * 60 * 60 * 24)
      );
      status.textContent = `Thank you, ${name}! Your reservation request for ${nights} night${nights > 1 ? 's' : ''} has been received. We'll confirm to ${email} within 24 hours.`;
      bookingForm.reset();
      summary.style.display = 'none';
    });
  }

});