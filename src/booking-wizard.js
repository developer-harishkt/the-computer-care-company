import {
  CLEANING_SERVICE,
  COMPONENT_INSTALL_SERVICE,
  HARDWARE_SERVICE,
  DEVICE_OPTIONS,
  getServiceRule,
  formatInr,
  getVisitFee,
  resolveDeviceForPayload,
  getServiceTasks,
  isWhatsAppTask,
  OTHER_TASK,
  WHATSAPP_ONLY_SERVICES,
  whatsAppMessage,
  whatsAppUrl,
  AFTER_BOOKING_REDIRECTS,
} from './book-service-config.js';
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
import { validateBookingDetails } from './booking-form-validation.js';
import { submitBookingToSheet } from './booking-submit.js';
import { initVisitFeePayment } from './booking-payment.js';
import { applyVisitModeSuccessCopy, initBookingSuccessCopy, populateBookingSummary, resetBookingSuccessPanelUi, setBookingSuccessPhase, setBookingSuccessReceivedPanel } from './booking-success-ui.js';

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

  const dismissPage = q('[data-booking-dismiss-page]');
  const dismissModal = q('[data-booking-dismiss-modal]');

  if (context === 'modal') {
    intro?.classList.add('hidden');
    dismissPage?.classList.add('hidden');
    dismissModal?.classList.remove('hidden');
    dismissModal?.addEventListener('click', () => options.onClose?.());
  } else {
    dismissModal?.classList.add('hidden');
    if (context === 'page') {
      intro?.classList.add('hidden');
    }
  }

  let refreshDevicePicker = () => {};
  let refreshServicePicker = () => {};
  let refreshTaskPicker = () => {};

  /* "What would you like us to take care of?" step (see SERVICE_TASKS). */
  const taskSelect = q('#task-type');
  const taskPickerEl = q('#task-picker');
  const taskQuestion = q('#task-question');
  const taskHint = q('#task-hint');
  const taskFootnote = q('#task-footnote');
  const taskWhatsAppNote = q('#task-whatsapp-note');
  const serviceWhatsAppNote = q('#service-whatsapp-note');
  const deviceWhatsAppNote = q('#device-whatsapp-note');
  const HARDWARE_OTHER_DEVICE = 'Other';

  /** Opens WhatsApp in a new tab (falls back to this tab if blocked). Must run inside the tap handler. */
  function openWhatsApp(message, noteEl) {
    const url = whatsAppUrl(message);
    const win = window.open(url, '_blank', 'noopener');
    if (!win) window.location.href = url;
    if (noteEl) {
      noteEl.innerHTML = `We&rsquo;ll continue this on WhatsApp. <a href="${url}" target="_blank" rel="noopener" class="underline font-semibold">Open WhatsApp</a> if it didn&rsquo;t open, or choose another option.`;
      noteEl.classList.remove('hidden');
    }
  }

  function hideWhatsAppNotes() {
    [taskWhatsAppNote, serviceWhatsAppNote, deviceWhatsAppNote].forEach((el) => el?.classList.add('hidden'));
  }

  function currentTask() {
    return taskSelect?.value || '';
  }

  function populateTaskOptions(serviceValue) {
    if (!taskSelect) return;
    const cfg = getServiceTasks(serviceValue);
    taskSelect.innerHTML = '';
    if (!cfg) {
      refreshTaskPicker();
      return;
    }
    [...cfg.options, OTHER_TASK].forEach((label) => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      taskSelect.appendChild(opt);
    });
    taskSelect.value = '';
    if (taskQuestion) taskQuestion.textContent = cfg.question;
    if (taskHint) {
      taskHint.textContent = cfg.whatsappOnly
        ? 'Pick what you have in mind — we’ll plan it with you on WhatsApp.'
        : 'Pick the closest fit.';
    }
    if (taskFootnote) {
      taskFootnote.textContent = cfg.whatsappOnly
        ? 'Every option opens WhatsApp'
        : 'Tap an option to continue · “Other” opens WhatsApp';
    }
    refreshTaskPicker();
  }

  const steps = [...qa('[data-wizard-step]')];
  let stepIndex = 0;
  let stepPlan = ['mode', 'service', 'device', 'schedule', 'details'];

  /** 'doorstep' | 'branch' | '' — first choice in the flow. */
  let visitMode = '';
  let branchSlot = '';
  const BRANCH_SERVICE = 'Branch visit (free diagnosis)';
  const doorstepCard = q('[data-visit-mode="doorstep"]');
  const branchCard = q('[data-visit-mode-card="branch"]');
  const branchSlotBtns = [...qa('[data-branch-slot]')];
  const detailsAddress = q('#details-address');

  /** Hardware repair & maintenance only: 'repair' (₹189) | 'cleaning' (₹549–699 by device) | 'install' (from ₹259). */
  let jobType = 'repair';
  const jobTypeWrap = q('#job-type-wrap');
  const jobTypeBtns = [...qa('[data-job-type]')];
  const JOB_LABELS = { cleaning: 'Service', install: 'All component installation' };

  /** Service name sent to the Sheet and used for the fee (cleaning / install keep their old names and prices). */
  function effectiveService() {
    const service = serviceSelect?.value;
    if (service !== HARDWARE_SERVICE) return service;
    if (jobType === 'cleaning') return CLEANING_SERVICE;
    if (jobType === 'install') return COMPONENT_INSTALL_SERVICE;
    return service;
  }

  function renderJobType() {
    jobTypeWrap?.classList.toggle('hidden', serviceSelect?.value !== HARDWARE_SERVICE);
    jobTypeBtns.forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.jobType === jobType)));
  }

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

  function focusFieldForDetailsError(message, fieldId) {
    const id =
      fieldId ||
      (message.includes('email')
        ? 'email'
        : message.includes('mobile') || message.includes('Phone') || message.includes('WhatsApp')
          ? 'phone'
          : message.includes('address') || message.includes('Address')
            ? 'address-line'
            : message.includes('Name') || message.includes('name')
              ? 'full-name'
              : message.includes('Landmark')
                ? 'landmark'
                : message.includes('Notes')
                  ? 'notes'
                  : null);
    if (id) q(`#${id}`)?.focus();
  }

  const detailFieldIds = ['full-name', 'phone', 'email', 'address-line', 'landmark', 'notes'];

  function clearFieldValidation() {
    detailFieldIds.forEach((id) => {
      const el = q(`#${id}`);
      if (!el) return;
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    });
  }

  function markFieldInvalid(fieldId) {
    if (!fieldId) return;
    clearFieldValidation();
    const el = q(`#${fieldId}`);
    if (!el) return;
    el.classList.add('is-invalid');
    el.setAttribute('aria-invalid', 'true');
  }

  function showError(message, fieldId) {
    if (!formError) return;
    formError.textContent = message;
    formError.classList.remove('hidden');
    if (currentStepId() === 'details') {
      markFieldInvalid(fieldId);
      focusFieldForDetailsError(message, fieldId);
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
    clearFieldValidation();
  }

  function rebuildStepPlan() {
    if (visitMode === 'branch') {
      stepPlan = ['mode', 'details'];
    } else {
      const service = serviceSelect?.value;
      const rule = getServiceRule(service);
      const tasks = getServiceTasks(service);
      if (WHATSAPP_ONLY_SERVICES.has(service)) {
        stepPlan = ['mode', 'service'];
      } else if (tasks?.whatsappOnly) {
        stepPlan = ['mode', 'service', 'task'];
      } else {
        stepPlan = rule.mode === 'fixed'
          ? ['mode', 'service', 'schedule', 'details']
          : ['mode', 'service', 'device', 'schedule', 'details'];
        if (tasks) stepPlan.splice(2, 0, 'task');
      }
    }
    detailsAddress?.classList.toggle('hidden', visitMode === 'branch');
  }

  function renderVisitMode() {
    doorstepCard?.setAttribute('aria-pressed', String(visitMode === 'doorstep'));
    if (branchCard) branchCard.dataset.active = String(visitMode === 'branch');
    branchSlotBtns.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(visitMode === 'branch' && btn.dataset.branchSlot === branchSlot));
    });
  }

  function setVisitMode(mode, slot = '') {
    visitMode = mode;
    branchSlot = mode === 'branch' ? slot : '';
    rebuildStepPlan();
    renderVisitMode();
    updateSelectionTrail();
    clearError();
  }

  function currentStepId() {
    return stepPlan[stepIndex];
  }

  function formatTrailDate(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso || '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
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
    showStep(stepIndex + 1, { focus: true });
  }

  function scheduleAutoAdvance(fromStepId) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = setTimeout(() => {
      if (currentStepId() !== fromStepId) return;
      const err = formatStepError(validateStep(fromStepId));
      if (err) return;
      goToNextStep();
    }, AUTO_ADVANCE_MS);
  }

  function updateSelectionTrail() {
    if (!selectionTrail) return;

    const items = [];
    if (visitMode === 'branch' && branchSlot) {
      items.push({ step: 'mode', label: 'Visit', value: `Branch · ${truncateLabel(branchSlot, 24)}` });
    } else if (visitMode === 'doorstep') {
      items.push({ step: 'mode', label: 'Visit', value: 'Doorstep' });
    }
    const service = visitMode === 'branch' ? '' : serviceSelect?.value;
    if (service) {
      const serviceLabel = service === HARDWARE_SERVICE && JOB_LABELS[jobType] ? JOB_LABELS[jobType] : service;
      items.push({ step: 'service', label: 'Service', value: truncateLabel(serviceLabel) });
    }
    if (service && getServiceTasks(service) && currentTask() && !isWhatsAppTask(service, currentTask())) {
      items.push({ step: 'task', label: 'Need', value: truncateLabel(currentTask()) });
    }

    const rule = service ? getServiceRule(service) : null;
    if (rule && rule.mode !== 'fixed' && deviceSelect?.value) {
      items.push({ step: 'device', label: 'Device', value: truncateLabel(deviceSelect.value) });
    }

    if (visitMode === 'doorstep' && service) {
      const fee = getVisitFee(effectiveService(), deviceSelect?.value);
      items.push({
        step: 'service',
        label: fee?.label || 'Diagnostic fee',
        value: fee ? formatInr(fee.amountInr) : 'No online fee',
      });
    }

    if (visitMode !== 'branch' && hasScheduleSelection()) {
      items.push({
        step: 'schedule',
        label: 'When',
        value: truncateLabel(`${formatTrailDate(getSelectedDate())} · ${getSelectedTime()}`, 28),
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
      mode: 'Doorstep or branch',
      service: 'What you need',
      task: 'The details',
      device: 'Your device',
      schedule: 'When we visit',
      details: 'Where & contact',
    };
    // A paid doorstep booking has one more step after "Send request": paying the visit fee.
    // WhatsApp-only flows (no "details" step) never reach payment.
    const fee = visitMode === 'doorstep' && stepPlan.includes('details')
      ? getVisitFee(effectiveService(), deviceSelect?.value)
      : null;
    const total = stepPlan.length + (fee ? 1 : 0);
    const label = id === 'details' ? 'Contact · send request' : labels[id];
    if (progressLabel) {
      progressLabel.textContent = `Step ${stepIndex + 1} of ${total} — ${label}`;
    }
    if (progressBar) {
      progressBar.style.width = `${((stepIndex + 1) / total) * 100}%`;
    }
  }

  function showStep(index, { focus = false } = {}) {
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

    // Keyboard users: move focus to the new step's heading (not on first render, to avoid stealing focus).
    if (focus) {
      const activeEl = steps.find((el) => el.dataset.wizardStep === activeId);
      const heading = activeEl?.querySelector('h2');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.classList.add('focus:outline-none');
        heading.focus({ preventScroll: true });
      }
    }
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

  let lastServiceForDevices = '';

  function applyServiceChange() {
    const service = serviceSelect?.value;
    if (!service) {
      lastServiceForDevices = '';
      jobType = 'repair';
      populateTaskOptions('');
      hideWhatsAppNotes();
      renderJobType();
      rebuildStepPlan();
      return;
    }
    const rule = getServiceRule(service);
    rebuildStepPlan();

    // Only rebuild the device list when the service really changed, so re-tapping keeps the chosen device.
    if (rule.mode !== 'fixed' && service !== lastServiceForDevices) {
      populateDeviceOptions(service);
    }
    if (service !== lastServiceForDevices) {
      jobType = 'repair';
      populateTaskOptions(service);
      hideWhatsAppNotes();
    }
    renderJobType();
    lastServiceForDevices = service;
  }

  function validateStep(id) {
    if (id === 'mode') {
      if (!visitMode) return 'Choose a doorstep visit or a branch visit to continue.';
      if (visitMode === 'branch' && !branchSlot) return 'Pick a morning or afternoon slot for your branch visit.';
    }
    if (id === 'service') {
      if (!serviceSelect?.value) return 'Please choose a service to continue.';
      if (WHATSAPP_ONLY_SERVICES.has(serviceSelect.value)) {
        return 'We plan this with you on WhatsApp — or choose another service.';
      }
    }
    if (id === 'task') {
      const service = serviceSelect?.value;
      if (!currentTask()) return 'Please choose what you’d like us to take care of.';
      if (isWhatsAppTask(service, currentTask())) {
        return 'This one continues on WhatsApp — or choose another option.';
      }
    }
    if (id === 'device') {
      if (!deviceSelect?.value) return 'Please tell us which device we should expect.';
      if (serviceSelect?.value === HARDWARE_SERVICE && deviceSelect.value === HARDWARE_OTHER_DEVICE) {
        return 'Other devices continue on WhatsApp — or choose a device from the list.';
      }
    }
    if (id === 'schedule') {
      if (!hasScheduleSelection()) {
        return 'Pick a recommended slot, or tap “Choose date & time” and select when we should visit.';
      }
    }
    if (id === 'details') {
      const result = validateBookingDetails({
        name: q('#full-name')?.value,
        email: q('#email')?.value,
        phone: q('#phone')?.value,
        address: q('#address-line')?.value,
        landmark: q('#landmark')?.value,
        notes: q('#notes')?.value,
      }, { requireAddress: visitMode !== 'branch' });
      if (!result.ok) {
        return { message: result.message, fieldId: result.fieldId };
      }
    }
    return null;
  }

  function formatStepError(err) {
    if (!err) return null;
    if (typeof err === 'string') return { message: err, fieldId: undefined };
    return err;
  }

  function validateAllSteps() {
    for (const stepId of stepPlan) {
      const err = formatStepError(validateStep(stepId));
      if (err) return { stepId, ...err };
    }
    return null;
  }

  function collectPayload() {
    if (visitMode === 'branch') {
      return {
        service: BRANCH_SERVICE,
        device: 'Brought to Korattur branch',
        date: 'Branch walk-in',
        time: branchSlot,
        name: q('#full-name')?.value.trim(),
        email: q('#email')?.value.trim(),
        phone: q('#phone')?.value.trim(),
        address: '',
        landmark: '',
        notes: q('#notes')?.value.trim(),
      };
    }
    const service = effectiveService();
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

  function bindVisitModeButtons() {
    doorstepCard?.addEventListener('click', () => {
      setVisitMode('doorstep');
      scheduleAutoAdvance('mode');
    });
    branchSlotBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        setVisitMode('branch', btn.dataset.branchSlot || '');
        scheduleAutoAdvance('mode');
      });
    });
  }

  function bindJobTypeButtons() {
    jobTypeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        jobType = btn.dataset.jobType || 'repair';
        renderJobType();
        updateSelectionTrail();
      });
    });
  }

  function bindWizardButtons() {
    qa('[data-wizard-next]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const err = formatStepError(validateStep(currentStepId()));
        if (err) {
          showError(err.message, err.fieldId);
          return;
        }
        goToNextStep();
      });
    });

    qa('[data-wizard-back]').forEach((btn) => {
      btn.addEventListener('click', () => {
        clearTimeout(autoAdvanceTimer);
        if (stepIndex > 0) showStep(stepIndex - 1, { focus: true });
      });
    });

    selectionTrail?.addEventListener('click', (event) => {
      const jumpBtn = event.target.closest('[data-wizard-jump]');
      if (!jumpBtn) return;
      clearTimeout(autoAdvanceTimer);
      const stepId = jumpBtn.getAttribute('data-wizard-jump');
      if (stepId) showStep(stepIndexForId(stepId), { focus: true });
    });
  }

  if (serviceSelect) {
    serviceSelect.addEventListener('change', () => {
      applyServiceChange();
    });
  }

  if (servicePickerEl && serviceSelect) {
    refreshServicePicker = mountGroupedChoicePicker(servicePickerEl, serviceSelect, {
      onChange: (value) => {
        applyServiceChange();
        updateProgress();
        if (WHATSAPP_ONLY_SERVICES.has(value)) {
          openWhatsApp(whatsAppMessage(value), serviceWhatsAppNote);
          return;
        }
        if (currentStepId() === 'service') scheduleAutoAdvance('service');
      },
    });
  }

  if (taskPickerEl && taskSelect) {
    refreshTaskPicker = mountFlatChoicePicker(taskPickerEl, taskSelect, {
      ariaLabel: 'What you need',
      onChange: (value) => {
        const service = serviceSelect?.value;
        clearError();
        updateSelectionTrail();
        if (isWhatsAppTask(service, value)) {
          openWhatsApp(whatsAppMessage(service, value), taskWhatsAppNote);
          return;
        }
        taskWhatsAppNote?.classList.add('hidden');
        if (currentStepId() === 'task') scheduleAutoAdvance('task');
      },
    });
  }

  if (devicePickerEl && deviceSelect) {
    refreshDevicePicker = mountFlatChoicePicker(devicePickerEl, deviceSelect, {
      onChange: (value) => {
        if (serviceSelect?.value === HARDWARE_SERVICE && value === HARDWARE_OTHER_DEVICE) {
          openWhatsApp(`Hi, I need hardware repair for a device not in your list: `, deviceWhatsAppNote);
          return;
        }
        deviceWhatsAppNote?.classList.add('hidden');
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

  detailFieldIds.forEach((id) => {
    const el = q(`#${id}`);
    el?.addEventListener('input', () => {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    });
  });

  bindVisitModeButtons();
  bindJobTypeButtons();
  bindWizardButtons();
  applyServiceChange();
  showStep(0);

  let paymentContext = { payload: {}, bookingKey: '' };
  const visitFeePayment = initVisitFeePayment(root, {
    getContext: () => paymentContext,
  });

  const submitBtn = q('#submit-booking');
  const submitBtnDefaultLabel = submitBtn?.textContent?.trim() || 'Send booking request';

  initBookingSuccessCopy(root);

  function scrollSuccessPanelIntoView() {
    const scrollHost = root.closest('#booking-modal-mount');
    if (scrollHost) {
      scrollHost.scrollTop = 0;
      return;
    }
    if (context === 'page' && successPanel) {
      const headerOffset = window.matchMedia('(min-width: 640px)').matches ? 80 : 64;
      const top =
        successPanel.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }

  function showBookingSuccess(payload, bookingKey, { alreadyPaid = false } = {}) {
    intro?.classList.add('hidden');
    const fee = getVisitFee(payload.service, payload.device);
    const headerVariant =
      fee && fee.amountInr > 0 ? 'saved-unpaid' : 'received';
    setBookingSuccessPhase(root, true, { headerVariant });

    resetBookingSuccessPanelUi(root);
    const rule = getServiceRule(payload.service);
    populateBookingSummary(successSummary, payload, {
      showDevice: visitMode !== 'branch' && rule.mode !== 'fixed',
      branch: visitMode === 'branch',
    });

    applyVisitModeSuccessCopy(root, visitMode === 'branch');

    successPanel?.classList.remove('hidden');
    paymentBlock?.classList.add('hidden');

    // Refresh the pay UI first: its reset sets the default "Booking saved" heading,
    // which the no-fee panel below must be able to override.
    paymentContext = { payload, bookingKey };
    visitFeePayment?.refresh(payload, bookingKey);

    if (fee && fee.amountInr > 0) {
      root.dataset.payState = 'unpaid';
      if (alreadyPaid) visitFeePayment?.markAlreadyPaid(payload, bookingKey);
    } else {
      setBookingSuccessReceivedPanel(root);
    }

    scrollSuccessPanelIntoView();
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearError();
      const fail = validateAllSteps();
      if (fail) {
        if (fail.stepId !== currentStepId()) {
          showStep(stepIndexForId(fail.stepId));
        }
        showError(fail.message, fail.fieldId);
        return;
      }

      const details = validateBookingDetails({
        name: q('#full-name')?.value,
        email: q('#email')?.value,
        phone: q('#phone')?.value,
        address: q('#address-line')?.value,
        landmark: q('#landmark')?.value,
        notes: q('#notes')?.value,
      }, { requireAddress: visitMode !== 'branch' });
      if (!details.ok) {
        showError(details.message, details.fieldId);
        return;
      }

      const payload = {
        ...collectPayload(),
        ...details.normalized,
      };
      if (visitMode === 'branch') {
        // The address fields are hidden for branch visits; never send what was typed for a doorstep visit.
        payload.address = '';
        payload.landmark = '';
      } else if (getServiceTasks(payload.service) && currentTask()) {
        // Code.gs shows notes in the booking's Issue column, so the chosen need travels with the booking.
        payload.notes = payload.notes ? `${currentTask()} — ${payload.notes}` : currentTask();
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }

      const slowHint = q('#submit-slow-hint');
      const result = await submitBookingToSheet(payload, {
        onSlow: () => {
          if (submitBtn) submitBtn.textContent = 'Still sending…';
          slowHint?.classList.remove('hidden');
        },
      });

      slowHint?.classList.add('hidden');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtnDefaultLabel;
      }

      if (!result.ok) {
        showError(result.message);
        return;
      }

      showBookingSuccess(payload, result.bookingKey || '', { alreadyPaid: result.alreadyPaid });
      redirectAfterBooking(payload);
    });
  }

  /** Subscriptions → subscription details page; AMC → WhatsApp (after the details are saved). */
  const REDIRECT_DELAY_MS = 2500;
  let redirectTimer = null;
  function redirectAfterBooking(payload) {
    const rule = visitMode === 'branch' ? null : AFTER_BOOKING_REDIRECTS[payload.service];
    if (!rule) return;
    const url = rule.kind === 'whatsapp'
      ? whatsAppUrl(`Hi, I just sent an enquiry for ${payload.service} on your website (name: ${payload.name}). Let's discuss.`)
      : rule.url;
    const note = q('#booking-success-redirect');
    if (note) {
      note.innerHTML = `Request received. Taking you to ${rule.label}&hellip; <a href="${url}" class="underline font-semibold">Go now</a>`;
      note.classList.remove('hidden');
    }
    clearTimeout(redirectTimer);
    // Same-tab navigation: a new tab opened after the network request would be blocked as a pop-up.
    redirectTimer = setTimeout(() => window.location.assign(url), REDIRECT_DELAY_MS);
  }

  function reset() {
    clearTimeout(redirectTimer);
    q('#booking-success-redirect')?.classList.add('hidden');
    form?.reset();
    if (serviceSelect) {
      serviceSelect.value = '';
    }
    clearTimeout(autoAdvanceTimer);
    visitMode = '';
    branchSlot = '';
    renderVisitMode();
    if (context === 'modal' || context === 'page') {
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
