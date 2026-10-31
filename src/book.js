import { mountAndInitBookingWizard } from './booking-wizard-mount.js';

const root = document.querySelector('#booking-wizard-root');
if (root) {
  mountAndInitBookingWizard(root, { context: 'page' });
}
