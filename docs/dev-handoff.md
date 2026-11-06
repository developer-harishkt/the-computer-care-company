# Dev handoff log (local continuity)

**Purpose:** Rolling notes for humans and Cursor agents working in this repo.  
**New session:** Read this file first for booking, payments, SEO, or deploy work.  
**When you finish meaningful work:** Update **Last updated**, **Current focus**, and add a short entry under **Session log**.

---

## Last updated

- **Date:** 2026-11-05 (IST)
- **Branch:** `feat/cofounder-feedback` (pushed; preview below). `main` = production, has **no** booking/payment code yet.
- **Current focus:** "Third Modification for V1.md" + 3 extra asks (popup double logo, live field validation, WhatsApp messages) + a speed pass are done **locally, not yet committed** (phases H, A, B, C, F, I, G, D, E — see newest Session log). Next: commit per phase, push to preview.

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
| **Preview (current)** | `https://feat-cofounder-feedback.the-computer-care-company.pages.dev` | `feat/cofounder-feedback` | Rebuilds ~15–60 s after push. Razorpay **test** key (`rzp_test_`). Same Apps Script webhook as local `.env.local` |
| **Preview (v3, older)** | `https://release-v3-booking.the-computer-care-company.pages.dev` or per-deploy hash | `release-v3-booking` | Preview env vars; **not** `.in` for `VITE_SITE_URL` |
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
| **Service rules** | `src/book-service-config.js` — single source: devices per service, `SERVICE_TASKS` ("What would you like us to take care of?" options), `LEAD_SERVICES`, prices, WhatsApp helpers |
| **Step plans** | Normal: mode → service → (task) → (device) → schedule → details → pay. **Lead** (Custom PC, Storage/NAS, Network setup, CCTV, Server build, AMC): mode → service → (task) → details → saved → WhatsApp (no device/time/address/payment). Network & security, Backup & recovery: no device step. Subscriptions tap → `/subscriptions` |
| **"Other"** | OS / Network & security / Backup task "Other" and Hardware device "Other" → WhatsApp immediately. Lead services' "Other" → details step like any option |
| **Need choice** | Saved as the start of `notes` (Code.gs puts notes in the Issue column) — no server field needed |
| **Start on a service** | `wizard.startWith(service, { device })`; used by homepage "Our Care" cards (`data-book-service`) and `/book?service=…&device=…` |
| **Subscriptions enquiry** | `src/plan-enquiry.js` + `<dialog id="plan-enquiry">` in `subscriptions.html`: name/phone/email → sheet (service `Subscriptions`, plan in notes) → WhatsApp |

### Prices (site `book-service-config.js` **must match** `Code.gs` `getVisitFeePaise`)

| Job | Price | Notes |
|-----|-------|-------|
| Diagnostic fee (repair / unknown, OS, Network & security, Backup, Standard diagnosis) | ₹189 | Server name for most services |
| Service (`Laptop or desktop servicing (cleaning)`) | Laptop ₹549 · Desktop ₹599 · Gaming ₹699 · All-in-one ₹1,299 · **Printer/scanner ₹549 (ASSUMED)** | Second Modification doc |
| All component installation (`Component install (RAM / SSD / GPU)`) | ₹259 online | Confirmed by Karthik; extras quoted on visit |
| Lead services, Subscriptions, AMC, Branch visit | No online fee | Sheet payment status "Not required" |

Quick check that both tables agree: load `Code.gs` in Node `vm` and compare with `getVisitFee` for every service/device (done 2026-11-05: all match).

### ⚠️ Testing the webhook safely

