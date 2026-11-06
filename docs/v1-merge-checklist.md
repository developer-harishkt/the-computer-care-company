# V1 go-live checklist — `feat/cofounder-feedback` → `main`

Prepared 2026-11-06. Production today (`thecomputercarecompany.in`, `main` @ `7e130b5`) is the SEO-only site: **no booking popup, no payments, no analytics**. Merging puts 72 commits live (46 files).

Tick each box in order. Steps marked **(user)** need a dashboard or account only you can open.

---

## 1. Before merging

- [ ] **Karthik sign-off on V1** (message sent 6 Nov), including the 8 AM–9 PM "Soonest" slot window.
- [ ] **Code.gs redeploy (user)** for the V1 FINAL prices (printer ₹649, repair ₹189/₹199) — must be live before go-live; verify with a read-only `create-order`.
- [ ] **Razorpay live mode (user) — decided: option A, live keys everywhere** (account is activated). On go-live day: Razorpay Live → API Keys → Generate; Apps Script Script properties `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` = live pair (no redeploy needed, read per request); Cloudflare `VITE_RAZORPAY_KEY_ID` = `rzp_live_…` in **Production and Preview**; then merge. Never paste the secret into chat.
- [ ] **Cloudflare Production env vars (user):** Pages → project → Settings → Variables and secrets → **Production** (separate from Preview):
  - `VITE_SITE_URL` = `https://thecomputercarecompany.in`
  - `VITE_BOOKINGS_WEBHOOK_URL` = the Apps Script `/exec` URL (same as Preview, unless a separate production script is made)
  - `VITE_RAZORPAY_KEY_ID` = **live** key `rzp_live_…` (once Razorpay is live)
  - (PostHog needs nothing: the key is in the code.)
- [ ] **Apps Script (user):** if the live key is used, set Script properties `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` to the live pair, then Deploy → **edit the existing deployment → New version**. Note: the Preview uses the same webhook, so after this, payments on the preview are **real money** too (see "Payments").
- [ ] **Booking sheet:** mark or delete the test rows made from the preview (names like "Test"), so real bookings start clean.

## 2. The merge (Claude does this, step by step)

- [x] Merge `origin/main` into the branch first — **done 6 Nov, `ac8fc49`**. `index.html` conflict resolved with the branch version (popup + `book-inline.js`; `main` had removed them only for the SEO-only build, `d49d59d`). `book.html` already had `main`'s LocalBusiness schema, so the merged tree is **identical** to the branch — no content change. Branch now merges into `main` with **no conflicts** (main is 0 commits ahead). Preview deploy: success.
- [ ] Just before the PR: build, run the full Playwright suite (sweep, booking, live validation, payment, analytics, slots) and check the preview. If `main` gets new commits meanwhile, merge it in again first.
- [ ] Open a PR `feat/cofounder-feedback` → `main` on GitHub, so there's a record and one click to merge (**user** merges, or asks Claude to).

## 3. Right after it goes live (`.in`)

- [ ] Cloudflare Production deploy shows **Success** (if "Failed to publish your Function", click **Retry deployment**, as on 6 Nov).
- [ ] All 8 pages load on phone and desktop, with no errors.
- [ ] Homepage "Book your care" opens the popup; `/book` works; the Subscriptions enquiry works.
- [ ] **One real booking end-to-end (user):** book a ₹189 visit with your own number and pay. Check the sheet row and the "Paid" status, then **refund it** in the Razorpay dashboard.
- [ ] Branch-visit booking (no payment) and one enquiry (e.g. Custom PC → WhatsApp) work.
- [ ] **PostHog:** a visit to `.in` shows up in Activity. Open `https://thecomputercarecompany.in/?analytics=off` once on your phone, your laptop and Karthik's phone (the setting is per site, so the preview one doesn't carry over).
- [ ] **Google:** Search Console → submit `https://thecomputercarecompany.in/sitemap.xml` and request indexing of the homepage (also picks up the new favicon for the Google logo).

## 4. If something breaks

- **Roll back in one click (user):** Cloudflare Pages → Deployments → the previous Production deploy (from `7e130b5`) → **Rollback to this deployment**. The site returns to the SEO-only version within a minute; then we fix on the branch calmly.
- The sheet, Apps Script and Razorpay are unaffected by a rollback.

---

## Payments — the one decision before go-live

Today the site and the Apps Script use Razorpay **test** keys, and the Preview and Production share one Apps Script webhook.

| Option | What it means |
|---|---|
| **A. Live keys everywhere** (simplest) | Razorpay account activated (KYC done) → live Key ID + Secret in Cloudflare Production and the Apps Script. The preview then also takes real money, so test payments stop there (test only on localhost with test keys, or refund). |
| **B. Separate production script** | Copy the Apps Script into a second deployment with live keys, used only by Production. Preview keeps test keys. Two scripts to keep identical (prices live in `Code.gs`). |
| **C. Launch without online payment** | Not ready in code today: an empty key shows "Online payment is not configured yet" when Pay is tapped. Would need a small change to hide the Pay button and say "pay at the visit". |
