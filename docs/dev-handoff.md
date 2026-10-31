# Dev handoff log (local continuity)

**Purpose:** Rolling notes for humans and Cursor agents working in this repo.  
**New session:** Read this file first for booking, payments, SEO, or deploy work.  
**When you finish meaningful work:** Update **Last updated**, **Current focus**, and add a short entry under **Session log**.

---

## Last updated

- **Date:** 2026-10-31 (IST)
- **Branch:** `release-v3-booking`
- **Current focus:** Razorpay vs booking modal top-layer (dialog closed before checkout; restore after settle).

---

## User preferences (don’t forget)

- Do **not** git commit unless explicitly asked.
- **Netlify** = optional preview only (`thecomputercarecompany.netlify.app`); **do not** point `thecomputercarecompany.in` at Netlify.
- **Cloudflare Pages** = production domain + branch previews (`*.pages.dev`).
- Co-founder docs applied: payment copy, cancellations (terms §11), subscriptions page (no internal profitability tables).

---

## Hosting map

| Environment | URL | Branch | Notes |
|-------------|-----|--------|--------|
| **Production** | `https://thecomputercarecompany.in` | `main` | Cloudflare Pages; `VITE_SITE_URL` = `.in` |
| **Preview (v3)** | `https://release-v3-booking.the-computer-care-company.pages.dev` or per-deploy hash | `release-v3-booking` | Preview env vars; **not** `.in` for `VITE_SITE_URL` |
| **Netlify (stale / credits)** | `https://thecomputercarecompany.netlify.app` | was `release-v2`, CLI deploys | Account **credit exceeded** — new deploys blocked; use Cloudflare for preview |

**Netlify Git settings (if used again):** production branch set to **`release-v3-booking`** via API; Git auto-build failed once (host key / repo access — reconnect GitHub if needed).

**Do not use `public/_redirects` on Cloudflare** — causes **308 loop** on `/book` with Pages pretty URLs. Rewrites live in **`netlify.toml`** only (Netlify).

---

## Booking wizard — current state

| Area | Status |
|------|--------|
| Wizard | `src/booking-wizard.js`, partial, modal + `/book` |
| Sheet submit | `src/booking-submit.js` → `VITE_BOOKINGS_WEBHOOK_URL` |
| Razorpay | `src/booking-payment.js` + GAS `create-order` / `verify-payment` |
| Success copy | `src/booking-payment-copy.js`, `src/booking-success-ui.js` |
| GAS | `docs/apps-script/bookings-webhook/Code.gs` — redeploy after every GAS change |
| `/book` layout | Two-column: sidebar + wizard (`book.html`); intro hidden on page context |
| Styling | Full `src/style.css` `@layer components` (was missing from git briefly — caused unstyled deploy) |

### Env vars (Vite — baked at **build** time)

| Variable | Production | Preview |
|----------|------------|---------|
| `VITE_SITE_URL` | `https://thecomputercarecompany.in` | `https://<your-preview>.pages.dev` (no trailing slash) |
| `VITE_BOOKINGS_WEBHOOK_URL` | Apps Script `/exec` | Same (test sheet OK) |
| `VITE_RAZORPAY_KEY_ID` | Live when ready | `rzp_test_...` |

**Common error:** `Booking is not configured yet` → empty or wrong name (e.g. `VITE_BOOKINGS_WEBHOOK_U` missing **`RL`**). Verify in built JS: search for `script.google.com`.

**Cloudflare:** Settings → Variables and secrets → **Preview** vs **Production** separately → **Retry deployment** after changes.

Local: `.env.local` (gitignored); `.env.production` has `VITE_SITE_URL` for local builds only.

---

## Co-founder content (done)

- **Cancellations:** `terms.html` §11 + `#cancellations` (10% / 90% refund after paid booking).
- **Payment page copy:** `src/booking-payment-copy.js`.
- **Subscriptions:** `subscriptions.html` + nav + sitemap entry.
- **Site tweaks:** logo → home, hero Call, service labels, footer trim, Razorpay checkout lock fix.

---

## Not done / waiting

- Merge `release-v3-booking` → `main` after sign-off.
- GSC sitemap submit (expand `public/sitemap.xml` if needed).
- Free **in-store diagnosis** vs paid visit fee — copy pass site-wide (co-founder decision).
- **Products** nav (cleaning kit, etc.) — no copy doc yet.
- `/book` success UX: hide marketing sidebar on success (CSS `:has` added); optional payment block copy after pay.
- Netlify: credits / reconnect if still wanted as backup preview.

