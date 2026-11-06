import { mountAndInitBookingWizard } from './booking-wizard-mount.js';
import { sectionOf, track } from './analytics.js';
import {
  getBookingPaymentLockMessage,
  isBookingPaymentLocked,
} from './booking-payment-gate.js';

const dialog = document.querySelector('#booking-modal');
const mount = document.querySelector('#booking-modal-mount');
const closeBtn = document.querySelector('#booking-modal-close');
const lockNoticeId = 'booking-modal-lock-notice';

function showPaymentLockNotice() {
  let notice = document.querySelector(`#${lockNoticeId}`);
  if (!notice && dialog) {
    notice = document.createElement('p');
    notice.id = lockNoticeId;
    notice.className =
      'hidden text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mx-4 sm:mx-5 mt-2';
    notice.setAttribute('role', 'status');
    const header = dialog.querySelector('.border-b.border-slate-200');
    header?.insertAdjacentElement('afterend', notice);
  }
  if (notice) {
    notice.textContent = getBookingPaymentLockMessage();
    notice.classList.remove('hidden');
    window.setTimeout(() => notice.classList.add('hidden'), 4000);
  }
}

function tryCloseBookingModal() {
  if (isBookingPaymentLocked()) {
    showPaymentLockNotice();
    ensureBookingDialogOpen();
    return false;
  }
  return true;
}

function ensureBookingDialogOpen() {
  if (!dialog?.open && typeof dialog?.show === 'function') {
    dialog.show();
    document.body.classList.add('overflow-hidden', 'booking-modal-open');
  }
}

if (!dialog || !mount) {
  /* not on homepage */
} else {
  let wizardApi = null;

  function ensureWizard() {
    if (!wizardApi) {
      wizardApi = mountAndInitBookingWizard(mount, {
        context: 'modal',
        onClose: () => {
          if (!tryCloseBookingModal()) return;
          finishCloseBookingModal();
        },
      });
    }
  }

  // Build the booking popup while the page is idle, so the first "Book your care" tap opens it instantly
  // instead of building it on the tap (Third Modification speed pass).
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(ensureWizard, { timeout: 3000 });
  } else {
    window.setTimeout(ensureWizard, 1500);
  }

  function openBookingModal() {
    ensureWizard();
    if (typeof dialog.show === 'function') {
      dialog.show();
    } else if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    document.body.classList.add('overflow-hidden', 'booking-modal-open');
    mount.scrollTop = 0;
  }

  function finishCloseBookingModal() {
    if (dialog.open && wizardApi) {
      // Where people give up (or finish): the step the popup was on when closed.
      const step = wizardApi.currentStep();
      track('booking_closed', { ...wizardApi.bookingProps(), step, completed: step === 'done' });
    }
    if (dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    document.body.classList.remove('overflow-hidden', 'booking-modal-open');
    wizardApi?.reset();
  }

  function closeBookingModal() {
    if (!tryCloseBookingModal()) return;
    finishCloseBookingModal();
  }

  document.querySelectorAll('[data-open-booking]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openBookingModal();
      // "Our Care" cards open the booking already on their service (Second Modification).
      const service = trigger.dataset.bookService;
      track('book_opened', {
        from: sectionOf(trigger),
        label: (trigger.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
        service: service || '',
      });
      if (service && wizardApi?.startWith) {
        wizardApi.reset();
        wizardApi.startWith(service, { device: trigger.dataset.bookDevice });
      } else {
        wizardApi?.trackStep();
      }
    });
  });

  closeBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    closeBookingModal();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeBookingModal();
  });

  dialog.addEventListener('cancel', (event) => {
    if (isBookingPaymentLocked()) {
      event.preventDefault();
      showPaymentLockNotice();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !dialog?.open) return;
    if (isBookingPaymentLocked()) {
      event.preventDefault();
      showPaymentLockNotice();
      return;
    }
    closeBookingModal();
  });

  dialog.addEventListener('close', () => {
    document.body.classList.remove('overflow-hidden', 'booking-modal-open');
  });
}
