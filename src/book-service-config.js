/** Device handling per service value (must match option values in book.html). */
export const SERVICE_RULES = {
  'Standard diagnostics / check-up': { mode: 'choose', group: 'all' },
  'Laptop or desktop servicing (cleaning)': { mode: 'choose', group: 'all' },
  'OS installations & Fixes': { mode: 'choose', group: 'computers' },
  'Virus removal & security': { mode: 'choose', group: 'computers' },
  'Software setups': { mode: 'choose', group: 'computers' },
  'Hardware repair (screen, battery, keyboard, etc.)': { mode: 'choose', group: 'all' },
  'Component install (RAM / SSD / GPU)': { mode: 'choose', group: 'computers' },
  'Custom PC build / upgrade consultation': { mode: 'choose', group: 'desktops' },
  'Data recovery assessment': { mode: 'choose', group: 'computers' },
  'Printer setup or repair': { mode: 'fixed', fixedLabel: 'Printer / scanner (on-site)' },
  'Wi-Fi / network setup': { mode: 'fixed', fixedLabel: 'Home or office Wi‑Fi / network' },
  'CCTV installation': { mode: 'fixed', fixedLabel: 'CCTV / security cameras' },
  'Corporate / AMC enquiry': { mode: 'fixed', fixedLabel: 'Business — multiple devices' },
  Other: { mode: 'choose', group: 'all' },
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
  desktops: [
    { value: 'Desktop PC', label: 'Desktop PC (tower)' },
    { value: 'All-in-one desktop', label: 'All-in-one desktop' },
    { value: 'Custom build (new)', label: 'New custom build' },
  ],
};

const LEGACY_SERVICE_ALIASES = {
  'Software / OS issue': 'OS installations & Fixes',
  'Application setup': 'Software setups',
};

export function getServiceRule(serviceValue) {
  const key = LEGACY_SERVICE_ALIASES[serviceValue] || serviceValue;
  return SERVICE_RULES[key] || { mode: 'choose', group: 'all' };
}

export function resolveDeviceForPayload(serviceValue, deviceSelectValue, fixedDisplay) {
  const rule = getServiceRule(serviceValue);
  if (rule.mode === 'fixed') return rule.fixedLabel;
  return deviceSelectValue || fixedDisplay || 'Not specified';
}

/** On-site visit / booking fee in INR (align with docs/pricing; repair parts extra). */
const CLEANING_FEE_BY_DEVICE = {
  'Desktop PC': 599,
  'MacBook / Apple laptop': 999,
  'Gaming laptop': 999,
  'Windows laptop': 699,
  'All-in-one desktop': 1099,
  Other: 699,
  'Other / not sure': 699,
};

const DEFAULT_VISIT_FEE_INR = 199;
const COMPONENT_INSTALL_FEE_INR = 600;

/** Services with no online visit fee (sales follow-up). */
const NO_ONLINE_FEE_SERVICES = new Set(['Corporate / AMC enquiry']);

/**
 * @param {string | undefined} service
 * @param {string | undefined} device Resolved device label for payload
 * @returns {{ amountInr: number, label: string } | null} null = skip payment step
 */
export function getVisitFee(service, device) {
  if (!service || NO_ONLINE_FEE_SERVICES.has(service)) return null;

  if (service === 'Laptop or desktop servicing (cleaning)') {
    const amountInr = CLEANING_FEE_BY_DEVICE[device] ?? 699;
    return { amountInr, label: 'Servicing visit fee' };
  }

  if (service === 'Component install (RAM / SSD / GPU)') {
    return { amountInr: COMPONENT_INSTALL_FEE_INR, label: 'Component install visit fee' };
  }

  return { amountInr: DEFAULT_VISIT_FEE_INR, label: 'Visit / diagnostics fee' };
}

export function formatInr(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
