import wizardBodyHtml from './partials/booking-wizard-body.html?raw';
import { initBookingWizard } from './booking-wizard.js';

/**
 * @param {HTMLElement} container
 * @param {{ context?: 'page' | 'modal', onClose?: () => void }} [options]
 */
export function mountAndInitBookingWizard(container, options = {}) {
  if (!container) return null;

  if (container.__bookingWizard) {
    return container.__bookingWizard;
  }

  if (!container.dataset.wizardMounted) {
    container.innerHTML = wizardBodyHtml;
    container.dataset.wizardMounted = 'true';
  }

  container.__bookingWizard = initBookingWizard(container, options);
  return container.__bookingWizard;
}