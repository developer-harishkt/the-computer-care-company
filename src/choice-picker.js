/** Tappable choice chips — visual sibling to schedule time chips in booking-slots.js */

export function choiceChipClasses(active) {
  const base =
    'w-full text-left rounded-lg border px-3 py-3 text-[13px] sm:text-sm font-semibold leading-snug transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 min-h-[44px] break-words';
  if (active) {
    return `${base} border-blue-600 bg-blue-50 text-blue-900 shadow-sm`;
  }
  return `${base} border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50/50`;
}

function setSelectValue(selectEl, value) {
  if (!selectEl) return;
  if (selectEl.value === value) return;
  selectEl.value = value;
  selectEl.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Renders optgroups from a <select> as labeled chip grids; keeps select in sync (e.g. sr-only).
 */
export function mountGroupedChoicePicker(container, selectEl, { onChange } = {}) {
  if (!container || !selectEl) return () => {};

  function render() {
    container.innerHTML = '';
    const selected = selectEl.value;

    [...selectEl.querySelectorAll('optgroup')].forEach((group) => {
      const section = document.createElement('div');
      section.className = 'space-y-2';

      const heading = document.createElement('p');
      heading.className = 'text-xs font-mono font-semibold uppercase tracking-wide text-slate-500';
      heading.textContent = group.label || 'Services';
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-2';
      grid.setAttribute('role', 'listbox');
      grid.setAttribute('aria-label', group.label || 'Services');

      [...group.querySelectorAll('option')].forEach((opt) => {
        if (!opt.value || opt.disabled) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'option');
        btn.dataset.value = opt.value;
        const active = opt.value === selected;
        btn.className = choiceChipClasses(active);
        btn.setAttribute('aria-pressed', String(active));
        btn.textContent = opt.textContent.trim();
        btn.addEventListener('click', () => {
          setSelectValue(selectEl, opt.value);
          onChange?.(opt.value);
          render();
        });
        grid.appendChild(btn);
      });

      section.appendChild(grid);

      const quote = group.dataset.quote;
      if (quote) {
        const q = document.createElement('p');
        q.className = 'text-xs font-medium text-slate-500 pt-1 text-center';
        q.textContent = `“${quote}”`;
        section.appendChild(q);
      }

      container.appendChild(section);
    });
  }

  render();
  return render;
}

/**
 * Flat chip grid from all enabled <option>s in a select.
 */
export function mountFlatChoicePicker(container, selectEl, { onChange, ariaLabel = 'Device type', priceFor } = {}) {
  if (!container || !selectEl) return () => {};

  function render() {
    container.innerHTML = '';
    const selected = selectEl.value;

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-2';
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', ariaLabel);

    [...selectEl.options].forEach((opt) => {
      if (!opt.value) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'option');
      btn.dataset.value = opt.value;
      const active = opt.value === selected;
      btn.className = choiceChipClasses(active);
      btn.setAttribute('aria-pressed', String(active));
      // Optional price on the right of the chip (hardware "Service": each device has its own price).
      const price = priceFor?.(opt.value) || '';
      if (price) {
        btn.classList.add('flex', 'items-center', 'justify-between', 'gap-3');
        const name = document.createElement('span');
        name.textContent = opt.textContent.trim();
        const amount = document.createElement('span');
        amount.className = 'shrink-0 font-bold text-slate-900';
        amount.textContent = price;
        btn.append(name, amount);
      } else {
        btn.textContent = opt.textContent.trim();
      }
      btn.addEventListener('click', () => {
        setSelectValue(selectEl, opt.value);
        onChange?.(opt.value);
        render();
      });
      grid.appendChild(btn);
    });

    container.appendChild(grid);
  }

  render();
  return render;
}
