import { mountAndInitBookingWizard } from './booking-wizard-mount.js';

const dialog = document.querySelector('#booking-modal');
const mount = document.querySelector('#booking-modal-mount');
const closeBtn = document.querySelector('#booking-modal-close');

if (!dialog || !mount) {
  /* not on homepage */
} else {
  let wizardApi = null;

  function openBookingModal() {
    if (!wizardApi) {
      wizardApi = mountAndInitBookingWizard(mount, {
        context: 'modal',
        onClose: closeBookingModal,
      });
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    document.body.classList.add('overflow-hidden');
    mount.scrollTop = 0;
  }

  function closeBookingModal() {
    if (dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    document.body.classList.remove('overflow-hidden');
    wizardApi?.reset();
  }

  document.querySelectorAll('[data-open-booking]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openBookingModal();
    });
  });

  closeBtn?.addEventListener('click', closeBookingModal);

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeBookingModal();
  });

  dialog.addEventListener('close', () => {
    document.body.classList.remove('overflow-hidden');
  });
}
