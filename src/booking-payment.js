import { formatInr, getVisitFee } from './book-service-config.js';
import { createVisitFeeOrder, verifyVisitFeePayment } from './booking-submit.js';
import { setModalBookingHeaderPaid, setBookingSuccessPaidPanel } from './booking-success-ui.js';
import {
  getBookingPaymentLockMessage,
  setBookingPaymentLock,
  showPaymentReceivedNotice,
} from './booking-payment-gate.js';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;
const CHECKOUT_CLOSE_SETTLE_MS = 750;
/** Ignore Razorpay modal.ondismiss briefly after open (spurious dismiss breaks iframe load). */
const CHECKOUT_OPEN_DISMISS_GRACE_MS = 900;

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

function prepareCheckoutLayer(_root) {
  document.body.classList.add('razorpay-checkout-active');
}

function restoreCheckoutLayer(_root) {
  document.body.classList.remove('razorpay-checkout-active');
}

function shouldShowStandalonePaymentNotice(root) {
  const successPanel = root.querySelector('#booking-success');
  const inSuccessPhase = root.dataset.phase === 'success';
  const successVisible =
    successPanel && !successPanel.classList.contains('hidden');
  /* Inline success + payment-done is enough; banner is only if that UI isn’t visible. */
  if (inSuccessPhase && successVisible) return false;
  return true;
}

