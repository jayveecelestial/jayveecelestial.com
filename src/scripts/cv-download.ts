import { PUBLIC_TURNSTILE_SITE_KEY } from "astro:env/client";

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(id: string): void;
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    s.onerror = () => reject(new Error("turnstile load failed"));
    document.head.appendChild(s);
  }).catch((e: unknown) => {
    loading = undefined; // allow retry
    throw e;
  });
  return loading;
}

function getToken(ts: TurnstileApi, box: HTMLElement, sitekey: string): { token: Promise<string>; id: string } {
  let id: string | undefined;
  const token = new Promise<string>((resolve, reject) => {
    id = ts.render(box, {
      sitekey,
      action: "cv",
      appearance: "interaction-only",
      callback: resolve,
      "error-callback": () => reject(new Error("turnstile error")),
      "timeout-callback": () => reject(new Error("turnstile timeout")),
      "expired-callback": () => reject(new Error("turnstile expired")),
    });
    if (!id) reject(new Error("turnstile render failed"));
  });
  return { token, id: id ?? "" };
}

async function fetchCv(token: string, alive: () => boolean): Promise<void> {
  const body = new FormData();
  body.append("cf-turnstile-response", token);
  const res = await fetch("/api/cv", { method: "POST", body });
  if (!res.ok) throw new Error(`cv ${res.status}`);
  const blob = await res.blob();
  if (!alive()) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Jayvee-Celestial-CV.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function showError(link: HTMLAnchorElement): void {
  const msg = document.createElement("p");
  msg.className = "cv-error";
  msg.setAttribute("role", "alert");
  msg.append("Couldn't verify. ");
  const mail = document.createElement("a");
  mail.href = "#contact";
  mail.textContent = "Email me instead";
  mail.addEventListener("click", e => {
    const src = document.querySelector<HTMLElement>(".email-link");
    if (!src) return;
    e.preventDefault();
    window.location.href = `mailto:${src.dataset.u}@${src.dataset.d}`;
  });
  msg.append(mail);
  link.parentElement?.querySelector(".cv-error")?.remove();
  link.insertAdjacentElement("afterend", msg);
}

const TIMEOUT_MS = 60_000;
const DEBOUNCE_MS = 500;
let active: { cancel: () => void } | undefined;
let startedAt = 0;

async function run(link: HTMLAnchorElement): Promise<void> {
  const label = link.textContent;
  const live = document.getElementById("live");
  const parent = link.parentElement;
  parent?.querySelector(".cv-error")?.remove();
  parent?.querySelector(".cv-status")?.remove();
  if (!PUBLIC_TURNSTILE_SITE_KEY) {
    showError(link);
    if (live) live.textContent = "Couldn't verify. Email me instead.";
    return;
  }
  const box = document.createElement("div");
  box.className = "cv-check";
  const status = document.createElement("p");
  status.className = "cv-status";
  status.setAttribute("role", "status");
  link.insertAdjacentElement("afterend", status);
  status.insertAdjacentElement("afterend", box);
  link.setAttribute("aria-busy", "true");
  link.textContent = "Checking…";
  // Text set after insertion so the status region is announced (also inside dialogs).
  const say = (text: string): void => {
    status.textContent = text;
    if (live) live.textContent = text;
  };
  say("Checking you are human.");

  let ts: TurnstileApi | undefined;
  let id = "";
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (e: Error) => void = () => {};
  const cleanup = (keepStatus: boolean): void => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (ts && id) ts.remove(id);
    box.remove();
    if (!keepStatus) status.remove();
    link.removeAttribute("aria-busy");
    link.textContent = label;
    if (active === me) active = undefined;
  };
  const me = {
    cancel: () => {
      cleanup(false);
      abort(new Error("cancelled"));
    },
  };
  active = me;
  const limit = new Promise<never>((_, reject) => {
    abort = reject;
    timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
  });
  try {
    await Promise.race([
      (async () => {
        ts = await loadTurnstile();
        if (done) return;
        const t = getToken(ts, box, PUBLIC_TURNSTILE_SITE_KEY);
        id = t.id;
        await fetchCv(await t.token, () => !done);
      })(),
      limit,
    ]);
    if (done) return;
    say("CV downloaded.");
    cleanup(true);
    setTimeout(() => status.remove(), 4000);
  } catch {
    if (done) return; // cancelled by a newer click
    cleanup(false);
    showError(link);
    if (live) live.textContent = "Couldn't verify. Email me instead.";
  }
}

document.addEventListener("click", e => {
  const link = (e.target as Element | null)?.closest<HTMLAnchorElement>("a[data-cv]");
  if (!link) return;
  e.preventDefault();
  const now = Date.now();
  if (active) {
    if (now - startedAt < DEBOUNCE_MS) return;
    active.cancel();
  }
  startedAt = now;
  void run(link);
});
