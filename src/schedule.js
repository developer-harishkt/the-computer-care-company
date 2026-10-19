const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TIME_SLOTS = [
  '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM',
  '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
];

const DATE_BASE = 'shrink-0 w-[76px] py-3 rounded-xl border flex flex-col items-center gap-0.5 cursor-pointer transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';
const DATE_IDLE = 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:-translate-y-0.5';
const DATE_ACTIVE = 'bg-blue-600 border-blue-600 text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.7)]';

const TIME_BASE = 'py-3 rounded-xl border text-sm font-bold tracking-wide cursor-pointer transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';
const TIME_IDLE = 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:-translate-y-0.5';
const TIME_ACTIVE = 'bg-blue-600 border-blue-600 text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.7)]';

function applyState(el, base, idle, active, isActive) {
  el.className = `${base} ${isActive ? active : idle}`;
  el.setAttribute('aria-pressed', String(isActive));
}

function buildDates(container) {
  const today = new Date();

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WEEKDAYS[date.getDay()];

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.dataset.date = date.toISOString().slice(0, 10);
    pill.innerHTML = `
      <span class="text-[10px] font-mono font-semibold uppercase tracking-wide opacity-80">${label}</span>
      <span class="text-lg font-black leading-none">${date.getDate()}</span>
      <span class="text-[10px] font-mono uppercase tracking-wide opacity-70">${MONTHS[date.getMonth()]}</span>
    `;

    pill.addEventListener('click', () => {
      container.querySelectorAll('button').forEach((btn) => {
        applyState(btn, DATE_BASE, DATE_IDLE, DATE_ACTIVE, btn === pill);
      });
    });

    applyState(pill, DATE_BASE, DATE_IDLE, DATE_ACTIVE, i === 0);
    container.appendChild(pill);
  }
}

function buildTimes(container) {
  TIME_SLOTS.forEach((slot, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = slot;
    btn.dataset.time = slot;

    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach((b) => {
        applyState(b, TIME_BASE, TIME_IDLE, TIME_ACTIVE, b === btn);
      });
    });

    applyState(btn, TIME_BASE, TIME_IDLE, TIME_ACTIVE, i === 0);
    container.appendChild(btn);
  });
}

const dateList = document.querySelector('#date-list');
const timeSlots = document.querySelector('#time-slots');

if (dateList) buildDates(dateList);
if (timeSlots) buildTimes(timeSlots);
