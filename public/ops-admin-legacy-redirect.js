(() => {
  const localHosts = new Set(["", "localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
  if (localHosts.has(window.location.hostname)) return;
  const target = new URL("ops-admin-api.html", window.location.href);
  target.hash = window.location.hash;
  window.location.replace(target.href);
})();