---

## Key commands

```bash
npm run dev          # http://localhost:5173
npm run build && npm run preview   # http://localhost:4173 (must stay running)
npm run test:webhook # needs VITE_BOOKINGS_WEBHOOK_URL in env
```

**GAS:** paste `Code.gs` → Deploy → **New version** after changes.

---

## Session log (newest first)

### 2026-10-31 — /book success layout + Razorpay retry in same checkout

- **Layout:** success phase kept 2-col grid with empty `26rem` track → narrow strip; fixed with `grid-cols-1` when `data-phase=success`.
- **Pay retry:** `payment.failed` was ending session + closing checkout while user retried in Razorpay → success `handler` ignored; now only record failure message until `ondismiss`.

- User recording (~36s): first Pay + after **Payment failed**, Razorpay behind open booking dialog; retry → full checkout → success.
- **Fix:** early `prepareCheckoutLayer`; defer restore until quiescent; no `showModal` on dialog `close` while payment locked; CSS hide modal when `booking-payment-locked`.

### 2026-10-31 — Success/payment panel UX (modal + /book)

- Razorpay hint tied to pay CTA visibility; hidden after verified pay.
- Success scroll: modal `scrollTop = 0` + `scroll-padding-top`; page uses `scroll-margin-top` + window scroll offset.
- Modal header copy updates by success/paid/fee-not-required; restored on reset/close.
- Modal-only form padding dedupe; removed dead `#visit-summary`.

### 2026-10-31 — v3 deploy, Cloudflare preview, fixes (this session)

**Docs → code**

- Applied co-founder **Cancellations**, **payment page**, **Subscription plans** (customer-facing only).
- Pushed branch **`release-v3-booking`** (`660daf2` … `b63c553`).

**Netlify**

- Logged in, linked `thecomputercarecompany`, CLI deploys to `.netlify.app`.
- Set Preview `VITE_SITE_URL` to `.netlify.app`; user clarified **Netlify = test only**, `.in` stays Cloudflare.
- Hit **deploy credit limit** — production on Netlify stuck on older deploy; CSS/wizard fixes not on Netlify without credits.
- Changed Git production branch to **`release-v3-booking`** via API (optional).

**Fixes shipped on branch**

- **`643416c`:** Restored `src/style.css` wizard/modal/`book-btn-*` (was only in git stash — caused broken slot UI on deploy).
- **`802fe20`:** Razorpay reopen loop — checkout session lock, no re-enable pay before open, single dismiss/fail cleanup.
- **`2763a29`:** `/book` two-column layout; hide wizard `#booking-intro` on page.
- **`b63c553`:** Removed `public/_redirects` (Cloudflare redirect loop); redirects in `netlify.toml` for Netlify only.

**Cloudflare Pages**

- User connected project; production branch **`main`**, previews for other branches.
- **Redirect loop** on `/book` until `_redirects` removed — use **`release-v3-booking….pages.dev`** after fix deploy.
- **Booking not configured:** Preview build had no webhook in JS — user had typo **`VITE_BOOKINGS_WEBHOOK_U`**; must be **`VITE_BOOKINGS_WEBHOOK_URL`**. Split **Preview** vs **Production** `VITE_SITE_URL` (`.pages.dev` vs `.in`).

**Local**

- Killed Vite / localtunnel when slow; documented `4173` = `npm run preview` must be running.
- Stopped dev/preview servers at end of session (confirmed **5173** and **4173** free; no local Node listeners).

**Session closed (user request, 2026-10-31 IST)**

- Full session recap consolidated in this file; next agent: read **Last updated** + **Not done / waiting** + newest **Session log** entry.
- No git commit this close-out (preference: commit only when asked). Push `docs/dev-handoff.md` when you want it on GitHub.

**Git notes**

- `.env.local` never commit; `.netlify/` gitignored by CLI.
- Stash `booking WIP` may still exist — mostly superseded by committed `style.css`.

### 2026-10-31 — Booking UX + handoff doc (earlier)

- Modal visibility, Tailwind partial scan, schedule UX, `docs/dev-handoff.md` created.

---

## Key file map

```
index.html, book.html, subscriptions.html
src/booking-wizard.js, booking-submit.js, booking-payment.js
src/partials/booking-wizard-body.html
src/style.css, tailwind.config.js  # include src/**/*.html
docs/apps-script/bookings-webhook/Code.gs
netlify.toml                       # Netlify redirects only
.env.example, .env.production      # not secrets
```
