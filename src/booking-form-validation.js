const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 120,
  addressMin: 12,
  addressMax: 400,
  landmarkMax: 120,
  notesMax: 800,
};

/**
 * @param {string} raw
 * @returns {{ ok: true, normalized: string } | { ok: false, message: string }}
 */
export function normalizeIndianMobile(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let ten = digits;
  if (digits.length === 12 && digits.startsWith('91')) ten = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) ten = digits.slice(1);

  if (ten.length !== 10) {
    return { ok: false, message: 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210).' };
  }
  if (!/^[6-9]/.test(ten)) {
    return { ok: false, message: 'Mobile number should start with 6, 7, 8, or 9.' };
  }
  return { ok: true, normalized: ten };
}

/**
 * @param {string} email
 * @returns {string | null} error message
 */
export function validateEmail(email) {
  const value = String(email || '').trim();
  if (!value) return 'Please enter your email.';
  if (value.length > LIMITS.emailMax) return 'Email is too long.';
  if (!EMAIL_RE.test(value)) return 'Enter a valid email address (e.g. you@example.com).';
  return null;
}

/**
 * @param {string} name
 * @returns {string | null}
 */
export function validateName(name) {
  const value = String(name || '').trim().replace(/\s+/g, ' ');
  if (!value) return 'Please enter your name.';
  if (value.length < LIMITS.nameMin) return 'Name should be at least 2 characters.';
  if (value.length > LIMITS.nameMax) return 'Name is too long.';
  if (/^\d+$/.test(value)) return 'Please enter your real name, not only numbers.';
  return null;
}

/**
 * @param {string} address
 * @returns {string | null}
 */
export function validateAddress(address) {
  const value = String(address || '').trim().replace(/\s+/g, ' ');
  if (!value) return 'Please add your service address in Chennai.';
  if (value.length < LIMITS.addressMin) {
    return 'Please enter a fuller address (flat/door, street, area).';
  }
  if (value.length > LIMITS.addressMax) return 'Address is too long.';
  return null;
}

/**
 * @param {string} [landmark]
 * @returns {string | null}
 */
export function validateLandmark(landmark) {
  const value = String(landmark || '').trim();
  if (value.length > LIMITS.landmarkMax) return 'Landmark is too long.';
  return null;
}

/**
 * @param {string} [notes]
 * @returns {string | null}
 */
export function validateNotes(notes) {
  const value = String(notes || '').trim();
  if (value.length > LIMITS.notesMax) return 'Notes are too long — keep it under 800 characters.';
  return null;
}

/**
 * @param {{ name?: string, email?: string, phone?: string, address?: string, landmark?: string, notes?: string }} fields
 * @returns {{ ok: true, normalized: { name: string, email: string, phone: string, address: string, landmark: string, notes: string } } | { ok: false, message: string, fieldId?: string }}
 */
export function validateBookingDetails(fields) {
  const nameErr = validateName(fields.name);
  if (nameErr) return { ok: false, message: nameErr, fieldId: 'full-name' };

  const phoneResult = normalizeIndianMobile(fields.phone);
  if (!phoneResult.ok) return { ok: false, message: phoneResult.message, fieldId: 'phone' };

  const emailErr = validateEmail(fields.email);
  if (emailErr) return { ok: false, message: emailErr, fieldId: 'email' };

  const addressErr = validateAddress(fields.address);
  if (addressErr) return { ok: false, message: addressErr, fieldId: 'address-line' };

  const landmarkErr = validateLandmark(fields.landmark);
  if (landmarkErr) return { ok: false, message: landmarkErr, fieldId: 'landmark' };

  const notesErr = validateNotes(fields.notes);
  if (notesErr) return { ok: false, message: notesErr, fieldId: 'notes' };

  return {
    ok: true,
    normalized: {
      name: String(fields.name || '').trim().replace(/\s+/g, ' '),
      email: String(fields.email || '').trim(),
      phone: phoneResult.normalized,
      address: String(fields.address || '').trim().replace(/\s+/g, ' '),
      landmark: String(fields.landmark || '').trim(),
      notes: String(fields.notes || '').trim(),
    },
  };
}
