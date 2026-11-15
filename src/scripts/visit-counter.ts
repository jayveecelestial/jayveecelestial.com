import { formatVisit, parseVisit } from '../lib/visit.ts';

const KEY = 'ng-visitor';

// Stable anonymous id kept in localStorage. Blocked storage -> null (no request).
function getId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

async function run(): Promise<void> {
  const el = document.getElementById('visits');
  if (!el || navigator.webdriver) return;
  const id = getId();
  if (!id) return;
  const res = await fetch('/api/visit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (res.status !== 200) return;
  const visit = parseVisit(await res.json());
  if (!visit) return;
  const f = formatVisit(visit);
  const set = (sel: string, v: string) => {
    const node = document.getElementById(sel);
    if (node) node.textContent = v;
  };
  set('visit-n', f.n);
  set('visit-visits', f.visits);
  set('visit-total', f.total);
  set('visit-total-visits', f.totalVisits);
  el.setAttribute('aria-label', `Visitor ${f.n}, visit ${f.visits}, ${f.total} visitors, ${f.totalVisits} visits total`);
  el.setAttribute('data-ready', '');
}

// Any failure leaves the strip as an invisible band.
run().catch(() => {});
