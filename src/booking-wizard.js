import {
  DEVICE_OPTIONS,
  getServiceRule,
  resolveDeviceForPayload,
} from './book-service-config.js';
import { initAddressSearch } from './address-search.js';
import {
  mountFlatChoicePicker,
  mountGroupedChoicePicker,
} from './choice-picker.js';
import {
  getSelectedDate,
  getSelectedTime,
  hasScheduleSelection,
  initBookingSlots,
  resetBookingSlots,
} from './booking-slots.js';
import { submitBookingToSheet } from './booking-submit.js';
import { initVisitFeePayment } from './booking-payment.js';
import { initBookingSuccessCopy, setBookingSuccessPhase } from './booking-success-ui.js';

/**
 * @param {HTMLElement} root
 * @param {{ context?: 'page' | 'modal', onClose?: () => void }} [options]
 */
export function initBookingWizard(root, options = {}) {
  const context = options.context || 'page';
  root.dataset.context = context;
  root.classList.add('booking-wizard-root');

  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => root.querySelectorAll(sel);

  const form = q('#book-form');
  const formError = q('#form-error');
  const successPanel = q('#booking-success');
  const successSummary = q('#booking-success-summary');
  const paymentBlock = q('#booking-payment-block');
  const intro = q('#booking-intro');
  const progressLabel = q('#wizard-progress');
  const progressBar = q('#wizard-progress-bar');
  const progressWrap = q('#wizard-progress-wrap');
  const selectionTrail = q('#wizard-selection-trail');

  const AUTO_ADVANCE_MS = 360;
  let autoAdvanceTimer = null;

  const serviceSelect = q('#service-type');
  const deviceSelect = q('#device-type');
  const servicePickerEl = q('#service-picker');
  const devicePickerEl = q('#device-picker');
  const visitSummary = q('#visit-summary');

  const dismissPage = q('[data-booking-dismiss-page]');
  const dismissModal = q('[data-booking-dismiss-modal]');

  if (context === 'modal') {
    intro?.classList.add('hidden');
    dismissPage?.classList.add('hidden');
    dismissModal?.classList.remove('hidden');
    dismissModal?.addEventListener('click', () => options.onClose?.());
  } else {
    dismissModal?.classList.add('hidden');
  }

  let refreshDevicePicker = () => {};
  let refreshServicePicker = () => {};

  const steps = [...qa('[data-wizard-step]')];
  let stepIndex = 0;
  let stepPlan = ['service', 'device', 'schedule', 'details'];

  function scrollStepIntoView() {
    const scrollHost = root.closest('#booking-modal-mount');
    const activeEl = steps.find(
      (el) => el.dataset.wizardStep === currentStepId() && !el.classList.contains('hidden'),
    );

    if (context === 'modal' && scrollHost) {
      scrollHost.scrollTop = 0;
      window.requestAnimationFrame(() => {
        (activeEl?.querySelector('h2') || activeEl)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
      return;
    }

    if (progressWrap) {
      progressWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function focusFieldForDetailsError(message) {
    if (message.includes('name')) q('#full-name')?.focus();
    else if (message.includes('email')) q('#email')?.focus();
    else if (message.includes('phone') || message.includes('WhatsApp')) q('#phone')?.focus();
    else if (message.includes('address')) q('#address-line')?.focus();
  }

  function showError(message) {
    if (!formError) return;
    formError.textContent = message;
    formError.classList.remove('hidden');
    if (currentStepId() === 'details') {
      focusFieldForDetailsError(message);
    }
    const scrollHost = root.closest('#booking-modal-mount');
    if (scrollHost) {
      scrollHost.scrollTo({ top: 0, behavior: 'smooth' });
    }
    formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearError() {
    if (!formError) return;
    formError.textContent = '';
    formError.classList.add('hidden');
  }

  function rebuildStepPlan() {
    const service = serviceSelect?.value;
    const rule = getServiceRule(service);
    stepPlan = rule.mode === 'fixed'
      ? ['service', 'schedule', 'details']
      : ['service', 'device', 'schedule', 'details'];
  }

  function currentStepId() {
    return stepPlan[stepIndex];
  }

  function truncateLabel(text, max = 36) {
    const s = String(text || '').trim();
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1)}…`;
  }

  function stepIndexForId(stepId) {
    const idx = stepPlan.indexOf(stepId);
    return idx >= 0 ? idx : 0;
  }

  function goToNextStep() {
    if (stepIndex >= stepPlan.length - 1) return;
    showStep(stepIndex + 1);
    if (currentStepId() === 'schedule') updateVisitSummary();
  }

  function scheduleAutoAdvance(fromStepId) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = setTimeout(() => {
      if (currentStepId() !== fromStepId) return;
      const err = validateStep(fromStepId);
      if (err) return;
      goToNextStep();
    }, AUTO_ADVANCE_MS);
  }

  function updateSelectionTrail() {
    if (!selectionTrail) return;

    const items = [];
    const service = serviceSelect?.value;
    if (service) {
      items.push({ step: 'service', label: 'Service', value: truncateLabel(service) });
    }

    const rule = service ? getServiceRule(service) : null;
    if (rule && rule.mode !== 'fixed' && deviceSelect?.value) {
      items.push({ step: 'device', label: 'Device', value: truncateLabel(deviceSelect.value) });
    }

    if (hasScheduleSelection()) {
      items.push({
        step: 'schedule',
        label: 'Visit',
        value: truncateLabel(`${getSelectedDate()} · ${getSelectedTime()}`, 28),
      });
    }

    if (items.length === 0) {
      selectionTrail.classList.add('hidden');
      selectionTrail.innerHTML = '';
      return;
    }

    selectionTrail.classList.remove('hidden');
    selectionTrail.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2.5">
        ${items
          .map(
            (item) => `
          <span class="wizard-trail-chip">
            <span class="min-w-0 truncate"><span class="font-mono text-[10px] uppercase text-slate-400">${item.label}</span> ${item.value}</span>
            <button type="button" class="wizard-trail-change" data-wizard-jump="${item.step}">Edit</button>
          </span>`,
          )
          .join('')}
      </div>`;
  }

  function updateProgress() {
    const id = currentStepId();
    const labels = {
      service: 'What you need',
      device: 'Your device',
      schedule: 'When we visit',
      details: 'Where & contact',
    };
    if (progressLabel) {
      progressLabel.textContent = `Step ${stepIndex + 1} of ${stepPlan.length} — ${labels[id]}`;
    }
    if (progressBar) {
      progressBar.style.width = `${((stepIndex + 1) / stepPlan.length) * 100}%`;
    }
  }

  function showStep(index) {
    stepIndex = index;
    const activeId = currentStepId();
    steps.forEach((el) => {
      const match = el.dataset.wizardStep === activeId;
      el.classList.toggle('hidden', !match);
    });
    updateProgress();
    updateSelectionTrail();
    clearError();

    scrollStepIntoView();
  }

  function populateDeviceOptions(serviceValue) {
    if (!deviceSelect) return;
    const rule = getServiceRule(serviceValue);
    const group = DEVICE_OPTIONS[rule.group] || DEVICE_OPTIONS.all;
    deviceSelect.innerHTML = '';
    group.forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      deviceSelect.appendChild(opt);
    });
    if (group.length) {
      deviceSelect.value = group[0].value;
    }
    refreshDevicePicker();
  }

  function updateVisitSummary() {
    const service = serviceSelect?.value;
    if (!service || !visitSummary) return;
    const rule = getServiceRule(service);
    const deviceLine =
      rule.mode === 'fixed'
        ? rule.fixedLabel
        : deviceSelect?.value || 'Device — next step';
    visitSummary.textContent = `${service} · ${deviceLine}`;
    visitSummary.classList.remove('hidden');
  }

  function applyServiceChange() {
    const service = serviceSelect?.value;
    if (!service) return;
    const rule = getServiceRule(service);
    rebuildStepPlan();

    if (rule.mode !== 'fixed') {
      populateDeviceOptions(service);
    }
    updateVisitSummary();
  }

  function validateStep(id) {
    if (id === 'service') {
      if (!serviceSelect?.value) return 'Please choose a service to continue.';
    }
    if (id === 'device') {
      if (!deviceSelect?.value) return 'Please tell us which device we should expect.';
    }
    if (id === 'schedule') {
      if (!hasScheduleSelection()) {
        return 'Pick a recommended slot, or tap “Choose date & time” and select when we should visit.';
      }
    }
    if (id === 'details') {
      const name = q('#full-name')?.value.trim();
      const email = q('#email')?.value.trim();
      const phone = q('#phone')?.value.trim();
      const address = q('#address-line')?.value.trim();
      if (!name) return 'Please enter your name.';
      if (!email) return 'Please enter your email.';
      if (!phone) return 'Please enter a phone or WhatsApp number.';
      if (!address) return 'Please add your service address in Chennai.';
    }
    return null;
  }

  function collectPayload() {
    const service = serviceSelect?.value;
    const device = resolveDeviceForPayload(service, deviceSelect?.value);
    return {
      service,
      device,
      date: getSelectedDate(),
      time: getSelectedTime(),
      name: q('#full-name')?.value.trim(),
      email: q('#email')?.value.trim(),
      phone: q('#phone')?.value.trim(),
      address: q('#address-line')?.value.trim(),
      landmark: q('#landmark')?.value.trim(),
      notes: q('#notes')?.value.trim(),
    };
  }

  function bindWizardButtons() {
    qa('[data-wizard-next]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const err = validateStep(currentStepId());
        if (err) {
          showError(err);
          return;
        }
        goToNextStep();
      });
    });

    deviceSelect?.addEventListener('change', updateVisitSummary);

    qa('[data-wizard-back]').forEach((btn) => {
      btn.addEventListener('click', () => {
        clearTimeout(autoAdvanceTimer);
        if (stepIndex > 0) showStep(stepIndex - 1);
      });
    });

    selectionTrail?.addEventListener('click', (event) => {
      const jumpBtn = event.target.closest('[data-wizard-jump]');
      if (!jumpBtn) return;
      clearTimeout(autoAdvanceTimer);
      const stepId = jumpBtn.getAttribute('data-wizard-jump');
      if (stepId) showStep(stepIndexForId(stepId));
    });
  }

  if (serviceSelect) {
    serviceSelect.addEventListener('change', () => {
      applyServiceChange();
    });
  }

  if (servicePickerEl && serviceSelect) {
    refreshServicePicker = mountGroupedChoicePicker(servicePickerEl, serviceSelect, {
      onChange: () => {
        applyServiceChange();
        if (currentStepId() === 'service') scheduleAutoAdvance('service');
      },
    });
  }

  if (devicePickerEl && deviceSelect) {
    refreshDevicePicker = mountFlatChoicePicker(devicePickerEl, deviceSelect, {
      onChange: () => {
        updateVisitSummary();
        if (currentStepId() === 'device') scheduleAutoAdvance('device');
      },
    });
  }

  const primeContainer = q('#prime-slots');
  const dateListEl = q('#date-list');
  const timeGridEl = q('#time-grid');
  const slotSelectionSummary = q('#slot-selection-summary');
  const primeSelectionSummary = q('#slot-selection-summary-prime');
  const customSchedulePanel = q('#custom-schedule-panel');
  const customScheduleToggle = q('#schedule-custom-toggle');

  if (primeContainer && dateListEl && timeGridEl) {
    initBookingSlots({
      primeContainer,
      dateListEl,
      timeGridEl,
      selectionSummaryEl: slotSelectionSummary,
      primeSummaryEl: primeSelectionSummary,
      customPanelEl: customSchedulePanel,
      customToggleEl: customScheduleToggle,
      onChange: () => {
        clearError();
        updateSelectionTrail();
        if (currentStepId() === 'schedule' && hasScheduleSelection()) {
          scheduleAutoAdvance('schedule');
        }
      },
    });
  }

  initAddressSearch(
    q('#address-search'),
    q('#address-suggestions'),
    (line) => {
      const lineInput = q('#address-line');
      if (lineInput) lineInput.value = line;
    },
  );

  bindWizardButtons();
  applyServiceChange();
  showStep(0);

  let paymentContext = { payload: {}, bookingKey: '' };
  const visitFeePayment = initVisitFeePayment(root, {
    getContext: () => paymentContext,
  });

  const submitBtn = q('#submit-booking');
  const submitBtnDefaultLabel = submitBtn?.textContent?.trim() || 'Submit booking request';
  const successHeading = q('#booking-success-heading');

  initBookingSuccessCopy(root);

  function showBookingSuccess(payload, bookingKey) {
    intro?.classList.add('hidden');
    setBookingSuccessPhase(root, true);

    const landmark = payload.landmark ? ` · ${payload.landmark}` : '';
    if (successSummary) {
      successSummary.textContent =
        `${payload.service} · ${payload.device} · ${payload.date} at ${payload.time} · ${payload.name}${landmark}`;
    }
    if (successHeading) successHeading.textContent = 'Booking saved';
    successPanel?.classList.remove('hidden');
    paymentBlock?.classList.add('hidden');

    paymentContext = { payload, bookingKey };
    visitFeePayment?.refresh(payload, bookingKey);

    const scrollHost = root.closest('#booking-modal-mount');
    if (scrollHost) scrollHost.scrollTop = 0;
    successPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearError();
      const err = validateStep('details');
      if (err) {
        showError(err);
        return;
      }

      const payload = collectPayload();
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }

      const result = await submitBookingToSheet(payload);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtnDefaultLabel;
      }

      if (!result.ok) {
        showError(result.message);
        return;
      }

      showBookingSuccess(payload, result.bookingKey || '');
    });
  }

  function reset() {
    form?.reset();
    if (serviceSelect) {
      serviceSelect.value = '';
    }
    clearTimeout(autoAdvanceTimer);
    if (context === 'modal') {
      intro?.classList.add('hidden');
    } else {
      intro?.classList.remove('hidden');
    }
    form?.classList.remove('hidden');
    successPanel?.classList.add('hidden');
    setBookingSuccessPhase(root, false);
    clearError();
    refreshServicePicker();
    applyServiceChange();
    resetBookingSlots();
    showStep(0);
    const scrollHost = root.closest('#booking-modal-mount');
    if (scrollHost) scrollHost.scrollTop = 0;
  }

  return { reset, showStep };
}
