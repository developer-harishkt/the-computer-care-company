# Bookings Google Apps Script (Cal.com webhook + status emails)

Local copy of the production Apps Script. Deploy from [Google Apps Script](https://script.google.com) bound to the bookings spreadsheet; this repo is documentation and future edits.

## Files

| File | Role |
|------|------|
| `Code.gs` | Web App `doPost` (Cal.com webhook), `processStatusEmail` (sheet edits), `sendHtmlEmail` |

## Spreadsheet: `Bookings` tab columns (inferred)

| Col | Field |
|-----|--------|
| A | Date |
| B | Time |
| C | Name |
| D | Email |
| E | Phone |
| F | Address |
| G | Issue / notes |
| H | Status (dropdown; validation copied from row 2) |
| I | Send update (checkbox → HTML email) |
| J | Payment status (`Pending`, `Paid`, `Not required`) |
| K | Razorpay order ID |
| L | Razorpay payment ID |
| M | Booking ref (website wizard; used to match payments) |

Add headers **J1–M1** on the `Bookings` tab before going live (existing rows can stay blank in J–M).

## Triggers (in Google, not in repo)

1. **Web app** — Deploy as “Execute as me”, “Anyone” (or “Anyone with Google account”) for Cal.com POST URL → `doPost`.
2. **Simple trigger or installable `onEdit`** — Must call `processStatusEmail(e)` when editing the sheet (simple `onEdit` only works for UI edits by a user; installable trigger if needed).

## API

- **POST JSON** — Cal.com booking payload (existing shape: `payload`, `attendees`, `responses`, `startTime`, etc.).
- **POST `{"triggerEvent":"PING"}`** — Test row + checkbox in column I.
- **POST website wizard** — `{ "source": "website-wizard", "service", "device", "date", "time", "name", "email", "phone", "address", "landmark?", "notes?" }`. Column G = `service · device` + notes; **J** = payment status; **M** = booking ref.
- **POST wizard ping** — `{ "source": "website-wizard", "triggerEvent": "PING" }`.

The Vite site sends the wizard body as **`text/plain`** (JSON string) to reduce CORS preflight issues against `script.google.com`. Set `VITE_BOOKINGS_WEBHOOK_URL` in `.env.local` to the deployed `/exec` URL (see repo `.env.example`).

After editing `Code.gs` here, paste into the bound Apps Script project and **Deploy → Manage deployments → New version** (or new deployment) so the web app runs the latest code.

**Duplicate rows:** The script does not dedupe the sheet. Cal.com (or retries) may append twice — delete or merge duplicates in the sheet if needed. This keeps webhook responses fast and avoids deleting wizard rows that need column **M** for Razorpay verify.

## Razorpay (Phase C — book first, pay on success screen)

**Script properties** (Apps Script → Project settings → Script properties):

| Property | Value |
|----------|--------|
| `RAZORPAY_KEY_ID` | `rzp_test_…` or `rzp_live_…` |
| `RAZORPAY_KEY_SECRET` | Secret from API Keys CSV (shown once) |

**Website env** (`.env.local` / hosting): `VITE_RAZORPAY_KEY_ID` — same Key ID as above (public).

**Wizard payment actions** (same web app URL, `source: "website-wizard"`):

| `action` | Body fields | Response |
|----------|-------------|----------|
| *(none)* | booking fields | `{ status, bookingKey }` — **J** Pending/Not required, **M** booking ref |
| `create-order` | `service`, `device`, `bookingKey` | `{ status, orderId, amountPaise, currency }` |
| `verify-payment` | `bookingKey`, `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` | `{ status }` — sets **J** Paid, **K** order id, **L** payment id |

Visit fees (INR, server-enforced): **₹199** default visit/diagnostics; **₹600** component install; **₹599–1099** device-based for servicing/cleaning; **Corporate / AMC** — no online fee.

Test payments: [Razorpay test cards](https://razorpay.com/docs/payments/payments/test-card-upi-details/).

## Smoke tests (local)

From repo root (reads `.env.local`):

```bash
export $(grep -v '^#' .env.local | xargs)
# Optional: direct Razorpay API check (never commit secrets)
export RAZORPAY_KEY_ID="$VITE_RAZORPAY_KEY_ID"
export RAZORPAY_KEY_SECRET='your_secret'
node docs/apps-script/bookings-webhook/test-webhook.mjs
```

Expected: `ping` → `{ status: success }`, `book` → `{ bookingKey }`, `create-order` → `{ orderId, amountPaise: 19900 }`, bad verify → `{ error: Invalid payment signature }`.

Plain `curl -L` against the web app is unreliable (405/HTML); use the Node script (same as the browser `fetch`).

In Apps Script editor, run **`testRazorpayOrderInEditor`** after setting Script properties to confirm Razorpay credentials without the web app.

## Security note

`Code.gs` contains the spreadsheet ID. Do not treat this sheet as public; restrict Web App access appropriately when moving off Cal.com-only traffic.
