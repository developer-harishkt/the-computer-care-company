/** Device handling per service value (must match option values in book.html). */
export const SERVICE_RULES = {
  // Diagnosis & Repairs
  'Standard diagnosis / Unknown problems': { mode: 'choose', group: 'all' },
  'Hardware repair & maintenance': { mode: 'choose', group: 'hardware' },
  'OS & software care': { mode: 'choose', group: 'computers' },
  'Network & security': { mode: 'choose', group: 'netsec' },
  'Backup & recovery': { mode: 'choose', group: 'backup' },
  // New Systems & Infrastructure
  'Custom PC': { mode: 'choose', group: 'desktops' },
  'Storage / NAS setup': { mode: 'fixed', fixedLabel: 'Storage / NAS' },
  'Network setup': { mode: 'fixed', fixedLabel: 'Home or office Wi‑Fi / network' },
  'CCTV installation': { mode: 'fixed', fixedLabel: 'CCTV / security cameras' },
  'Server build': { mode: 'fixed', fixedLabel: 'Server' },
  // Business & Personal Care
  Subscriptions: { mode: 'fixed', fixedLabel: 'Subscription plan' },
  'AMC & corporate solutions': { mode: 'fixed', fixedLabel: 'Business — multiple devices' },
};

/** Apple/Mac: OS & software and Network & security only (Karthik, Modifications 3-11-26). */
export const DEVICE_OPTIONS = {
  all: [
    { value: 'Windows laptop', label: 'Windows laptop' },
    { value: 'Gaming laptop', label: 'Gaming laptop' },
    { value: 'Desktop PC', label: 'Desktop PC' },
    { value: 'All-in-one desktop', label: 'All-in-one desktop' },
    { value: 'Other', label: 'Other / not sure' },
  ],
  computers: [
    { value: 'Windows laptop', label: 'Windows laptop' },
    { value: 'MacBook / Apple laptop', label: 'MacBook / Apple laptop' },
    { value: 'Gaming laptop', label: 'Gaming laptop' },
    { value: 'Desktop PC', label: 'Desktop PC' },
    { value: 'All-in-one desktop', label: 'All-in-one desktop' },
  ],
  backup: [
    { value: 'Windows laptop', label: 'Windows laptop' },
    { value: 'Gaming laptop', label: 'Gaming laptop' },
    { value: 'Desktop PC', label: 'Desktop PC' },
    { value: 'All-in-one desktop', label: 'All-in-one desktop' },
  ],
  hardware: [
    { value: 'Windows laptop', label: 'Windows laptop' },
    { value: 'Gaming laptop', label: 'Gaming laptop' },
    { value: 'Desktop PC', label: 'Desktop PC' },
    { value: 'All-in-one desktop', label: 'All-in-one desktop' },
    { value: 'Printer / scanner', label: 'Printer / scanner' },
    { value: 'Other', label: 'Other' },
  ],
  netsec: [
    { value: 'Windows laptop', label: 'Windows laptop' },
    { value: 'MacBook / Apple laptop', label: 'MacBook / Apple laptop' },
    { value: 'Desktop PC', label: 'Desktop PC' },
    { value: 'Home or office Wi‑Fi / network', label: 'Wi‑Fi / network' },
    { value: 'CCTV / security cameras', label: 'CCTV / security cameras' },
    { value: 'Other', label: 'Other / not sure' },
  ],
  desktops: [
    { value: 'Desktop PC', label: 'Desktop PC (tower)' },
    { value: 'All-in-one desktop', label: 'All-in-one desktop' },
    { value: 'Custom build (new)', label: 'New custom build' },
  ],
};

/** Old service names (before the Nov 2026 regroup) → new names. */
const LEGACY_SERVICE_ALIASES = {
  'Standard diagnostics / check-up': 'Standard diagnosis / Unknown problems',
  'Laptop or desktop servicing (cleaning)': 'Hardware repair & maintenance',
  'Hardware repair (screen, battery, keyboard, etc.)': 'Hardware repair & maintenance',
  'Component install (RAM / SSD / GPU)': 'Hardware repair & maintenance',
  'Printer setup or repair': 'Hardware repair & maintenance',
  'OS installations & Fixes': 'OS & software care',
  'Software setups': 'OS & software care',
  'Software / OS issue': 'OS & software care',
  'Application setup': 'OS & software care',
  'Virus removal & security': 'Network & security',
  'Data recovery assessment': 'Backup & recovery',
  'Custom PC build / upgrade consultation': 'Custom PC',
  'Wi-Fi / network setup': 'Network setup',
  'Corporate / AMC enquiry': 'AMC & corporate solutions',
  Other: 'Standard diagnosis / Unknown problems',
};

export function normalizeService(serviceValue) {
  return LEGACY_SERVICE_ALIASES[serviceValue] || serviceValue;
}

export function getServiceRule(serviceValue) {
  return SERVICE_RULES[normalizeService(serviceValue)] || { mode: 'choose', group: 'all' };
}

export function resolveDeviceForPayload(serviceValue, deviceSelectValue, fixedDisplay) {
  const rule = getServiceRule(serviceValue);
  if (rule.mode === 'fixed') return rule.fixedLabel;
  return deviceSelectValue || fixedDisplay || 'Not specified';
}

/** On-site visit fee in INR (parts and repair work quoted after inspection). Must match Code.gs. */
export const DEFAULT_VISIT_FEE_INR = 189;

