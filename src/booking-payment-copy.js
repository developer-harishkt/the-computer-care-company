/** Copy for booking success / payment panel (co-founder brief + UI redesign). */

export const PAYMENT_PAGE = {
  /** Shown only in paid state — full paragraph lives in longerLifeFull for reference. */
  longerLifePaid:
    'We’re glad to help your devices last longer — thoughtful repair beats replace when it makes sense.',
  longerLifeFull:
    'Wishing your technology a longer life — keeping technology useful for longer starts with thoughtful choices. We’re glad to be part of your journey towards making the most of what you already have. Together, we’re giving technology more time, more use, and less waste.',
  visitAssessment: {
    title: 'Doorstep visit and technical assessment',
    body:
      'Our technician will assess your computer or laptop and perform an initial on-site diagnosis wherever possible. If further testing or specialised equipment is required, a workshop assessment may be recommended, subject to your approval. We will explain our findings and provide a quotation for any required repairs before proceeding.',
  },
  warranty: {
    title: '60-day service warranty',
    body:
      'We believe good service goes beyond the repair itself. Eligible repairs are covered by our 60-day service warranty, covering the specific repair work performed and related issues attributable to that work. The warranty does not automatically cover new or unrelated faults, accidental damage, liquid damage, misuse, or issues arising from unauthorised repairs or modifications. All claims are subject to assessment and the applicable warranty terms. Our goal is to provide dependable repairs and continued support long after your service.',
  },
  /** TODO(owner): Confirm GST wording and whether visit fee adjusts against repair. */
  visitFeeHint:
    'Visit / diagnostics fee only — parts and extra repair work are quoted after inspection.',
  razorpayHint: 'Secure payment by Razorpay · UPI, cards, netbanking',
  consentLine:
    'By paying you agree to our Terms and Cancellation Policy (10% charge applies to cancellations after payment).',
  termsFull:
    'By completing this payment, you agree that your information may be shared with The Computer Care Company and Razorpay for booking administration and payment processing, in accordance with applicable laws and relevant privacy policies. All services and warranty coverage are subject to the applicable terms. Additional repairs and parts replacement require your approval before proceeding. Cancellations after paid bookings are handled per our service terms (including the 10% cancellation charge where applicable).',
  /** TODO(owner): Confirm operational wording for what happens after book/pay. */
  nextSteps: [
    'We’ll call you to confirm the visit',
    'Our technician arrives in your selected slot',
    'We diagnose first and quote before any repair',
  ],
  contact: {
    email: 'thecomputercarecompany@gmail.com',
    phone: '+91 70104 81012',
    phoneTel: '+917010481012',
    whatsApp: '917010481012',
  },
};
