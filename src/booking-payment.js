import { formatInr, getVisitFee } from './book-service-config.js';
import { createVisitFeeOrder, verifyVisitFeePayment } from './booking-submit.js';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

function loadRazorpayCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.dataset.razorpayCheckout = '1';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Could not load payment gateway'));
    document.head.appendChild(script);
  });
}

function getBookingDialog(root) {
  return root.closest('#booking-modal') || document.querySelector('#booking-modal');
}

/** HTML dialog top-layer sits above Razorpay; hide it while Checkout is open. */
function prepareCheckoutLayer(root) {
  document.body.classList.add('razorpay-checkout-active');
  const dialog = getBookingDialog(root);
  const wasOpen = Boolean(dialog?.open);
  if (wasOpen) {
    dialog.close();
  }
  return { dialog, wasOpen };
}

function restoreCheckoutLayer(root, state) {
  document.body.classList.remove('razorpay-checkout-active');
  if (state?.wasOpen && state.dialog && !state.dialog.open) {
    state.dialog.showModal();
  }
}

/**
 * @param {HTMLElement} root
 * @param {{ getContext: () => { payload: Record<string, string | undefined>, bookingKey: string } }} hooks
 */
export function initVisitFeePayment(root, hooks) {
  const q = (sel) => root.querySelector(sel);
  const block = q('#booking-payment-block');
  const payService = q('#booking-pay-service');
  const payAmount = q('#booking-pay-amount');
  const feeHint = q('#booking-visit-fee-hint');
  const payBtn = q('#pay-visit-fee');
  const doneEl = q('#booking-payment-done');
  const errEl = q('#booking-payment-error');

  if (!block || !payBtn) return;

  let checkoutLayerState = null;

  const showPayError = (message) => {
    if (!errEl) return;
    errEl.textContent = message;
    errEl.classList.remove('hidden');
  };

  const resetPayUi = () => {
    if (doneEl) doneEl.classList.add('hidden');
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }
    payBtn.classList.remove('hidden');
    payBtn.disabled = false;
    feeHint?.classList.remove('hidden');
    const heading = root.querySelector('#booking-success-heading');
    if (heading) heading.textContent = 'Booking saved';
  };

  payBtn.addEventListener('click', async () => {
    const { payload, bookingKey } = hooks.getContext();
    const fee = getVisitFee(payload.service, payload.device);
    if (!fee) return;

    if (!RAZORPAY_KEY_ID?.trim()) {
      showPayError('Online payment is not configured yet. We’ll confirm on WhatsApp.');
      return;
    }
    if (!bookingKey) {
      showPayError('Missing booking reference. WhatsApp us and we’ll help.');
      return;
    }

    payBtn.disabled = true;
    const defaultLabel = payBtn.textContent;
    payBtn.textContent = 'Opening secure checkout…';
    if (errEl) errEl.classList.add('hidden');

    const orderResult = await createVisitFeeOrder({
      service: payload.service,
      device: payload.device,
      bookingKey,
    });

    if (!orderResult.ok) {
      showPayError(orderResult.message);
      payBtn.disabled = false;
      payBtn.textContent = defaultLabel;
      return;
    }

    let Razorpay;
    try {
      Razorpay = await loadRazorpayCheckout();
    } catch {
      showPayError('Could not load payment. Check your connection and try again.');
      payBtn.disabled = false;
      payBtn.textContent = defaultLabel;
      return;
    }

    payBtn.textContent = defaultLabel;
    payBtn.disabled = false;

    checkoutLayerState = prepareCheckoutLayer(root);

    const rzp = new Razorpay({
      key: RAZORPAY_KEY_ID.trim(),
      amount: orderResult.amountPaise,
      currency: orderResult.currency,
      name: 'The Computer Care Company',
      description: fee.label,
      order_id: orderResult.orderId,
      prefill: {
        name: payload.name || '',
        email: payload.email || '',
        contact: payload.phone || '',
      },
      theme: { color: '#2563eb' },
      handler: async (response) => {
        restoreCheckoutLayer(root, checkoutLayerState);
        checkoutLayerState = null;

        payBtn.disabled = true;
        payBtn.textContent = 'Confirming…';
        const verified = await verifyVisitFeePayment({
          bookingKey,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        if (!verified.ok) {
          showPayError(verified.message);
          payBtn.disabled = false;
          payBtn.textContent = defaultLabel;
          return;
        }
        if (doneEl) doneEl.classList.remove('hidden');
        payBtn.classList.add('hidden');
        feeHint?.classList.add('hidden');
        const heading = root.querySelector('#booking-success-heading');
        if (heading) heading.textContent = 'Paid & confirmed';
      },
      modal: {
        ondismiss: () => {
          restoreCheckoutLayer(root, checkoutLayerState);
          checkoutLayerState = null;
          payBtn.disabled = false;
          payBtn.textContent = defaultLabel;
        },
      },
    });

    rzp.on('payment.failed', (event) => {
      restoreCheckoutLayer(root, checkoutLayerState);
      checkoutLayerState = null;
      const reason = event.error?.description || event.error?.reason || 'Payment failed';
      showPayError(reason);
      payBtn.disabled = false;
      payBtn.textContent = defaultLabel;
    });

    rzp.open();
  });

  return {
    refresh(payload, bookingKey) {
      const fee = getVisitFee(payload.service, payload.device);
      resetPayUi();

      if (!fee || fee.amountInr <= 0) {
        block.classList.add('hidden');
        return;
      }

      block.classList.remove('hidden');
      if (payService) payService.textContent = payload.service || 'On-site visit';
      if (payAmount) payAmount.textContent = formatInr(fee.amountInr);
      payBtn.textContent = `Pay ${formatInr(fee.amountInr)} securely`;
    },
  };
}
