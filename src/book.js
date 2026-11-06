import { mountAndInitBookingWizard } from './booking-wizard-mount.js';
import { track } from './analytics.js';

const root = document.querySelector('#booking-wizard-root');
if (root) {
  const wizard = mountAndInitBookingWizard(root, { context: 'page' });
  // /book?service=…&device=… (homepage "Our Care" cards opened in a new tab) starts on that service.
  const params = new URLSearchParams(window.location.search);
  const service = params.get('service');
  track('book_opened', { from: 'book page', service: service || '' });
  if (service && wizard?.startWith) {
    wizard.startWith(service, { device: params.get('device') || '' });
  } else {
    wizard?.trackStep?.();
  }
}
