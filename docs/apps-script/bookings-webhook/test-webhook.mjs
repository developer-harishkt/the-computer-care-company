#!/usr/bin/env node
/**
 * Smoke-test the deployed bookings web app (same transport as the Vite site).
 *
 * Usage:
 *   VITE_BOOKINGS_WEBHOOK_URL=https://script.google.com/.../exec node test-webhook.mjs
 * Or from repo root with .env.local:
 *   export $(grep -v '^#' .env.local | xargs) && node docs/apps-script/bookings-webhook/test-webhook.mjs
 */

const url = process.env.VITE_BOOKINGS_WEBHOOK_URL?.trim();
if (!url) {
  console.error('Set VITE_BOOKINGS_WEBHOOK_URL');
  process.exit(1);
}

async function post(label, data) {
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error(`\n[${label}] HTTP ${res.status} — not JSON:\n${text.slice(0, 200)}`);
    return null;
  }
  console.log(`\n[${label}]`, JSON.stringify(json));
  return json;
}

async function testRazorpayDirect() {
  const id = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) {
    console.log('\n[razorpay-direct] skip (set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET to test API directly)');
    return;
  }
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ amount: 19900, currency: 'INR', receipt: 'node_direct_test' }),
  });
  const json = await res.json();
  console.log('\n[razorpay-direct]', res.status, json.id ? `order ${json.id}` : json);
}

await post('ping', { source: 'website-wizard', triggerEvent: 'PING' });

const book = await post('book', {
  source: 'website-wizard',
  service: 'Standard diagnostics / check-up',
  device: 'Windows laptop',
  date: '2026-11-02',
  time: '11:00 AM',
  name: 'Webhook Test',
  email: `webhook-test-${Date.now()}@example.com`,
  phone: '9000000001',
  address: 'Korattur, Chennai',
});

const bookingKey = book?.bookingKey || '';
await post('create-order', {
  source: 'website-wizard',
  action: 'create-order',
  service: 'Standard diagnostics / check-up',
  device: 'Windows laptop',
  bookingKey: bookingKey || 'fallback-key',
});

await post('verify-payment-bad-sig', {
  source: 'website-wizard',
  action: 'verify-payment',
  bookingKey: bookingKey || 'fallback-key',
  razorpay_order_id: 'order_test',
  razorpay_payment_id: 'pay_test',
  razorpay_signature: 'invalid',
});

await testRazorpayDirect();