/** Hardware jobs have their own prices. Sent under these names; Code.gs prices them the same way. */
export const HARDWARE_SERVICE = 'Hardware repair & maintenance';
export const CLEANING_SERVICE = 'Laptop or desktop servicing (cleaning)';
export const COMPONENT_INSTALL_SERVICE = 'Component install (RAM / SSD / GPU)';

/*
 * Service ₹549–699 and component installation from ₹259 (Karthik, Modifications 3-11-26).
 * ASSUMED until Karthik confirms the split: Desktop ₹549, every other device ₹699; components ₹259 online,
 * extra parts quoted on the visit. Must match Code.gs getVisitFeePaise().
 */
const CLEANING_FEE_BY_DEVICE = {
  'Desktop PC': 549,
  'MacBook / Apple laptop': 699,
  'Gaming laptop': 699,
  'Windows laptop': 699,
  'All-in-one desktop': 699,
  Other: 699,
  'Other / not sure': 699,
};
const COMPONENT_INSTALL_FEE_INR = 259;

/** Services with no online visit fee (sales follow-up). */
const NO_ONLINE_FEE_SERVICES = new Set([
  'Subscriptions',
  'AMC & corporate solutions',
  'Branch visit (free diagnosis)',
]);

/**
 * @param {string | undefined} service
 * @param {string | undefined} device Used for servicing / cleaning (price depends on device).
 * @returns {{ amountInr: number, label: string } | null} null = skip payment step
 */
export function getVisitFee(service, device) {
  if (service === CLEANING_SERVICE) {
    return { amountInr: CLEANING_FEE_BY_DEVICE[device] ?? 699, label: 'Service fee' };
  }
  if (service === COMPONENT_INSTALL_SERVICE) {
    return { amountInr: COMPONENT_INSTALL_FEE_INR, label: 'Component installation fee' };
  }
  const key = normalizeService(service);
  if (!key || NO_ONLINE_FEE_SERVICES.has(key)) return null;
  return { amountInr: DEFAULT_VISIT_FEE_INR, label: 'Diagnostic fee' };
}

export function formatInr(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ── "What would you like us to take care of?" (Karthik, Modifications 3-11-26) ──────────────
 * An extra step after the service. "Other" is added to every list and always continues on WhatsApp.
 * whatsappOnly: every option continues on WhatsApp (no online booking for these yet).
 * The chosen option is saved in the booking notes, so Code.gs needs no change.
 */
export const WHATSAPP_NUMBER = '917010481012';
export const OTHER_TASK = 'Other';

const TAKE_CARE = 'What would you like us to take care of?';
const BUILDING = 'What are we building for you today?';

export const SERVICE_TASKS = {
  'OS & software care': {
    question: TAKE_CARE,
    options: [
      'OS Inspection & Fixes',
      'OS Installation, Upgrades & Migration',
      'OS Customisation & Dual Boot',
      'OS Maintenance & Cleanup',
      'Software Installation & Setup',
    ],
  },
  'Network & security': {
    question: TAKE_CARE,
    options: [
      'Network Setup & Configuration',
      'Wi-Fi & Mesh Setup',
      'Network Troubleshooting & Support',
      'Network Optimisation & Expansion',
      'Network Security Configuration',
    ],
  },
  'Backup & recovery': {
    question: TAKE_CARE,
    options: [
      'SSD / Hard Disk & NAS Services',
      'System, External & Cloud Backup',
      'Data Migration & Transfer',
      'Backup Restoration',
      'Data Recovery & Assessment',
    ],
  },
  'Custom PC': {
    question: BUILDING,
    whatsappOnly: true,
    options: [
      'Budget, System & Mini PC Builds',
      'Gaming & Water-Cooled Builds',
      'Creator, Professional & AI Workstations',
      'Custom Keyboards & Keycaps',
      'Speakers, Monitors & Audio Interfaces',
      'Microphones, DACs & Audio Accessories',
    ],
  },
  'Storage / NAS setup': {
    question: BUILDING,
    whatsappOnly: true,
    options: ['NAS installation & setup', 'Custom NAS Build'],
  },
  'Network setup': {
    question: BUILDING,
    whatsappOnly: true,
    options: [
      'Structured Cabling & Ethernet Setup',
      'Network Rack & Switch Installation',
      'Wireless Access Point Installation',
      'Firewall & VPN Configuration',
      'Multi-WAN & Internet Failover Setup',
    ],
  },
  'CCTV installation': {
    question: BUILDING,
    whatsappOnly: true,
    options: [
      'IP Camera & PoE Networking',
      'Smart CCTV & Mobile App Configuration',
      'Camera Upgrades & System Expansion',
      'NVR/DVR & Storage Management',
    ],
  },
};

/** Services that go straight to WhatsApp when tapped. */
export const WHATSAPP_ONLY_SERVICES = new Set(['Server build']);

export function getServiceTasks(serviceValue) {
  return SERVICE_TASKS[serviceValue] || null;
}

/** True when this task choice must continue on WhatsApp instead of the booking form. */
export function isWhatsAppTask(serviceValue, task) {
  const cfg = getServiceTasks(serviceValue);
  return Boolean(cfg && task && (cfg.whatsappOnly || task === OTHER_TASK));
}

export function whatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Prefilled WhatsApp message for a service (+ optional task / device). */
export function whatsAppMessage(service, task) {
  if (!task) return `Hi, I'd like to enquire about: ${service}`;
  if (task === OTHER_TASK) return `Hi, I'd like help with ${service} — something not listed: `;
  return `Hi, I'd like help with: ${service} – ${task}`;
}
