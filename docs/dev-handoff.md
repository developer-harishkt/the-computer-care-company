# Dev handoff log (local continuity)

**Purpose:** Rolling notes for humans and Cursor agents working in this repo.  
**New session:** Read this file first for booking, payments, SEO, or deploy work.  
**When you finish meaningful work:** Update **Last updated**, **Current focus**, and add a short entry under **Session log**.

---

## Last updated

- **Date:** 2026-11-08 (IST)
- **Branch:** `feat/cofounder-feedback` (pushed; preview below). `main` = production, has **no** booking/payment code yet.
- **Current focus:** Karthik's "Last minute changes" (11-07) done — declared the **V1 cut-off** (user sent Karthik a message: anything new goes on a V1.1 list, decided by analytics after launch). Code.gs V1 FINAL prices redeployed + verified 11-06. Next: Karthik's OK → Razorpay live keys (option A) → PR to `main` (see `docs/v1-merge-checklist.md`).

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

### Analytics (PostHog) — added 2026-11-06

- **Project:** PostHog **US** cloud, project id `714977`, key `phc_qV46…` (public, in `src/analytics.js`; `VITE_POSTHOG_KEY` overrides). Host `https://us.i.posthog.com`. Free plan (1M events + 5K recordings / month).
- **Code:** `src/analytics.js` (imported by `main.js` on every page). `posthog-js` is loaded on idle (separate ~118 KB gz chunk). `track(name, props)` queues until loaded; no-op when off.
- **Off** on localhost, `127.0.0.1` and automated browsers (`navigator.webdriver` → Playwright tests never send). Switches: `?analytics=off` (this browser stops, remembered), `?analytics=on` (undo), `?analytics=test` (send anyway, tab-only; events carry `is_test=true`, headless allowed, no compression, events echoed to console as `[tccc-analytics]`).
- **Toolbar / heatmaps:** PostHog → Settings → **Web analytics domains** (= authorized URLs; preview + `.in` added) → **Launch**. Toolbar is a dark bar at the **bottom centre**. On a browser with `?analytics=off`, Launch still loads PostHog in toolbar-only mode (captures nothing).
- **Privacy:** replay masks all inputs + `#booking-success-summary`; blocks `#booking-success-redirect`, `#plan-enquiry-done` (wa.me links with the name); `before_send` strips `wa.me/…?text=` everywhere; no `identify`. Privacy Policy §8 paragraph (Last updated 6 Nov 2026).
- **Events:** `$pageview` / `$pageleave` (scroll depth), autocapture, heatmaps, rage/dead clicks, replay; custom: `section_seen` (5 s on screen), `contact_tap` (channel whatsapp/call/mail/directions/social + section), `book_opened` (from section, service), `booking_step_viewed` (step, step_number, service, device, task, visit_mode, context), `booking_closed` (step, completed), `booking_error` (kind validation/submit_failed, field, message), `form_field_error` (live typing errors), `booking_submitted` (lead, fee_inr), `payment_started` / `payment_checkout_opened` / `payment_succeeded` / `payment_pending_confirmation` / `payment_failed` / `payment_closed` / `payment_error`, `plan_enquiry_opened` / `_submitted` / `_failed`. **Never put personal details in event props.**
- **PostHog project settings done by the user:** session replay on; test filter `is_test` **is not set** (keep it). Time zone should be **Asia/Kolkata** (was UTC).
- **Testing:** intercept `us.i.posthog.com` in Playwright with `?analytics=test` (script `an.js` pattern: fulfil `/flags` yourself, decode `/e/` bodies). `$pageleave` is sent on unload, so a test only sees it by calling the unload handler. A real check from the preview with `?analytics=test` returned 200 from PostHog.

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

