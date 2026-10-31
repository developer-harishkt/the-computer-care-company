import { PAYMENT_PAGE } from './booking-payment-copy.js';

/** Fill success panel trust copy (once per wizard mount). */
export function initBookingSuccessCopy(root) {
  const q = (sel) => root.querySelector(sel);

  const tagline = q('#booking-success-tagline');
  const intro = q('#booking-success-intro');
  const visitTitle = q('#booking-trust-visit-title');
  const visitBody = q('#booking-trust-visit-body');
  const warrantyTitle = q('#booking-trust-warranty-title');
  const warrantyBody = q('#booking-trust-warranty-body');
  const longerLife = q('#booking-trust-longer-life');
  const terms = q('#booking-success-terms');
  const contact = q('#booking-success-contact');
  const razorpayHint = q('#booking-razorpay-hint');

  if (tagline) tagline.textContent = PAYMENT_PAGE.tagline;
  if (intro) intro.textContent = PAYMENT_PAGE.intro;
  if (visitTitle) visitTitle.textContent = PAYMENT_PAGE.visitAssessment.title;
  if (visitBody) visitBody.textContent = PAYMENT_PAGE.visitAssessment.body;
  if (warrantyTitle) warrantyTitle.textContent = PAYMENT_PAGE.warranty.title;
  if (warrantyBody) warrantyBody.textContent = PAYMENT_PAGE.warranty.body;
  if (longerLife) longerLife.textContent = PAYMENT_PAGE.longerLife;
  if (terms) terms.textContent = PAYMENT_PAGE.terms;
  if (razorpayHint && PAYMENT_PAGE.razorpayHint) {
    razorpayHint.textContent = PAYMENT_PAGE.razorpayHint;
    razorpayHint.classList.remove('hidden');
  }
  if (contact) {
    const assist = PAYMENT_PAGE.contact.assist
      ? `<span class="block mt-1">${PAYMENT_PAGE.contact.assist}</span>`
      : '';
    contact.innerHTML = `
      <a href="mailto:${PAYMENT_PAGE.contact.email}" class="text-blue-700 hover:underline">${PAYMENT_PAGE.contact.email}</a>
      · <a href="https://wa.me/917010481012" class="text-blue-700 hover:underline">${PAYMENT_PAGE.contact.phone}</a>
      · ${PAYMENT_PAGE.contact.area}${assist}`;
  }
}

export function setBookingSuccessPhase(root, active) {
  root.dataset.phase = active ? 'success' : 'booking';
  const dialog = root.closest('#booking-modal');
  dialog?.classList.toggle('booking-modal--success', active);
  root.querySelector('#wizard-progress-wrap')?.classList.toggle('hidden', active);
  root.querySelector('#book-form')?.classList.toggle('hidden', active);
}
