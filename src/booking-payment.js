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
/** After Razorpay reports success: retry server confirmation at these delays before showing "payment received". */
const VERIFY_RETRY_DELAYS_MS = [3000, 8000];
/** One more silent confirmation attempt in the background after giving up in the UI. */
const VERIFY_BACKGROUND_RETRY_MS = 30000;

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

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
    root.querySelector('#booking-pay-skip-note')?.classList.toggle('hidden', !visible);
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
  const pendingEl = q('#booking-payment-pending');
  const errEl = q('#booking-payment-error');
  const razorpayHint = q('#booking-razorpay-hint');

  if (!block || !payBtn) return;

  /**
   * Bookings Razorpay reported as paid but our server has not confirmed yet.
   * Pay stays blocked for these so a customer is never asked to pay twice.
   * @type {Set<string>}
   */
  const paidAwaitingConfirmation = new Set();

  const setPayActionVisible = (visible) => {
    payBtn.classList.toggle('hidden', !visible);
    feeHint?.classList.toggle('hidden', !visible);
    root.querySelector('#booking-pay-skip-note')?.classList.toggle('hidden', !visible);
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

  /** Paid in Razorpay, but our server did not confirm: reassure, block Pay, point to WhatsApp. */
  const showPaidAwaitingConfirmation = (paymentId) => {
    if (errEl) errEl.classList.add('hidden');
    setPayActionVisible(false);
    payBtn.disabled = true;
    if (pendingEl) {
      const id = paymentId ? ` (payment ID ${paymentId})` : '';
      pendingEl.textContent = `Payment received${id}. Please don’t pay again — we’re confirming it and will confirm your visit on WhatsApp.`;
      pendingEl.classList.remove('hidden');
    }
  };

  const resetPayUi = () => {
    if (doneEl) doneEl.classList.add('hidden');
    if (pendingEl) pendingEl.classList.add('hidden');
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
    if (paidAwaitingConfirmation.has(bookingKey)) return;
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

    if (orderResult.alreadyPaid) {
      // Server says this booking is already paid: never open a second checkout.
      releasePayAttempt(defaultLabel);
      applyPaidSuccessUi(root, payload, bookingKey);
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

        // Razorpay has taken the money at this point. Never offer "Pay" again for this booking.
        paidAwaitingConfirmation.add(bookingKey);
        const verifyParams = {
          bookingKey,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        };

        let verified = await verifyVisitFeePayment(verifyParams);
        for (const delay of VERIFY_RETRY_DELAYS_MS) {
          if (verified.ok) break;
          await sleep(delay);
          verified = await verifyVisitFeePayment(verifyParams);
        }

        payFlowActive = false;
        setBookingPaymentLock(false);

        if (!verified.ok) {
          showPaidAwaitingConfirmation(response.razorpay_payment_id);
          window.setTimeout(async () => {
            const retry = await verifyVisitFeePayment(verifyParams);
            if (retry.ok && paidAwaitingConfirmation.has(bookingKey)) {
              paidAwaitingConfirmation.delete(bookingKey);
              pendingEl?.classList.add('hidden');
              applyPaidSuccessUi(root, payload, bookingKey);
            }
          }, VERIFY_BACKGROUND_RETRY_MS);
          return;
        }

        paidAwaitingConfirmation.delete(bookingKey);
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
    /** Booking was already paid (server said so on submit): show the paid state, no Pay button. */
    markAlreadyPaid(payload, bookingKey) {
      block.classList.remove('hidden');
      applyPaidSuccessUi(root, payload, bookingKey);
    },
    refresh(payload, bookingKey) {
      const fee = getVisitFee(payload.service, payload.device);
      resetPayUi();

      if (!fee || fee.amountInr <= 0) {
        block.classList.add('hidden');
        return;
      }

      block.classList.remove('hidden');
      if (paidAwaitingConfirmation.has(bookingKey)) {
        showPaidAwaitingConfirmation('');
        return;
      }
      if (payService) payService.textContent = payload.service || 'On-site visit';
      if (payAmount) payAmount.textContent = formatInr(fee.amountInr);
      payBtn.textContent = `Pay ${formatInr(fee.amountInr)} to confirm your slot`;
    },
  };
}

export { getBookingPaymentLockMessage, isBookingPaymentLocked } from './booking-payment-gate.js';
