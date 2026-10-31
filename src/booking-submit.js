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

async function postToWebhook(data) {
  if (!WEBHOOK_URL || !WEBHOOK_URL.trim()) {
    return {
      ok: false,
      message: 'Booking is not configured yet. Please call or WhatsApp us to schedule.',
    };
  }

  let response;
  try {
    response = await fetch(WEBHOOK_URL.trim(), {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(data),
    });
  } catch {
    return {
      ok: false,
      message: 'Could not reach our booking server. Check your connection and try again.',
    };
  }

  const text = await response.text();
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
export async function submitBookingToSheet(payload) {
  const result = await postToWebhook({
    source: 'website-wizard',
    ...payload,
  });

  if (!result.ok) return result;

  if (result.data?.status === 'success') {
    const bookingKey =
      result.data.bookingKey || buildBookingKeyFromPayload(payload);
    return { ok: true, bookingKey };
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
  const result = await postToWebhook({
    source: 'website-wizard',
    action: 'verify-payment',
    bookingKey: params.bookingKey,
    razorpay_order_id: params.razorpay_order_id,
    razorpay_payment_id: params.razorpay_payment_id,
    razorpay_signature: params.razorpay_signature,
  });

  if (!result.ok) return result;

  if (result.data?.status === 'success') {
    return { ok: true };
  }

  return {
    ok: false,
    message: result.data?.error || 'Payment verification failed. Contact us with your payment ID.',
  };
}
