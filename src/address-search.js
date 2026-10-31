/**
 * Chennai-biased address search via Photon (OpenStreetMap) — free, no API key.
 * Optional: set VITE_GOOGLE_MAPS_API_KEY later for Google Places instead.
 */

const CHENNAI = { lat: 13.0827, lon: 80.2707 };
const DEBOUNCE_MS = 320;

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function fetchPhoton(query) {
  const q = encodeURIComponent(`${query}, Chennai, Tamil Nadu`);
  const url = `https://photon.komoot.io/api/?q=${q}&lat=${CHENNAI.lat}&lon=${CHENNAI.lon}&limit=6&lang=en`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features || []).map((f) => {
    const p = f.properties || {};
    const parts = [p.name, p.street, p.district, p.city, p.state, p.postcode].filter(Boolean);
    const line = [...new Set(parts)].join(', ');
    return line || p.label || query;
  });
}

export function initAddressSearch(inputEl, listEl, onPick) {
  if (!inputEl || !listEl) return;

  const runSearch = debounce(async () => {
    const q = inputEl.value.trim();
    listEl.innerHTML = '';
    listEl.classList.add('hidden');

    if (q.length < 3) return;

    try {
      const lines = await fetchPhoton(q);
      if (!lines.length) return;

      lines.forEach((line) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'option');
        btn.className =
          'w-full text-left px-4 py-3.5 min-h-[44px] text-sm text-slate-700 hover:bg-blue-50 active:bg-blue-100 border-b border-slate-100 last:border-0 break-words';
        btn.textContent = line;
        btn.addEventListener('click', () => {
          inputEl.value = line;
          listEl.classList.add('hidden');
          onPick?.(line);
        });
        listEl.appendChild(btn);
      });
      listEl.classList.remove('hidden');
    } catch {
      /* offline or rate limit — user can still type manually */
    }
  }, DEBOUNCE_MS);

  inputEl.addEventListener('input', runSearch);
  inputEl.addEventListener('focus', () => {
    if (listEl.children.length) listEl.classList.remove('hidden');
  });

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') listEl.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target)) {
      listEl.classList.add('hidden');
    }
  });
}
