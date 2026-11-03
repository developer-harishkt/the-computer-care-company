/**
 * POST JSON to Google Apps Script web app (see docs/apps-script/bookings-webhook).
 * Uses text/plain body to avoid CORS preflight against script.google.com.
 */

const WEBHOOK_URL = import.meta.env.VITE_BOOKINGS_WEBHOOK_URL;

/** Must match `buildBookingKey` in docs/apps-script/bookings-webhook/Code.gs */
export function buildBookingKeyFromPayload(payload) {
  const raw = [
    String(payload.name ?? ''),
    String(payload.email ?? ''),
    String(payload.phone ?? ''),
    String(payload.date ?? ''),
    String(payload.time ?? ''),
  ].join('|');
  const bytes = new TextEncoder().encode(raw);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Normal replies take 2–4 s; a request with no reply after this long is treated as lost and retried once. */
const REQUEST_TIMEOUT_MS = 20000;
const REQUEST_ATTEMPTS = 2;
/** Show "still sending" feedback after this long. */
const SLOW_AFTER_MS = 6000;
const UNREACHABLE_MESSAGE =
  'Our booking system is taking too long to reply. Please try again, or WhatsApp us on +91 70104 81012 and we’ll book you in.';

/**
 * POST to the Apps Script with a time limit per attempt and one automatic retry when there is no reply.
 * Every action is safe to repeat: Code.gs updates an existing booking instead of adding a duplicate,
 * refuses a second order for a paid booking, and verification is idempotent.
 * @param {Record<string, unknown>} data
 * @param {{ onSlow?: () => void, attempts?: number, timeoutMs?: number }} [options]
 */
async function postToWebhook(data, { onSlow, attempts = REQUEST_ATTEMPTS, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  if (!WEBHOOK_URL || !WEBHOOK_URL.trim()) {
    return {
      ok: false,
      message: 'Booking is not configured yet. Please call or WhatsApp us to schedule.',
    };
  }

  const slowTimer = onSlow ? window.setTimeout(onSlow, SLOW_AFTER_MS) : null;
  try {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
      let response;
      let text;
      try {
        response = await fetch(WEBHOOK_URL.trim(), {
          method: 'POST',
          mode: 'cors',
          redirect: 'follow',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        });
        text = await response.text();
      } catch {
        // Timed out or no connection: try again once, then give up with a clear message.
        if (attempt < attempts) continue;
        return { ok: false, message: UNREACHABLE_MESSAGE };
      } finally {
        window.clearTimeout(timeout);
      }
      return parseWebhookResponse(response, text);
    }
    return { ok: false, message: UNREACHABLE_MESSAGE };
  } finally {
    if (slowTimer) window.clearTimeout(slowTimer);
  }
}

function parseWebhookResponse(response, text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const detail = parsed?.error || text.slice(0, 120) || response.statusText;
    return { ok: false, message: detail || 'Request failed. Please try again or WhatsApp us.' };
  }

  if (parsed?.error) {
    return { ok: false, message: parsed.error };
  }

  return { ok: true, data: parsed };
}

/**
 * @param {Record<string, string | undefined>} payload From booking wizard collectPayload()
 */
export async function submitBookingToSheet(payload, { onSlow } = {}) {
  const result = await postToWebhook(
    {
      source: 'website-wizard',
      ...payload,
    },
    { onSlow },
  );

  if (!result.ok) return result;

  if (result.data?.status === 'success') {
    const bookingKey =
      result.data.bookingKey || buildBookingKeyFromPayload(payload);
    // Newer Code.gs: this exact booking is already paid (e.g. resent after a reload).
    return { ok: true, bookingKey, alreadyPaid: result.data.alreadyPaid === true };
  }

  return {
    ok: false,
    message: 'Unexpected response from booking server. Please try again or WhatsApp us.',
  };
}

/**
 * @param {{ service: string, device: string, bookingKey: string }} params
 */
export async function createVisitFeeOrder({ service, device, bookingKey }) {
  const result = await postToWebhook({
    source: 'website-wizard',
    action: 'create-order',
    service,
    device,
    bookingKey,
  });

  if (!result.ok) return result;

  if (result.data?.status === 'already-paid') {
    return { ok: false, alreadyPaid: true, message: 'This booking is already paid.' };
  }

  if (result.data?.status === 'success' && result.data.orderId) {
    return {
      ok: true,
      orderId: result.data.orderId,
      amountPaise: result.data.amountPaise,
      currency: result.data.currency || 'INR',
    };
  }

  return {
    ok: false,
    message: result.data?.error || 'Could not start payment. Try again or pay when we call.',
  };
}

/**
 * @param {{ bookingKey: string, razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }} params
 */
export async function verifyVisitFeePayment(params) {
  // The caller (booking-payment.js) already retries verification 3 times, so one attempt each here.
  const result = await postToWebhook(
    {
      source: 'website-wizard',
      action: 'verify-payment',
      bookingKey: params.bookingKey,
      razorpay_order_id: params.razorpay_order_id,
      razorpay_payment_id: params.razorpay_payment_id,
      razorpay_signature: params.razorpay_signature,
    },
    { attempts: 1, timeoutMs: 15000 },
  );

  if (!result.ok) return result;

  if (result.data?.status === 'success') {
    return { ok: true };
  }

  return {
    ok: false,
    message: result.data?.error || 'Payment verification failed. Contact us with your payment ID.',
  };
}
