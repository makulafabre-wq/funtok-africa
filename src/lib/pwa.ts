export function refuseOfflineWorker(hostname: string, isProd: boolean, framed: boolean, disabled: boolean) {
  const host = hostname.toLowerCase();
  const lovableDomain = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host);
  const label = host.split(".")[0] ?? "";
  return !isProd || framed || disabled ||
    (lovableDomain && (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label) || /^project--.+-dev$/.test(label))) ||
    /(^|\.)(lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(host);
}

export async function registerOfflineWorker() {
  if (!("serviceWorker" in navigator)) return;
  const refused = refuseOfflineWorker(window.location.hostname, import.meta.env.PROD, window.self !== window.top, new URLSearchParams(window.location.search).get("sw") === "off");
  if (refused) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter((registration) => [registration.active, registration.waiting, registration.installing].some((worker) => worker && new URL(worker.scriptURL).pathname === "/sw.js")).map((registration) => registration.unregister()));
    return;
  }
  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  // Warm a public navigation after control is established; never cache protected pages.
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      const done = () => { navigator.serviceWorker.removeEventListener("controllerchange", done); resolve(); };
      navigator.serviceWorker.addEventListener("controllerchange", done, { once: true });
      setTimeout(done, 5000);
    });
  }
  if (navigator.serviceWorker.controller && navigator.onLine) await fetch("/", { credentials: "omit" });
}