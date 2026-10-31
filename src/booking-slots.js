/** All visit times — 24/7 hourly (custom picker). */
export const ALL_DAY_TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 0; h < 24; h += 1) {
    const ampm = h < 12 ? 'AM' : 'PM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    slots.push(`${String(hour12).padStart(2, '0')}:00 ${ampm}`);
  }
  return slots;
})();

/** @deprecated use ALL_DAY_TIME_SLOTS — kept for any external imports */
export const TIME_SLOTS = ALL_DAY_TIME_SLOTS;

/** Days shown in the date scroller (including today). */
export const SCHEDULE_DAY_COUNT = 14;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SLOT = { date: null, time: null };

function formatDateLabel(date, offsetDays) {
  if (offsetDays === 0) return 'Today';
  if (offsetDays === 1) return 'Tomorrow';
  return WEEKDAYS[date.getDay()];
}

function dateIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayOffsetFromIso(iso) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const slotDay = new Date(y, m - 1, d);
  return Math.round((slotDay.getTime() - start.getTime()) / 86400000);
}

function parseSlotHour(timeStr) {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h;
}

function isSlotPast(isoDate, timeStr) {
  if (!isoDate || !timeStr) return false;
  const now = new Date();
  const slotDay = new Date(`${isoDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (slotDay.getTime() > today.getTime()) return false;
  if (slotDay.getTime() < today.getTime()) return true;
  return parseSlotHour(timeStr) <= now.getHours();
}

function formatSelectionSummary(iso, time) {
  const [y, m, dayNum] = iso.split('-').map((n) => parseInt(n, 10));
  const d = new Date(y, m - 1, dayNum);
  const offset = dayOffsetFromIso(iso);
  const dayLabel = formatDateLabel(d, offset);
  return `${dayLabel}, ${d.getDate()} ${MONTHS[d.getMonth()]} · ${time}`;
}

/** Build 3 “prime” recommendations: soonest sensible slots. */
export function computePrimeSlots() {
  const today = new Date();
  const candidates = [];
  const times = ['10:00 AM', '02:00 PM', '11:00 AM', '03:00 PM', '04:00 PM'];

  for (let dayOffset = 0; dayOffset < SCHEDULE_DAY_COUNT && candidates.length < 3; dayOffset += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + dayOffset);
    const iso = dateIso(d);
    for (const time of times) {
      if (candidates.length >= 3) break;
      if (isSlotPast(iso, time)) continue;
      candidates.push({
        iso,
        time,
        title: formatDateLabel(d, dayOffset),
        dayNum: d.getDate(),
        month: MONTHS[d.getMonth()],
        badge: dayOffset === 0 ? 'Soonest' : dayOffset === 1 ? 'Popular' : 'Flexible',
      });
    }
  }
  return candidates;
}

function primeCardClasses(active) {
  const base =
    'text-left w-full rounded-lg border p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 min-h-[44px]';
  return active
    ? `${base} border-blue-600 bg-blue-50 shadow-[0_6px_16px_-6px_rgba(37,99,235,0.35)]`
    : `${base} border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50`;
}

function datePillClasses(active, disabled) {
  const base =
    'shrink-0 w-[4.25rem] sm:w-[4.75rem] py-3 rounded-lg border flex flex-col items-center gap-0.5 transition-all duration-200 min-h-[44px] snap-start';
  if (disabled) {
    return `${base} border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed`;
  }
  if (active) {
    return `${base} cursor-pointer ring-2 ring-blue-400 border-blue-600 bg-blue-50/80`;
  }
  return `${base} cursor-pointer border-slate-200 bg-white hover:border-blue-300`;
}

function timeChipClasses(active, disabled) {
  const base =
    'rounded-lg border px-2 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 min-h-[40px]';
  if (disabled) {
    return `${base} border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed`;
  }
  if (active) {
    return `${base} border-blue-600 bg-blue-50 text-blue-900 shadow-sm`;
  }
  return `${base} border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50/50`;
}

let onSlotChange = () => {};
let uiReset = () => {};

export function setSlotSelection(iso, time) {
  SLOT.date = iso;
  SLOT.time = time;
  onSlotChange();
}

export function getSelectedDate() {
  return SLOT.date;
}

export function getSelectedTime() {
  return SLOT.time;
}

export function hasScheduleSelection() {
  return Boolean(SLOT.date && SLOT.time && !isSlotPast(SLOT.date, SLOT.time));
}

export function resetBookingSlots() {
  uiReset();
}

export function initBookingSlots({
  primeContainer,
  dateListEl,
  timeGridEl,
  selectionSummaryEl,
  primeSummaryEl,
  customPanelEl,
  customToggleEl,
  onChange,
}) {
  onSlotChange = onChange || (() => {});

  const primeSlots = computePrimeSlots();
  primeContainer.innerHTML = '';

  let selectedIso = null;
  let selectedTime = null;
  let customMode = false;

  function clearSelection() {
    selectedIso = null;
    selectedTime = null;
    setSlotSelection(null, null);
  }

  function updateSelectionSummary() {
    const text =
      selectedIso && selectedTime ? formatSelectionSummary(selectedIso, selectedTime) : '';

    if (selectionSummaryEl) {
      if (customMode && text) {
        selectionSummaryEl.textContent = text;
        selectionSummaryEl.classList.remove('hidden');
      } else {
        selectionSummaryEl.classList.add('hidden');
      }
    }

    if (primeSummaryEl) {
      if (!customMode && text) {
        primeSummaryEl.textContent = text;
        primeSummaryEl.classList.remove('hidden');
      } else {
        primeSummaryEl.classList.add('hidden');
      }
    }
  }

  function syncUiFromSelection() {
    primeContainer.querySelectorAll('button[data-prime]').forEach((b) => {
      const match =
        !customMode && b.dataset.iso === selectedIso && b.dataset.time === selectedTime;
      b.className = primeCardClasses(match);
      b.setAttribute('aria-pressed', String(match));
    });

    dateListEl.querySelectorAll('button[data-date]').forEach((pill) => {
      const active = customMode && pill.dataset.date === selectedIso;
      pill.className = datePillClasses(active, false);
      pill.setAttribute('aria-pressed', String(active));
    });

    timeGridEl.querySelectorAll('button[data-time]').forEach((chip) => {
      const disabled = !selectedIso || isSlotPast(selectedIso, chip.dataset.time);
      const active =
        customMode && chip.dataset.time === selectedTime && selectedIso && !disabled;
      chip.disabled = disabled;
      chip.className = timeChipClasses(active, disabled);
      chip.setAttribute('aria-pressed', String(active));
    });

    updateSelectionSummary();
  }

  function applySelection(iso, time, { fromPrime = false, fromCustom = false } = {}) {
    if (!iso || !time || isSlotPast(iso, time)) return;
    selectedIso = iso;
    selectedTime = time;
    customMode = fromCustom;
    if (fromPrime) {
      customPanelEl?.classList.add('hidden');
      customToggleEl?.classList.remove('hidden');
    }
    setSlotSelection(iso, time);
    syncUiFromSelection();
  }

  function openCustomPicker() {
    customMode = true;
    customPanelEl?.classList.remove('hidden');
    customToggleEl?.classList.add('hidden');
    clearSelection();
    syncUiFromSelection();
    customPanelEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  primeSlots.forEach((slot) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.prime = '1';
    btn.dataset.iso = slot.iso;
    btn.dataset.time = slot.time;
    btn.className = primeCardClasses(false);
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <span class="text-[10px] font-mono font-bold uppercase tracking-wide text-blue-600">${slot.badge}</span>
        <span class="text-sm font-black text-slate-900">${slot.time}</span>
      </div>
      <p class="mt-2 text-base font-bold text-slate-800">${slot.title}, ${slot.dayNum} ${slot.month}</p>
      <p class="text-xs text-slate-500 mt-1">Recommended — tap to select</p>
    `;
    btn.addEventListener('click', () => applySelection(slot.iso, slot.time, { fromPrime: true }));
    primeContainer.appendChild(btn);
  });

  const today = new Date();
  for (let i = 0; i < SCHEDULE_DAY_COUNT; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const iso = dateIso(date);
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.dataset.date = iso;
    pill.className = datePillClasses(false, false);
    pill.setAttribute('aria-pressed', 'false');
    pill.innerHTML = `
      <span class="text-[10px] font-mono font-semibold uppercase opacity-80">${formatDateLabel(date, i)}</span>
      <span class="text-lg font-black leading-none">${date.getDate()}</span>
      <span class="text-[10px] font-mono uppercase opacity-70">${MONTHS[date.getMonth()]}</span>
    `;
    pill.addEventListener('click', () => {
      selectedIso = iso;
      customMode = true;
      selectedTime = null;
      setSlotSelection(null, null);
      syncUiFromSelection();
    });
    dateListEl.appendChild(pill);
  }

  ALL_DAY_TIME_SLOTS.forEach((t) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.dataset.time = t;
    chip.className = timeChipClasses(false, false);
    chip.textContent = t;
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
      if (isSlotPast(selectedIso, t)) return;
      applySelection(selectedIso, t, { fromCustom: true });
    });
    timeGridEl.appendChild(chip);
  });

  customToggleEl?.addEventListener('click', openCustomPicker);

  uiReset = () => {
    customMode = false;
    customPanelEl?.classList.add('hidden');
    customToggleEl?.classList.remove('hidden');
    clearSelection();
    syncUiFromSelection();
  };

  clearSelection();
  syncUiFromSelection();
}