function applyPaidSuccessUi(root, payload, bookingKey) {
  const q = (sel) => root.querySelector(sel);
  const doneEl = q('#booking-payment-done');
  const errEl = q('#booking-payment-error');
  const payBtn = q('#pay-visit-fee');
  const feeHint = q('#booking-visit-fee-hint');
  const razorpayHint = q('#booking-razorpay-hint');

  const setPayActionVisible = (visible) => {
    payBtn?.classList.toggle('hidden', !visible);
    feeHint?.classList.toggle('hidden', !visible);
    if (razorpayHint?.textContent?.trim()) {
      razorpayHint.classList.toggle('hidden', !visible);
    }
    root.querySelector('#booking-success-consent')?.classList.toggle('hidden', !visible);
  };

  if (doneEl) doneEl.classList.add('hidden');
  setPayActionVisible(false);
  if (errEl) errEl.classList.add('hidden');
  setModalBookingHeaderPaid(root);
  setBookingSuccessPaidPanel(root, bookingKey);

  if (shouldShowStandalonePaymentNotice(root)) {
    showPaymentReceivedNotice({
      bookingKey,
      customerName: payload.name,
    });
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
  const razorpayHint = q('#booking-razorpay-hint');

  if (!block || !payBtn) return;

  const setPayActionVisible = (visible) => {
    payBtn.classList.toggle('hidden', !visible);
    feeHint?.classList.toggle('hidden', !visible);
    if (razorpayHint?.textContent?.trim()) {
      razorpayHint.classList.toggle('hidden', !visible);
    }
    root.querySelector('#booking-success-consent')?.classList.toggle('hidden', !visible);
  };

  let activeCheckout = null;
  let checkoutSession = 0;
  let openCheckoutSessionId = null;
  let payFlowActive = false;
  /** @type {Set<number>} */
  const endedCheckoutSessions = new Set();
  /** @type {Map<number, string>} */
  const sessionFailureMessages = new Map();
  /** @type {Map<number, () => void>} */
  const sessionCloseWaiters = new Map();
  /** @type {Promise<void>} */
  let checkoutQuiescent = Promise.resolve();
  /** @type {Map<number, number>} session → rzp.open() timestamp */
  const checkoutOpenedAt = new Map();

  const isSessionLive = (session) =>
    !endedCheckoutSessions.has(session) && session === checkoutSession;

  const waitForCheckoutQuiescent = () => checkoutQuiescent;

  const markSessionSettling = (session) => {
    checkoutQuiescent = new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        sessionCloseWaiters.delete(session);
        resolve();
      }, CHECKOUT_CLOSE_SETTLE_MS);
      sessionCloseWaiters.set(session, () => {
        window.clearTimeout(timeout);
        sessionCloseWaiters.delete(session);
        resolve();
      });
    });
  };

  const shouldIgnoreDismiss = (session) => {
    const opened = checkoutOpenedAt.get(session);
    if (!opened) return false;
    return Date.now() - opened < CHECKOUT_OPEN_DISMISS_GRACE_MS;
  };

  const notifySessionSettled = (session) => {
    sessionCloseWaiters.get(session)?.();
  };

  const showPayError = (message) => {
    if (!errEl) return;
    const textEl = errEl.querySelector('.booking-success-pay-alert__text');
    if (textEl) textEl.textContent = message;
    else errEl.textContent = message;
    errEl.classList.remove('hidden');
  };

  const releasePayAttempt = (defaultLabel) => {
    payFlowActive = false;
    payBtn.disabled = false;
    if (defaultLabel) payBtn.textContent = defaultLabel;
    setPayActionVisible(true);
    restoreCheckoutLayer(root);
    setBookingPaymentLock(false);
  };

  const resetPayUi = () => {
    if (doneEl) doneEl.classList.add('hidden');
    if (errEl) {
      errEl.classList.add('hidden');
      const textEl = errEl.querySelector('.booking-success-pay-alert__text');
      if (textEl) textEl.textContent = '';
    }
    payBtn.disabled = false;
    setPayActionVisible(true);
    const heading = root.querySelector('#booking-success-heading');
    if (heading) heading.textContent = 'Booking saved';
  };

  /**
   * Close one Razorpay instance for a session. Never closes a newer session's instance.
   * @param {number} session
   * @param {{ instance?: object, awaitSettle?: boolean }} [options]
   */
  const closeCheckoutForSession = async (session, { instance, awaitSettle = true } = {}) => {
    if (endedCheckoutSessions.has(session)) {
      if (awaitSettle) await waitForCheckoutQuiescent();
      return;
    }

    const target =
      instance ||
      (activeCheckout?.session === session ? activeCheckout.instance : null);
    if (!target) {
      if (awaitSettle) await waitForCheckoutQuiescent();
      return;
    }

    if (activeCheckout?.session === session) {
      activeCheckout = null;
    }

    markSessionSettling(session);
    try {
      target.close();
    } catch {
      notifySessionSettled(session);
    }

    if (awaitSettle) {
      await waitForCheckoutQuiescent();
    }
  };

  const completeCheckoutSession = (
    session,
    { message, success = false, restoreDialog = true } = {},
  ) => {
    if (endedCheckoutSessions.has(session)) {
      notifySessionSettled(session);
      return;
    }
    if (openCheckoutSessionId !== null && openCheckoutSessionId !== session) return;
    if (session !== checkoutSession) return;

    endedCheckoutSessions.add(session);
    checkoutSession += 1;

    if (openCheckoutSessionId === session) {
      openCheckoutSessionId = null;
    }

    if (activeCheckout?.session === session) {
      activeCheckout = null;
    }

    const failureFromEvent = sessionFailureMessages.get(session);
    sessionFailureMessages.delete(session);
    const errorMessage = failureFromEvent || message;

    if (restoreDialog) {
      void waitForCheckoutQuiescent().then(() => {
        restoreCheckoutLayer(root);
        setBookingPaymentLock(false);
      });
    } else {
      setBookingPaymentLock(false);
    }

    payFlowActive = false;
    payBtn.disabled = false;
    notifySessionSettled(session);
    checkoutOpenedAt.delete(session);

    if (success) return;

    if (errorMessage) showPayError(errorMessage);
  };

  payBtn.addEventListener('click', async () => {
    if (payFlowActive) return;

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
    payFlowActive = true;
    setBookingPaymentLock(true, 'Opening secure checkout…');
    const defaultLabel = payBtn.textContent;
    payBtn.textContent = 'Opening secure checkout…';
    if (errEl) errEl.classList.add('hidden');

    await waitForCheckoutQuiescent();
    if (activeCheckout) {
      await closeCheckoutForSession(activeCheckout.session, {
        instance: activeCheckout.instance,
      });
    }

    const session = ++checkoutSession;

    let orderResult;
    try {
      orderResult = await createVisitFeeOrder({
        service: payload.service,
        device: payload.device,
        bookingKey,
      });
    } catch {
      releasePayAttempt(defaultLabel);
      showPayError('Could not start payment. Try again or pay when we call.');
      return;
    }

    if (!isSessionLive(session)) {
      releasePayAttempt(defaultLabel);
      return;
    }

    if (!orderResult.ok) {
      completeCheckoutSession(session, { message: orderResult.message });
      payBtn.textContent = defaultLabel;
      setPayActionVisible(true);
      return;
    }

    let Razorpay;
    try {
      Razorpay = await loadRazorpayCheckout();
    } catch {
      completeCheckoutSession(session, {
        message: 'Could not load payment. Check your connection and try again.',
      });
      payBtn.textContent = defaultLabel;
      setPayActionVisible(true);
      return;
    }

    if (!isSessionLive(session)) {
      releasePayAttempt(defaultLabel);
      return;
    }

    await waitForCheckoutQuiescent();

    payBtn.textContent = defaultLabel;
    prepareCheckoutLayer(root);

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
        if (!isSessionLive(session)) return;
        if (openCheckoutSessionId !== null && openCheckoutSessionId !== session) return;

        endedCheckoutSessions.add(session);
        checkoutSession += 1;
        sessionFailureMessages.delete(session);
        openCheckoutSessionId = null;
        activeCheckout = null;

        try {
          rzp.close();
        } catch {
          /* ignore */
        }

        restoreCheckoutLayer(root);
        notifySessionSettled(session);

        payBtn.disabled = true;
        payFlowActive = true;
        payBtn.textContent = 'Confirming…';
        setBookingPaymentLock(
          true,
          'Confirming payment — please don’t close this page.',
        );

        const verified = await verifyVisitFeePayment({
          bookingKey,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });

        payFlowActive = false;
        setBookingPaymentLock(false);

        if (!verified.ok) {
          showPayError(verified.message);
          payBtn.disabled = false;
          payBtn.textContent = defaultLabel;
          setPayActionVisible(true);
          return;
        }

        applyPaidSuccessUi(root, payload, bookingKey);
        payBtn.disabled = false;
      },
      modal: {
        ondismiss: () => {
          if (shouldIgnoreDismiss(session)) return;
          if (endedCheckoutSessions.has(session)) {
            notifySessionSettled(session);
            return;
          }
          if (openCheckoutSessionId !== null && openCheckoutSessionId !== session) return;
          if (session !== checkoutSession) return;

          completeCheckoutSession(session, {
            message:
              sessionFailureMessages.get(session) ||
              'Payment cancelled. You can tap Pay again when ready.',
          });
          payBtn.textContent = defaultLabel;
          setPayActionVisible(true);
        },
      },
    });

    activeCheckout = { instance: rzp, session };
    openCheckoutSessionId = session;
    setBookingPaymentLock(
      true,
      'Complete payment in Razorpay. You can return here when finished.',
    );

    rzp.on('payment.failed', (event) => {
      if (endedCheckoutSessions.has(session)) return;
      if (openCheckoutSessionId !== null && openCheckoutSessionId !== session) return;
      if (session !== checkoutSession) return;

      const reason =
        event.error?.description ||
        event.error?.reason ||
        'Payment failed. Try again or pay when we call.';

      sessionFailureMessages.set(session, reason);
      /* Stay in the same checkout session so a retry in Razorpay can still run handler. */
    });

    rzp.open();
    checkoutOpenedAt.set(session, Date.now());
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

export { getBookingPaymentLockMessage, isBookingPaymentLocked } from './booking-payment-gate.js';