- **V1 cut-off (2026-11-07):** Karthik's "Last minute changes" were the last pre-launch round. New asks → a **V1.1 list**, reviewed after a couple of weeks of real data.
- **Confirmed by Karthik (2026-11-07):** Soonest slot 8 AM–9 PM; repair ₹189 laptops / ₹199 Desktop, Gaming/Pro, AIO, Printer; "Other" kept in the device list; "last three contents" = quote + 2 lines under the plan tiles.
- **ASSUMED (2026-11-07, "take a call"):** late-night 4th slot = 10 PM (today if 2 h+ away, else tomorrow), badge "Late night", the 4 cards in time order; the "on" light on the 24/7 badge is a green glowing/pulsing dot; footer link columns stay side by side from 768 px; the 3-year plan's blue "For new PC buyers" label is grey like the 1-year one.
- **PRE-FINAL answers (Karthik, 2026-11-06):** PC security & threat management ₹189 "Visit & Assessment fee" — confirmed. "Need help?" line on the payment confirmation — removed, replaced by the centred quote "Technology needs ongoing care". Slots — earliest bookable time is **2 hours from now** (`MIN_LEAD_MINUTES` in `booking-slots.js`).
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

### 2026-11-08 — Service names on the payment page and summary

- Karthik: hardware "Service" and "Component installation" showed the internal names ("Laptop or desktop servicing (cleaning)", "Component install (RAM / SSD / GPU)") on the payment page and the post-payment summary — our miss from the 3 Nov button rename. Now `serviceDisplayName()` (`book-service-config.js`): "<device> service" (e.g. "Printer service", "Windows laptop service") and "Component installation services". Display only: the sheet and Code.gs keep the internal names (prices keyed by them) — no redeploy. The status email doesn't show the service.
- Payment cancel: no WhatsApp on purpose (failures, gateway errors, load errors and confirmation delay all show "Continue on WhatsApp"); cancelled bookings stay "Pending" in the sheet for a call-back. Karthik told.

### 2026-11-07 — Karthik's "Last minute changes" (V1 cut-off)

- **Booking:** device buttons no longer show prices (`priceFor` still supported in `choice-picker.js`, unused); Repair sublabel "at just ₹189/₹199"; time-step badge "24/7 doorstep service", bigger, green glowing dot; 4th recommended slot **Late night 10 PM** (`LATE_NIGHT_TIME` in `booking-slots.js`), cards sorted by time — if 10 PM tonight is before the next 8 AM, the 8 AM card says "Tomorrow" instead of "Soonest".
- **Footer (homepage only — other pages use a short footer):** "Care Before Cost. (Our Philosophy)" removed; "Mail:" / "Phone / WhatsApp:"; divider above Mail removed; grid `md:grid-cols-3` with brand full width so Organisation / Services / Legal stay in one row from 768 px (Legal used to drop to its own row at 768–1279).
- **Contact:** "Bringing complete computer care closer to you!" / "Address and opening hours will be announced soon" (no full stop).
- **Subscriptions:** 3-year tile now the same plain style as the 1-year (no blue border/ring/bigger shadow, grey label). Measured: identical spacing in both tiles; the 1-year has one fewer bullet, so a small gap above "Ideal for" keeps both buttons aligned.
- Code.gs redeployed (V1 FINAL prices) and verified read-only: printer service ₹649, Gaming/Pro ₹699, desktop repair ₹199, laptop repair ₹189, standard ₹189. No Code.gs change this round.
- Tests: sweep 8 pages × 5 widths clean; slots at 6 times of day; payment, live validation, analytics (no PII), parity 64 pairs — all pass.

### 2026-11-06 (late) — V1 FINAL CHANGES + footer

- **Booking:** hardware "Your device" order/names: Windows laptop, Desktop PC, **Gaming / Pro Laptop & PC**, All-in-one desktop, **Printer**, Other. Each device chip shows its price under Repair and Service (`priceFor` in `choice-picker.js`). Printer service ₹649. Repair ₹189 (laptops) / ₹199 (others) — ASSUMED. Old device names stay priced. Site = Code.gs for 64 service/device pairs.
- **Time step:** "24/7 on-site booking · any day, any hour" pill (homepage pill style).
- **Payment confirmation:** all ₹189-type fees are now "Service fee"; the ✓ lines + "What's included" sit **above** the fee.
- **Homepage:** Service Hours & Locations moved **below** Contact; Contact Main Branch lost open hours + Get directions; both branch tiles evenly spaced; Upcoming: "Bringing complete computer care closer to you." / "Address and opening hours will be announced soon."; "Some of our prices" repair "from ₹189". Footer: logo with name + philosophy beside it, "Mail – …" / "Phone / WhatsApp – …" inline, light divider above them; 4 columns only from 1280 px (brand full width on tablets) so nothing wraps.
- **Subscriptions:** roomier plan tiles; quote + "covered" / "quoted separately" lines in one subtle tile (wording unchanged).
- Tests: sweep 8 pages × 5 widths clean; booking, live validation, payment, slots scripts pass; build OK.

