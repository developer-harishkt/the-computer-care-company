import { PAYMENT_PAGE } from './booking-payment-copy.js';

const MODAL_HEADERS = {
  booking: { title: 'Book your visit', subtitle: 'On-site service · Chennai' },
  'saved-unpaid': {
    title: 'Complete your booking',
    subtitle: 'Pay the visit fee to confirm',
  },
  paid: { title: 'Booking confirmed', subtitle: 'On-site service · Chennai' },
  received: {
    title: 'Booking received',
    subtitle: 'We’ll confirm your visit by phone or WhatsApp',
  },
};

/** @param {HTMLElement} root @param {keyof typeof MODAL_HEADERS} variant */
function applyModalBookingHeader(root, variant) {
  const dialog = root.closest('#booking-modal');
  if (!dialog) return;
  const cfg = MODAL_HEADERS[variant] || MODAL_HEADERS.booking;
  const titleEl = dialog.querySelector('#booking-modal-title');
  const subtitleEl = dialog.querySelector('#booking-modal-subtitle');
  if (titleEl) titleEl.textContent = cfg.title;
  if (subtitleEl) subtitleEl.textContent = cfg.subtitle;
}

function formatSummaryDate(iso) {
  const raw = String(iso || '').trim();
  if (!raw) return '—';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = parseInt(match[3], 10);
  const month = months[parseInt(match[2], 10) - 1];
  return `${day} ${month} ${match[1]}`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {HTMLElement} summaryEl #booking-success-summary
 * @param {Record<string, string | undefined>} payload
 * @param {{ showDevice?: boolean }} [options]
 */
export function populateBookingSummary(summaryEl, payload, options = {}) {
  if (!summaryEl) return;
  const rows = [{ label: 'Service', value: payload.service }];
  if (options.showDevice !== false && payload.device) {
    rows.push({ label: 'Device', value: payload.device });
  }
  rows.push(
    { label: 'Date', value: formatSummaryDate(payload.date) },
    { label: 'Time', value: payload.time || '—' },
    { label: 'Name', value: payload.name },
  );
  if (payload.landmark?.trim()) {
    rows.push({ label: 'Area / landmark', value: payload.landmark.trim() });
  }

  summaryEl.innerHTML = rows
    .filter((row) => row.value)
    .map(
      (row) => `
    <div class="booking-success-summary__row">
      <dt class="booking-success-summary__label">${row.label}</dt>
      <dd class="booking-success-summary__value">${escapeHtml(String(row.value))}</dd>
    </div>`,
    )
    .join('');
}

/** @param {HTMLElement} root @param {'unpaid' | 'paid' | 'no-fee'} state */
export function setBookingSuccessPayState(root, state) {
  root.dataset.payState = state;
}

/** @param {HTMLElement} root */
export function resetBookingSuccessPanelUi(root) {
  const q = (sel) => root.querySelector(sel);
  setBookingSuccessPayState(root, 'unpaid');
  q('#booking-success-paid-hero')?.classList.add('hidden');
  q('#booking-success-reference-wrap')?.classList.add('hidden');
  q('#booking-success-next-wrap')?.classList.add('hidden');
  q('#booking-trust-longer-life')?.classList.add('hidden');
  q('#booking-success-consent')?.classList.remove('hidden');
  q('#booking-success-page-title')?.classList.remove('hidden');
}

/**
 * @param {HTMLElement} root
 * @param {string} bookingKey
 */
export function setBookingSuccessPaidPanel(root, bookingKey) {
  const q = (sel) => root.querySelector(sel);
  setBookingSuccessPayState(root, 'paid');
  q('#booking-success-page-title')?.classList.add('hidden');
  q('#booking-success-paid-hero')?.classList.remove('hidden');
  q('#booking-success-reference-wrap')?.classList.remove('hidden');
  q('#booking-success-next-wrap')?.classList.remove('hidden');
  q('#booking-trust-longer-life')?.classList.remove('hidden');
  q('#booking-success-consent')?.classList.add('hidden');
  q('#booking-payment-block')?.classList.add('hidden');

  const heading = q('#booking-success-heading');
  if (heading) heading.textContent = 'Booking confirmed';

  const refEl = q('#booking-success-reference');
  if (refEl && bookingKey) refEl.textContent = bookingKey;

  const longer = q('#booking-trust-longer-life');
  if (longer) longer.textContent = PAYMENT_PAGE.longerLifePaid;
}

/** @param {HTMLElement} root */
export function setBookingSuccessReceivedPanel(root) {
  const q = (sel) => root.querySelector(sel);
  setBookingSuccessPayState(root, 'no-fee');
  q('#booking-success-page-title')?.classList.add('hidden');
  q('#booking-success-paid-hero')?.classList.remove('hidden');
  q('#booking-success-reference-wrap')?.classList.add('hidden');
  q('#booking-success-next-wrap')?.classList.remove('hidden');
  q('#booking-trust-longer-life')?.classList.add('hidden');
  q('#booking-success-consent')?.classList.add('hidden');
  const heading = q('#booking-success-heading');
  if (heading) heading.textContent = 'Booking received';
}

/** Fill success panel copy (once per wizard mount). */
export function initBookingSuccessCopy(root) {
  const q = (sel) => root.querySelector(sel);

  const intro = q('#booking-success-intro');
  const tagline = q('#booking-success-tagline');
  const visitTitle = q('#booking-trust-visit-title');
  const visitBody = q('#booking-trust-visit-body');
  const warrantyTitle = q('#booking-trust-warranty-title');
  const warrantyBody = q('#booking-trust-warranty-body');
  const terms = q('#booking-success-terms');
  const contact = q('#booking-success-contact');
  const razorpayHint = q('#booking-razorpay-hint');
  const feeHint = q('#booking-visit-fee-hint');
  const consent = q('#booking-success-consent');
  const nextSteps = q('#booking-success-next-steps');

  if (intro) intro.textContent = '';
  if (tagline) tagline.textContent = '';
  if (visitTitle) visitTitle.textContent = PAYMENT_PAGE.visitAssessment.title;
  if (visitBody) visitBody.textContent = PAYMENT_PAGE.visitAssessment.body;
  if (warrantyTitle) warrantyTitle.textContent = PAYMENT_PAGE.warranty.title;
  if (warrantyBody) warrantyBody.textContent = PAYMENT_PAGE.warranty.body;
  if (terms) terms.textContent = PAYMENT_PAGE.termsFull;
  if (feeHint) feeHint.textContent = PAYMENT_PAGE.visitFeeHint;
  if (razorpayHint) razorpayHint.textContent = PAYMENT_PAGE.razorpayHint;

  if (consent) {
    const prefix = 'By paying you agree to our ';
    const suffix = ' (10% charge applies to cancellations after payment).';
    consent.innerHTML = `${prefix}<a href="/terms#cancellations" class="text-blue-700 font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Terms and Cancellation Policy</a>${suffix}`;
  }

  if (nextSteps) {
    nextSteps.innerHTML = PAYMENT_PAGE.nextSteps.map((line) => `<li>${line}</li>`).join('');
  }

  if (contact) {
    const { email, phone, phoneTel, whatsApp } = PAYMENT_PAGE.contact;
    contact.innerHTML = `Need help? <a href="tel:${phoneTel}" class="text-blue-700 font-semibold hover:underline">${phone}</a> · <a href="mailto:${email}" class="text-blue-700 font-semibold hover:underline">Email</a> · <a href="https://wa.me/${whatsApp}" class="text-blue-700 font-semibold hover:underline">WhatsApp</a>`;
  }

  q('#booking-copy-reference')?.addEventListener('click', async () => {
    const ref = q('#booking-success-reference')?.textContent?.trim();
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(ref);
      const btn = q('#booking-copy-reference');
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = 'Copied';
        window.setTimeout(() => {
          btn.textContent = prev;
        }, 2000);
      }
    } catch {
      /* clipboard unavailable */
    }
  });
}

/**
 * @param {HTMLElement} root
 * @param {boolean} active
 * @param {{ headerVariant?: keyof typeof MODAL_HEADERS }} [options]
 */
export function setBookingSuccessPhase(root, active, options = {}) {
  root.dataset.phase = active ? 'success' : 'booking';
  if (!active) {
    delete root.dataset.payState;
  }
  const dialog = root.closest('#booking-modal');
  dialog?.classList.toggle('booking-modal--success', active);
  root.querySelector('#wizard-progress-wrap')?.classList.toggle('hidden', active);
  root.querySelector('#book-form')?.classList.toggle('hidden', active);
  applyModalBookingHeader(
    root,
    active ? options.headerVariant || 'saved-unpaid' : 'booking',
  );
}

/** @param {HTMLElement} root */
export function setModalBookingHeaderPaid(root) {
  applyModalBookingHeader(root, 'paid');
}

export { MODAL_HEADERS };