- `doPost` routes on **`source: 'website-wizard'`**. A POST **without** it is treated as a **Cal.com webhook and appends a junk row** (N/A / Standard Diagnostics) to the live sheet. Happened once on 2026-11-04 (4 rows, deleted by user).
- `action: 'create-order'` **with** the source tag is **read-only** on the sheet (creates an unpaid Razorpay **test** order). Use it to verify server prices after a redeploy.
- For UI tests, **intercept** `script.google.com` (and `wa.me`) in Playwright so nothing reaches the sheet.
- After a GAS redeploy, Google can serve the **old version for ~20–60 s** — repeat checks before concluding.
- Find the preview's webhook URL in the built `booking-wizard-mount-*.js` (search `script.google.com`).

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
- **DECISIONS-FOR-COFOUNDER (A1–A13, B1–B11)** — applied 2026-11-03 (other session): branch free diagnosis, Doorstep/Branch first step, flat ₹189 fee, payment hardening.
- **Website checklist comments + "Modifications for 3-11-26"** — applied 2026-11-03/04 (Phases 1–5, 3C).
- **"Second Modification for V1"** — applied 2026-11-05 (Home + Phases A–F). Source docs were in `~/Downloads` (not in repo).

---

## Not done / waiting

- **Karthik to confirm (assumed 2026-11-05):** Printer/scanner service ₹549 · "Network Setup & WI-FI" card → Network & security · "Sale of Laptops & Printers" card → WhatsApp. Each is one line in `book-service-config.js` / `index.html` (price also in `Code.gs` + redeploy).
- **Rate card:** removed for now (Third Modification: "we will think about it in the future").
- **Third Modification answers (Karthik, 2026-11-06):** OS "Other" needs no note (rule removed); button labels: paid doorstep "Proceed to Payment", enquiries "We’re Getting Connected" (also Subscriptions popup), branch "Let’s Book Your Visit"; centred turnaround intro confirmed.
- **Logo in Google results:** new real favicons (`favicon.ico` was a PNG mislabelled as ICO, served as `image/vnd.microsoft.icon` + `nosniff`). Only helps after merge to `main` + Google recrawl (can take days–weeks; request indexing in Search Console).
- **V2 (agreed):** cart (₹49 per extra service), WhatsApp approve buttons (needs WhatsApp Business API).
- Merge `feat/cofounder-feedback` → `main` after Karthik's sign-off (production has no booking code yet).
- GSC sitemap submit (`public/sitemap.xml` now includes `/grievance`).
- **Products** nav (cleaning kit, etc.) — no copy doc yet.
- Optional polish: contact-step helper text still booking-style for enquiries ("warranty record", "confirm your slot", "gate code").
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

### 2026-11-05 (night) — Third Modification for V1 + speed pass (uncommitted at time of writing)

- **H** Booking popup above the sticky header (z 70 / backdrop z 60, solid `slate-900/85`, no blur) — fixes the double logo on phones; Subscriptions popup backdrop matches.
- **A** Wording: slot times `8am – 1pm`; hero `24/7 Online – … · Walk In…`; Data Backup & Recovery; Repair Before Replacement Guide; Working Hours; Some of our prices; branch Get directions blue on its own line; turnaround copy + `2 to 3+ days`; Subscriptions: top label removed, 1-/3-Year **Scheduled Care**, one-line refund sentence; footer Email → Mail.
- **B** Homepage: rate card removed; Expected Turnaround Times is its own section `#turnaround` right after Care before cost; Our Care tiles lost the "Book your care →" cue (whole tile still opens booking); turnaround icons (search / terminal / computer / chip); component transparency chips in an even grid.
- **C** Booking: "Get service at your doorstep" + "Home, office, studio etc.", fee line removed; Hardware Service "from ₹549"; Custom PC options renamed/reordered; Network setup + CCTV ask "What are we helping you with today?"; OS & software "Other" continues (`OTHER_CONTINUES_SERVICES`, note required); submit button "Proceed to Payment" when a fee applies.
- **F** `src/live-validation.js`: fields checked on blur, re-checked while typing once in error, phone checked as soon as 10 digits are in. Booking contact step + Subscriptions popup. Same validators as Submit.
- **I** Speed (measured at 4× CPU slowdown): tap → next step 850 → ~420 ms; Tab focus 380 → ~50 ms. `transition-all` → `transition`, 300 → 200 ms; step animation 0.4 s → 0.16 s; auto-advance 360 → 160 ms; no blur on headers; smooth scroll off while a field / keyboard focus is active; booking popup pre-built on idle.
- **G** WhatsApp links prefilled: homepage "Connect on WhatsApp", booking success "WhatsApp us" + contact line (with booking ref), payment-received notice (with ref).
- **D** Privacy + Terms restyled like Grievance (centred title, blue-bar intro, blue small headings, contact box). Wording verified identical (text diff).
- **E** Favicons: real `favicon.ico` (PNG-in-ICO 48), `favicon-96.png`, `favicon-192.png`, new `apple-touch-icon.png`, linked on all 8 pages.
- No price changes → **no `Code.gs` redeploy needed**. Sweep: 8 pages × 5 widths, no overflow / JS errors; `vite build` OK.

