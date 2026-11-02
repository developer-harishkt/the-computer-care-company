/** Device handling per service value (must match option values in book.html). */
export const SERVICE_RULES = {
  // Diagnosis & Repairs
  'Standard diagnosis / Unknown problems': { mode: 'choose', group: 'all' },
  'Hardware repair & maintenance': { mode: 'choose', group: 'hardware' },
  'OS & software care': { mode: 'choose', group: 'computers' },
  'Network & security': { mode: 'choose', group: 'netsec' },
  'Backup & recovery': { mode: 'choose', group: 'computers' },
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

export const DEVICE_OPTIONS = {
  all: [
    { value: 'Windows laptop', label: 'Windows laptop' },
    { value: 'MacBook / Apple laptop', label: 'MacBook / Apple laptop' },
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
  hardware: [
    { value: 'Windows laptop', label: 'Windows laptop' },
    { value: 'MacBook / Apple laptop', label: 'MacBook / Apple laptop' },
    { value: 'Gaming laptop', label: 'Gaming laptop' },
    { value: 'Desktop PC', label: 'Desktop PC' },
    { value: 'All-in-one desktop', label: 'All-in-one desktop' },
    { value: 'Printer / scanner', label: 'Printer / scanner' },
    { value: 'Other', label: 'Other / not sure' },
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

/** Services with no online visit fee (sales follow-up). */
const NO_ONLINE_FEE_SERVICES = new Set(['Subscriptions', 'AMC & corporate solutions']);

/**
 * @param {string | undefined} service
 * @param {string | undefined} _device Kept for call-site compatibility; the fee no longer depends on device.
 * @returns {{ amountInr: number, label: string } | null} null = skip payment step
 */
export function getVisitFee(service, _device) {
  const key = normalizeService(service);
  if (!key || NO_ONLINE_FEE_SERVICES.has(key)) return null;
  return { amountInr: DEFAULT_VISIT_FEE_INR, label: 'Visit / diagnostics fee' };
}

export function formatInr(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
