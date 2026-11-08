/**
 * Check form fields as soon as they are touched, not only on Submit (Third Modification).
 * - Leaving a field (blur) shows its error right under it.
 * - While a field shows an error, it is re-checked on every keystroke, so the error clears the moment it is fixed.
 * - `eager` fields (the mobile number) are also checked while typing once the value looks complete.
 * Uses the same validators as Submit, so the rules never differ.
 */

import { track } from './analytics.js';

const ERROR_CLASS = 'field-error';

function errorElFor(el) {
  const id = `${el.id}-error`;
  let msg = document.getElementById(id);
  if (!msg) {
    msg = document.createElement('p');
    msg.id = id;
    msg.className = `${ERROR_CLASS} hidden`;
    msg.setAttribute('aria-live', 'polite');
    el.insertAdjacentElement('afterend', msg);
  }
  return msg;
}

export function setFieldError(el, message) {
  if (!el) return;
  const msg = errorElFor(el);
  msg.textContent = message;
  msg.classList.remove('hidden');
  el.classList.add('is-invalid');
  el.setAttribute('aria-invalid', 'true');
  const described = new Set((el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  described.add(msg.id);
  el.setAttribute('aria-describedby', [...described].join(' '));
}

export function clearFieldError(el) {
  if (!el) return;
  el.classList.remove('is-invalid');
  el.removeAttribute('aria-invalid');
  const msg = document.getElementById(`${el.id}-error`);
  if (msg) {
    msg.textContent = '';
    msg.classList.add('hidden');
  }
}

export function hasFieldError(el) {
  return Boolean(el?.classList.contains('is-invalid'));
}

/**
 * @param {Array<{ el: HTMLInputElement | HTMLTextAreaElement | null, validate: (value: string) => string | null, eager?: (value: string) => boolean }>} fields
 * @param {{ onChange?: (el: HTMLElement, message: string | null) => void, skipBlurFrom?: string }} [options]
 *   skipBlurFrom: selector for buttons (Back / Cancel) that should not trigger a check when focus moves to them.
 */
export function attachLiveValidation(fields, { onChange, skipBlurFrom } = {}) {
  fields.forEach(({ el, validate, eager }) => {
    if (!el) return;
    let lastTracked = '';
    const run = () => {
      const message = validate(el.value);
      // Analytics: which fields trip people up while typing (once per new message, never the value).
      if (message && message !== lastTracked) {
        track('form_field_error', { field: el.id, form: el.form?.id || '', message });
      }
      lastTracked = message || '';
      if (message) setFieldError(el, message);
      else clearFieldError(el);
      onChange?.(el, message);
    };
    el.addEventListener('blur', (event) => {
      if (skipBlurFrom && event.relatedTarget?.closest?.(skipBlurFrom)) return;
      run();
    });
    el.addEventListener('input', () => {
      if (hasFieldError(el) || eager?.(el.value)) run();
    });
  });
}

/** The mobile number is checked while typing once 10 digits are in. */
export const eagerPhone = (value) => String(value || '').replace(/\D/g, '').length >= 10;