### 2026-11-03 → 11-05 — Karthik's checklist + two modification docs (`e45ceb4` … `32a454c`)

Branch `feat/cofounder-feedback`, all pushed and checked on the live preview. Every change was browser-tested (Playwright, desktop 1280 / tablet 768 / phone 360–390, server + WhatsApp intercepted).

**11-03 — Logo + phone header**
- `e45ceb4` Transparent `public/logo.png` (made from the current logo; Karthik's "no background" file was AI-generated with a fake painted checkerboard). Schema still uses `logo.jpg`.
- `36ad4a3` Phone header: brand name wraps to 2 lines (homepage menu button was off-screen).

**11-04 — "Modifications for 3-11-26"**
- `7faf041` P1: tagline + 24/7 Online, removed technician / home-visit lines, Subscriptions monthly anchor pricing + quote.
- `75f614e` P2A: contact order, Working Hours & Location, footer order. `29d527a` P2B: **`/grievance` page** (vite input, `netlify.toml`, sitemap), rate card placeholder.
- `2ebd606` P3A: "visit fee" → **Diagnostic fee**, booking wording, popup logo. `c0b329f` P3B: Mac only for OS + Network & security.
- `dc496aa` P5A: homepage header on all sub-pages. `dccbbd7` P5B: Privacy/Terms typography.
- `df1d96b` / `34e3193` P3C: "What would you like us to take care of?" step + WhatsApp redirects.
- `47b62b6` first assumed prices (superseded by `1858738`).

**11-05 — "Second Modification for V1"**
- `f5f57f8` Our Care 2nd section (rounded overlap moved to it), Care before cost 3rd, 4 card renames (OS + Software merged).
- `5665f09` A: 24/7 first; Working Hours & Location under coverage (Doorstep left with example prices, Branch right); footer.
- `df10247` B: **"Book your care"** everywhere; Subscriptions price sizes; Grievance/Privacy/Terms tiles; **tablet fix** — header nav from `lg` (1024px), ☰ below (was overflowing 768–950px on every page).
- `0572766` C: "Get service at Home", "Other", Hardware question, no device step for Network & Backup.
- `1858738` D: device prices (site + Code.gs). `f7364ca` E1: lead services. `3451f08` E2: Subscriptions popup + Code.gs "Not required" for leads.
- `32a454c` F: clickable Our Care cards.

**GAS:** `Code.gs` redeployed by user after `47b62b6`, `1858738` and `3451f08`; server prices + no-fee services verified read-only afterwards.

**Process notes:** Karthik is non-technical — ask him only customer-facing questions; log every assumption in the commit message and code comment (`ASSUMED until Karthik confirms`).

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
index.html, book.html, subscriptions.html, grievance.html
src/book-service-config.js         # service rules, task options, lead services, prices, WhatsApp helpers
src/booking-wizard.js, booking-submit.js, booking-payment.js
src/plan-enquiry.js                # Subscriptions page enquiry popup
src/book-inline.js, src/book.js    # popup opener / page entry (both support startWith)
src/partials/booking-wizard-body.html
public/logo.png                    # transparent logo used in headers/footers
src/style.css, tailwind.config.js  # include src/**/*.html
docs/apps-script/bookings-webhook/Code.gs
netlify.toml                       # Netlify redirects only
.env.example, .env.production      # not secrets
```
