/**
 * Website analytics (PostHog) — what visitors read, where they tap, where booking stops.
 *
 * Privacy (see privacy.html, "Analytics"):
 * - Session recordings mask every typed value, plus the booking summary (name / phone / address).
 * - WhatsApp links carry a prefilled message that can include the customer's name, so their text is
 *   stripped from every event and the post-booking redirect notes are left out of recordings.
 * - We never identify visitors: they stay anonymous.
 *
 * Off on localhost and in automated browsers (our Playwright tests) so test runs never reach the data.
 *   ?analytics=off  → this browser stops sending (use on your own phone/laptop so you don't count yourself)
 *   ?analytics=on   → undo that
 *   ?analytics=test → send even from localhost / automated browsers; events carry is_test=true
 *
 * posthog-js is loaded after the page is idle so it never slows the first paint or the first tap;
 * calls made before it loads are queued.
 */

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'phc_qV46rx8LKWJWGqTYkDCnB7Y9QEykKTxS4YVEWD5oaYAD';
const POSTHOG_HOST = 'https://us.i.posthog.com';

const OFF_KEY = 'tccc-analytics-off';
const TEST_KEY = 'tccc-analytics-test';

/** Personal text on screen: masked in recordings. */
const MASK_TEXT_SELECTOR = '#booking-success-summary, [data-analytics-mask]';
/** Elements whose links carry the customer's name: left out of recordings. */
const BLOCK_SELECTOR = '#booking-success-redirect, #plan-enquiry-done';

const queue = [];
let posthog = null;
let enabled = false;
let testMode = false;

function storage(kind) {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function readModeFromUrl() {
  const mode = new URLSearchParams(window.location.search).get('analytics');
  if (mode === 'off') storage('local')?.setItem(OFF_KEY, '1');
  if (mode === 'on') storage('local')?.removeItem(OFF_KEY);
  if (mode === 'test') storage('session')?.setItem(TEST_KEY, '1');
}

function shouldRun() {
  readModeFromUrl();
  if (storage('local')?.getItem(OFF_KEY) === '1') return false;
  testMode = storage('session')?.getItem(TEST_KEY) === '1';
  if (testMode) return true;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '' || host.endsWith('.local')) return false;
  if (navigator.webdriver) return false;
  return true;
}

/** wa.me/<number>?text=… → wa.me/<number> (the message can contain the customer's name). */
const WA_TEXT = /(wa\.me\/\d+)\?[^\s"';]*/g;

function scrub(value, depth = 0) {
  if (typeof value === 'string') return value.replace(WA_TEXT, '$1');
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = scrub(v, depth + 1);
  return out;
}

function beforeSend(event) {
  if (!event) return event;
  if (event.properties) event.properties = scrub(event.properties);
  if (event.$set) event.$set = scrub(event.$set);
  // Test mode only: echo each event to the console so a check can see events sent while leaving a page.
  if (testMode && event.event !== '$snapshot') console.debug('[tccc-analytics]', event.event, JSON.stringify(event.properties || {}));
  return event;
}

async function load() {
  try {
    const mod = await import('posthog-js');
    posthog = mod.default;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: '2026-08-30',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true, // carries how far down the page each visitor scrolled
      autocapture: true,
      rageclick: true,
      capture_dead_clicks: true,
      enable_heatmaps: true,
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: MASK_TEXT_SELECTOR,
        blockSelector: BLOCK_SELECTOR,
      },
      // Not used on this site: don't download them.
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_web_experiments: true,
      before_send: beforeSend,
      disable_compression: testMode,
      // Our test browser is "headless", which PostHog drops as a bot; only lift that in test mode.
      opt_out_useragent_filter: testMode,
    });
    posthog.register({
      site_area: window.location.pathname.replace(/\.html$/, '') || '/',
      ...(testMode ? { is_test: true } : {}),
    });
    while (queue.length) {
      const [name, props] = queue.shift();
      posthog.capture(name, props);
    }
  } catch {
    enabled = false;
    queue.length = 0;
  }
}

/**
 * Record one event. Safe to call before analytics has loaded, and a no-op when analytics is off.
 * Never pass personal details (name, phone, email, address, notes).
 * @param {string} name
 * @param {Record<string, unknown>} [props]
 */
export function track(name, props = {}) {
  if (!enabled) return;
  if (posthog) posthog.capture(name, props);
  else if (queue.length < 100) queue.push([name, props]);
}

/** Which part of the page an element sits in: its section id, else the section's heading. */
export function sectionOf(el) {
  if (!el?.closest) return '';
  if (el.closest('#booking-modal, #booking-wizard-root')) return 'booking';
  if (el.closest('#plan-enquiry, dialog')) return 'popup';
  if (el.closest('header')) return 'header';
  if (el.closest('footer')) return 'footer';
  const section = el.closest('section');
  if (!section) return '';
  return sectionLabel(section);
}

function sectionLabel(section) {
  if (section.id) return section.id;
  const heading = section.querySelector('h1, h2');
  const text = (heading?.textContent || '').trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, 40) : 'section';
}

function linkChannel(href) {
  if (/wa\.me|whatsapp\.com/i.test(href)) return 'whatsapp';
  if (/^tel:/i.test(href)) return 'call';
  if (/^mailto:/i.test(href)) return 'mail';
  if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/i.test(href)) return 'directions';
  if (/instagram\.com|facebook\.com|youtube\.com|linkedin\.com|x\.com|twitter\.com/i.test(href)) return 'social';
  return '';
}

function linkLabel(el) {
  return (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

/** WhatsApp / Call / Mail / Directions taps, with the page and section they came from. */
function watchContactTaps() {
  document.addEventListener(
    'click',
    (event) => {
      const link = event.target?.closest?.('a[href]');
      // Links that open our own popups keep a WhatsApp fallback href; those are counted by the popup.
      if (!link || link.matches('[data-plan-enquire], [data-open-booking]')) return;
      const channel = linkChannel(link.getAttribute('href') || '');
      if (!channel) return;
      track('contact_tap', { channel, section: sectionOf(link), label: linkLabel(link) });
    },
    { capture: true },
  );
}

/**
 * "Section seen": fires once per page view when a section has been on screen for 5 seconds
 * (half of it visible, or it fills half the screen) — a sign the visitor stopped to read it.
 */
const SEEN_AFTER_MS = 5000;

function watchSectionsSeen() {
  if (!('IntersectionObserver' in window)) return;
  const sections = [...document.querySelectorAll('main section, body > section')];
  if (!sections.length) return;
  const timers = new Map();
  const seen = new Set();
  const order = new Map(sections.map((s, i) => [s, i + 1]));

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target;
        if (seen.has(el)) continue;
        const viewH = entry.rootBounds?.height || window.innerHeight;
        const reading =
          entry.isIntersecting &&
          (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= viewH * 0.5);
        if (reading && !timers.has(el)) {
          timers.set(
            el,
            window.setTimeout(() => {
              timers.delete(el);
              seen.add(el);
              observer.unobserve(el);
              track('section_seen', { section: sectionLabel(el), position: order.get(el) });
            }, SEEN_AFTER_MS),
          );
        } else if (!reading && timers.has(el)) {
          window.clearTimeout(timers.get(el));
          timers.delete(el);
        }
      }
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  sections.forEach((s) => observer.observe(s));
}

function start() {
  enabled = shouldRun();
  if (!enabled) return;
  watchContactTaps();
  watchSectionsSeen();
  const go = () => void load();
  if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 2500 });
  else window.setTimeout(go, 1200);
}

start();
