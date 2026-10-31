/** Shared lock + fallback UI when Razorpay outlives the booking modal. */

let paymentLocked = false;
let lockMessage =
  'Payment in progress. Complete or cancel checkout in Razorpay before closing this window.';

/** @param {boolean} active @param {string} [message] */
export function setBookingPaymentLock(active, message) {
  paymentLocked = active;
  if (message) lockMessage = message;
  document.body.classList.toggle('booking-payment-locked', active);
}

export function isBookingPaymentLocked() {
  return paymentLocked;
}

export function getBookingPaymentLockMessage() {
  return lockMessage;
}

/**
 * @param {{ bookingKey?: string, customerName?: string }} details
 */
export function showPaymentReceivedNotice(details = {}) {
  const existing = document.querySelector('#booking-payment-received-notice');
  existing?.remove();

  const key = details.bookingKey?.trim();
  const name = details.customerName?.trim();
  const keyLine = key
    ? `Reference: ${key.length > 24 ? `${key.slice(0, 22)}…` : key}`
    : 'Your visit fee is recorded.';

  const notice = document.createElement('div');
  notice.id = 'booking-payment-received-notice';
  notice.setAttribute('role', 'status');
  notice.className = 'booking-payment-received-notice';
  notice.innerHTML = `
    <div class="booking-payment-received-notice__inner">
      <p class="booking-payment-received-notice__title">Payment received — you’re all set.</p>
      <p class="booking-payment-received-notice__body">${name ? `${name} · ` : ''}${keyLine} We’ll confirm your visit by phone or WhatsApp.</p>
      <div class="booking-payment-received-notice__actions">
        <a href="https://wa.me/917010481012" class="booking-payment-received-notice__wa">WhatsApp us</a>
        <button type="button" class="booking-payment-received-notice__dismiss">Dismiss</button>
      </div>
    </div>`;

  notice.querySelector('.booking-payment-received-notice__dismiss')?.addEventListener('click', () => {
    notice.remove();
  });

  document.body.appendChild(notice);
}
