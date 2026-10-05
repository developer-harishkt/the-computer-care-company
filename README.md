**Repository Description (for the GitHub UI)**
Single-page marketing site for The Computer Care Company, built with Vite and Tailwind CSS.

# The Computer Care Company — Marketing Site

Static, single-page marketing site for a Chennai-based IT support and hardware repair business. The site's core proposition is *repair before replacement*: diagnose first, explain the options, obtain approval, and only then repair — never upsell a replacement just because a device has a problem.

The build is intentionally dependency-light and integration-ready. There is no framework and no client-side router; the entire page is one static document, so it can be deployed to any edge host and later wired to third-party booking, payment, and scheduling APIs.

## Tech Stack

- **Build tool:** [Vite](https://vitejs.dev/) 8.x
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) v3.4 (deliberately pinned to v3)
- **CSS pipeline:** PostCSS + Autoprefixer
- **JavaScript:** Vanilla ES modules — no framework, no runtime dependencies
- **Architecture:** Single-page static site. One entry point (`index.html`), a standard Vite config with no multi-page rollup inputs.
- **Fonts:** Inter (sans) and JetBrains Mono (mono), self-hosted-adjacent via Google Fonts CDN

## UI Tokens — "Modern SaaS"

The visual language is defined by three values, applied directly as Tailwind utilities rather than extended theme tokens:

| Token | Value | Role |
| --- | --- | --- |
| Canvas | `#EEF2F7` | Page background, tinted section bands, footer, mobile menu surface |
| Surface | `#F7F9FC` | Alternating card/section backgrounds |
| Accent | `blue-600` | Primary CTAs, active states, icon accents, focus rings, hover inversions |
| Neutral | `slate-200` → `slate-900` | Borders, body copy, headings, dark hero |

Typography pairs `font-black` uppercase display headings with `font-mono` for labels, metrics, and badges. Section backgrounds alternate canvas/surface/white in a fixed rhythm so no two adjacent bands share a tone.

## Core Features

- **Responsive layout** with a JS-toggled mobile navigation menu (hamburger → dropdown panel mirroring the desktop nav plus the primary CTA). Menu closes on link click and on `Escape`.
- **Service matrix** — eleven service cards plus an expected-turnaround-times table covering software troubleshooting, OS installation, servicing, hardware diagnosis, parts replacement, and data recovery.
- **8-step "How We Work" process** — Diagnose → Explain → Approve → Repair → **Progress** → Test → Notify → Support. Presented as a responsive 4×2 card grid. The Progress step communicates live status tracking (Product Received → Under Repair → Final Testing → Ready for Delivery, including waits on customer approval, parts, or information).
- **"Repair Before Replacement" narrative** — an ordered sequence: Repair vs Replace guide, Parts & Replacements (with component-transparency tiers: New / OEM / Compatible / Refurbished), Before We Repair (closing on "Then: You decide whether we proceed"), and a concluding sign-off.
- **Onsite Service Coverage banner** — branch prominence (Korattur main, Maduravoyal upcoming) plus a 13-locality chip cluster across Chennai, elevated out of the footer for local SEO.
- **Grievance & Redressal component** — a native `<details>` disclosure styled to match the FAQ accordions. Leads with the italicised statement *"Our aim is to resolve genuine concerns fairly and respectfully, without unnecessary inconvenience to the customer"*, then covers how to raise a grievance, the redressal approach, the distinction between grievances and warranty, escalation paths, and contact details.
- **FAQ** — four native `<details>` accordions (zero-dependency disclosure).
- **Repair portfolio** — three case-study cards documenting problem, diagnosis, solution, and result.
- **Sticky header** with logo lockup, anchor navigation, and a mailto CTA.

All primary calls to action route to `mailto:support@computercarecompany.in`. Every in-page anchor resolves to an existing section ID — no dead links.

## Project Structure

```
.
├── index.html            # Entire site — single entry point
├── vite.config.js        # Standard config, no MPA inputs
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── src
    ├── main.js           # Mobile menu toggle (vanilla JS)
    └── style.css         # Tailwind directives + base body styles
```

There are no image assets in version control — see the deployment checklist below.

## Local Development

Requires Node.js.

```bash
git clone <your-repo-url>
cd the-computer-care-company
npm install
npm run dev
```

Open `http://localhost:5173/`.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Upcoming Integrations

- **Scheduling:** Cal.com embed to replace the mailto-based booking CTA with real on-site service slots.
- **Payments:** Razorpay Payment Links for diagnostic deposits and AMC checkouts.
- **Media:** Replace the `[Actual Photo: …]` placeholders in the portfolio with real hardware repair photography.
- **Status tracking:** Surface the "Progress" step's status model with a real backend endpoint.

## Deployment

Deploys to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages). Connect the repository and build with `npm run build`; publish the `dist/` directory. No server-side runtime, environment variables, or API keys are required.

## Deployment Checklist

Complete these before going live:

- [ ] **Add the brand logo at `public/logo.jpg`.** The header (`h-10`) and footer (`h-16`) both reference it. The file is not in version control, so both images render broken until it is added. Vite copies `public/` verbatim — no import or registration needed.
- [ ] **Replace the dummy phone number `+91 00000 00000`.** It appears in the header CTA cluster, the mobile menu, and the Grievance & Redressal contact block. Since all CTAs now resolve to live `mailto:` / `tel:` targets, this placeholder is user-visible on every conversion path.
- [ ] **Confirm the support email address.** `support@computercarecompany.in` is currently used site-wide, including for grievance escalation. Verify it is the correct address for customer care, and add a dedicated grievance address if one exists.
- [ ] **Fill in the Maduravoyal branch address and mobile number**, currently marked "upcoming" / pending.
- [ ] **Add Open Graph and Twitter Card meta tags**, plus a canonical URL. Neither is currently present.
- [ ] **Add a `<link rel="icon">`.** No favicon is declared.
- [ ] **Review the "Book On-Site Service" CTA label.** It now opens an email client, which is a behavioural change from the original booking intent.
- [ ] **Run an accessibility and responsive pass** on a real device, particularly the mobile header height and the 13-chip coverage cluster.
- [ ] **Consider extracting the inline SVGs** — roughly two dozen icons are duplicated by hand across the document and would benefit from a sprite or component layer if the page grows.