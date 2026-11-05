/**
 * Subscriptions page: "Enquire on WhatsApp" asks for contact details first, saves the enquiry to the
 * bookings sheet (same webhook as the booking wizard), then continues on WhatsApp (Second Modification).
 * The buttons stay real WhatsApp links, so they still work if this script fails to load.
 */
import { normalizeIndianMobile, validateBookingDetails, validateEmail, validateName } from './booking-form-validation.js';
import { attachLiveValidation, clearFieldError, eagerPhone, setFieldError } from './live-validation.js';
import { submitBookingToSheet } from './booking-submit.js';
import { whatsAppUrl } from './book-service-config.js';

const REDIRECT_DELAY_MS = 2500;

const dialog = document.querySelector('#plan-enquiry');
const form = document.querySelector('#plan-enquiry-form');
const title = document.querySelector('#plan-enquiry-title');
const errorEl = document.querySelector('#plan-enquiry-error');
const doneEl = document.querySelector('#plan-enquiry-done');
const submitBtn = document.querySelector('#plan-enquiry-submit');
const cancelBtn = document.querySelector('#plan-enquiry-cancel');
const fieldIds = ['plan-name', 'plan-phone', 'plan-email'];
/** validateBookingDetails reports the wizard's field ids; map them to this popup's fields. */
const WIZARD_TO_POPUP_FIELD = { 'full-name': 'plan-name', phone: 'plan-phone', email: 'plan-email' };
const SUBMIT_LABEL = 'Send & continue on WhatsApp';

let plan = '';
let redirectTimer = null;

function field(id) {
  return document.querySelector(`#${id}`);
}

function showError(message, fieldId) {
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
  const el = fieldId ? field(fieldId) : null;
  if (el) {
    setFieldError(el, message);
    el.focus();
  }
}

function clearError() {
  errorEl?.classList.add('hidden');
  fieldIds.forEach((id) => clearFieldError(field(id)));
}

function openFor(planName) {
  plan = planName;
  clearTimeout(redirectTimer);
  clearError();
  doneEl?.classList.add('hidden');
  if (title) title.textContent = planName;
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = SUBMIT_LABEL;
  }
  dialog.showModal();
  field('plan-name')?.focus();
}

function close() {
  clearTimeout(redirectTimer);
  dialog.close();
}

if (dialog && form) {
  document.querySelectorAll('[data-plan-enquire]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openFor(link.dataset.planEnquire || 'Care plan');
    });
  });

  cancelBtn?.addEventListener('click', close);
  // Clicking the dimmed backdrop closes the popup.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => clearTimeout(redirectTimer));

  // Each field is checked as soon as it is touched (Third Modification); same rules as Send.
  attachLiveValidation(
    [
      { el: field('plan-name'), validate: validateName },
      {
        el: field('plan-phone'),
        validate: (v) => {
          const result = normalizeIndianMobile(v);
          return result.ok ? null : result.message;
        },
        eager: eagerPhone,
      },
      { el: field('plan-email'), validate: validateEmail },
    ],
    {
      skipBlurFrom: '#plan-enquiry-cancel',
      onChange: (_el, message) => {
        if (!message) errorEl?.classList.add('hidden');
      },
    },
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    // Same rules as the booking wizard's contact step (no address for an enquiry).
    const details = validateBookingDetails(
      {
        name: field('plan-name')?.value,
        phone: field('plan-phone')?.value,
        email: field('plan-email')?.value,
        address: '',
        landmark: '',
        notes: '',
      },
      { requireAddress: false },
    );
    if (!details.ok) {
      showError(details.message, WIZARD_TO_POPUP_FIELD[details.fieldId]);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    const { name, phone, email } = details.normalized;
    const result = await submitBookingToSheet(
      {
        service: 'Subscriptions',
        device: 'Subscription plan',
        date: '',
        time: '',
        name,
        phone,
        email,
        address: '',
        landmark: '',
        notes: plan,
      },
      { onSlow: () => { submitBtn.textContent = 'Still sending…'; } },
    );

    if (!result.ok) {
      submitBtn.disabled = false;
      submitBtn.textContent = SUBMIT_LABEL;
      showError(result.message || 'Could not send. Please try again or WhatsApp us.');
      return;
    }

    const url = whatsAppUrl(`Hi, I just sent an enquiry for the ${plan} on your website (name: ${name}). Let's discuss.`);
    if (doneEl) {
      doneEl.innerHTML = `Request received. Taking you to WhatsApp&hellip; <a href="${url}" class="underline font-semibold">Go now</a>`;
      doneEl.classList.remove('hidden');
    }
    submitBtn.textContent = 'Request received';
    // Same-tab navigation: a new tab opened after the network request would be blocked as a pop-up.
    redirectTimer = setTimeout(() => window.location.assign(url), REDIRECT_DELAY_MS);
  });
}
