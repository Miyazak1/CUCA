const authIcons = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.6c0 5.7-8.5 10.4-8.5 10.4S3.5 14.3 3.5 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.5 2.6Z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 15h3"/><path d="M14 15h2"/></svg>',
  document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>',
  agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.5A4.5 4.5 0 0 1 9.5 4h5A4.5 4.5 0 0 1 19 8.5v2A4.5 4.5 0 0 1 14.5 15H11l-4 4v-4.5A4.5 4.5 0 0 1 5 10.5Z"/><path d="m17 3 .7 1.5L19 5l-1.3.5L17 7l-.7-1.5L15 5l1.3-.5Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4Z"/><path d="m4 7 8 6 8-6"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg>',
  wechat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 17.5a8 8 0 0 1-3.2-.6L4 18l1.1-2.5A6.2 6.2 0 0 1 3 11c0-3.6 3.6-6.5 8-6.5 3.3 0 6.1 1.6 7.3 3.9"/><path d="M21 14.5c0 2.8-2.7 5-6 5a6.8 6.8 0 0 1-2.5-.5L10 20l.8-2a4.7 4.7 0 0 1-1.8-3.5c0-2.8 2.7-5 6-5s6 2.2 6 5Z"/><path d="M8 10h.01M13 10h.01M13 14h.01M17 14h.01"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h3a6 6 0 0 0 6-6V8"/></svg>',
};

document.querySelectorAll("[data-auth-icon]").forEach((target) => {
  target.innerHTML = authIcons[target.dataset.authIcon] || "";
});

function setMode(mode) {
  document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
    const active = tab.dataset.authTab === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.authPanel === mode);
  });
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-auth-tab]");
  if (tab) setMode(tab.dataset.authTab);
});

document.querySelectorAll(".auth-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = form.querySelector(".primary");
    const hint = form.querySelector(".form-hint");
    const original = button.textContent;
    const isRegister = form.dataset.authPanel === "register";
    button.disabled = true;
    button.textContent = isRegister ? "Creating preview..." : "Opening preview...";
    hint.textContent = isRegister
      ? "Preview interaction only. Next we will set up a lightweight China study profile."
      : "Preview interaction only. Opening your Hub context.";
    window.setTimeout(() => {
      window.location.href = isRegister ? "onboarding.html" : "hub.html";
      button.disabled = false;
      button.textContent = original;
    }, 900);
  });
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  document.querySelectorAll(".reveal").forEach((target) => revealObserver.observe(target));
} else {
  document.querySelectorAll(".reveal").forEach((target) => target.classList.add("visible"));
}
