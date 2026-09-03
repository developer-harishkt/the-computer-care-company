**Repository Description (for the GitHub UI)**
Static frontend prototype for The Computer Care Company, built with Vite and Tailwind CSS.

# The Computer Care Company - Digital Storefront

A lightning-fast, static frontend for a Chennai-based IT support and hardware repair business. Built with a decoupled architecture to prioritize local SEO, high-contrast engineering aesthetics, and seamless integration with third-party booking and payment APIs.

## Tech Stack
* **Build Tool:** [Vite](https://vitejs.dev/) (Vanilla template)
* **Styling:** [Tailwind CSS v3](https://tailwindcss.com/)
* **Architecture:** Static HTML/CSS (Prepared for headless API integration)

## Current Features (Phase 1)
* **Responsive UI:** Dark-themed, high-contrast layout optimized for mobile and desktop.
* **Service Matrix:** Grid layouts detailing hardware/software offerings and turnaround times.
* **Process Timeline:** A 7-step visual workflow outlining the "Repair Before Replacement" philosophy.
* **Static FAQ & Portfolio:** Interactive accordions and a dedicated photo gallery section for hardware repair evidence.

## Local Development
To run this project locally, ensure you have Node.js installed.

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd the-computer-care-company

2. Install dependencies (specifically locking Tailwind v3):
```bash
npm install

```

3. Start the Vite development server:
```bash
npm run dev

```

4. Open your browser and navigate to `http://localhost:5173/`.

## Upcoming Integrations (Phase 2)

* **Scheduling:** Injecting Cal.com embed scripts for automated on-site service booking.
* **Payments:** Connecting Razorpay Payment Links for diagnostic deposits and AMC checkouts.
* **Media:** Replacing placeholder gallery sections with real-world hardware repair photography.

## Deployment

This project is configured for seamless deployment to edge networks like Vercel or Netlify. Connect the repository to your chosen platform, and it will automatically build and deploy the `index.html` and compiled assets upon every push to the `main` branch.