### 2026-11-06 (evening) — PostHog analytics + Karthik's PRE-FINAL answers

- **Analytics** (see "Analytics (PostHog)" above): `29b7dec` (setup, events, privacy paragraph), `8c2cc31` (toolbar works on `?analytics=off` browsers). Verified: no PostHog requests on localhost/tests; with `?analytics=test` all events arrive, no name/phone/email/address in any payload or recording, no `wa.me?text`. Speed at 4× CPU: tap → next step 402 → 466 ms; extra ~0.5 s long task while recording starts (after idle).
- **Slots — 2 h lead time** (Karthik: at 16:04 the 4:00 PM slot was offered): `isSlotPast` now means "starts less than 2 h from now" (recommendations + custom picker). Recommendations are re-computed every time the schedule step is shown (the popup is pre-built at page load). A slot that goes stale while the form is open is refused on Next/Submit with "That time is now less than 2 hours away…". Checked with a fixed clock at 08:30 / 16:04 / 22:30.
- **Recommended slots:** first card is now the **soonest free slot** (2 h from now, within 8 AM–9 PM — `SOONEST_FROM_HOUR`/`SOONEST_UNTIL_HOUR`, **ASSUMED until Karthik confirms**), then popular times (10, 11 AM, 2, 3, 4 PM) after it. Before, only those popular times were suggested, so after ~2 PM every suggestion was tomorrow. Any hour 24/7 is still pickable under "Choose date & time".
- **Payment confirmation:** "Need help? phone · Email" line → centred "“Technology needs ongoing care”" (`booking-success-ui.js`, `.booking-success-contact`).
- Regression: sweep 8 pages × 5 widths clean; booking, live validation and payment scripts pass; `vite build` OK.

### 2026-11-06 — PRE-FINAL MODIFICATIONS, V1

- **P1 Homepage:** Our Care heading centred; "Onsite Service Coverage" → **Service Hours & Locations**; Main Branch / Upcoming tiles moved into **Contact** (Korattur: phone/WhatsApp, mail, address, pincode, open hours, Get directions; Maduravoyal: "Address to be announced soon"); "Working Hours" heading removed; footer "Our branches" → `#contact`.
- **P2 Booking:** "Network & security" → **Network & Wifi** (value too; old name kept as alias, old links still work); new **PC security & threat management** category (5 options + Other → WhatsApp, no device step); order Standard → Hardware → OS → Network & Wifi → PC security → Backup; group "Lifetime Care & Business Support", "Subscription / Care plans"; **OS no device step**; homepage PC Security tile opens the new category.
- **P3 Payment confirmation:** fee names — Visit & Assessment fee (Standard, Hardware repair, Network & Wifi, PC security), Service fee (OS, Backup; Hardware servicing unchanged), Component installation fee unchanged; note "Note: parts and extra repair work are quoted after inspection." for all; "WhatsApp us" removed (confirmation + payment-received notice + help line); payment failure / gateway error / paid-but-confirming show **Continue on WhatsApp** with the booking ref (user cancelling Razorpay doesn't).
- **P4 Subscriptions:** refund line removed; intro text smaller; "Computer · Scheduled care · Longer life" block in one centred tile.
- Prices unchanged; site vs Code.gs verified for 10 services. Sweep 8 pages × 5 widths clean; `vite build` OK.
- Commits: P1 `5d669de`, P2 `49dd608`, P3 `9e575cb`, P4 `37b39b4`, docs `71c9494` (each clean-built from a fresh clone before push).
- **Cloudflare hiccup:** first deploy of `71c9494` said "Deploy failed" — log: assets published, then "Failed to publish your Function… Unknown internal error" (repo has no `functions/`). **Retry deployment** in the dashboard fixed it. If it repeats: retry first, then an empty commit.
- **How phases were committed this time (safe):** after each phase, snapshot the tree with a temp index (`GIT_INDEX_FILE=… git add -A … && git write-tree`), then chain `git commit-tree` per phase and `update-ref`. Includes new files (the 11-05 `git stash create` method missed untracked files and deleted `src/live-validation.js` in `c424dac`, fixed in `ab3d53d`).

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
