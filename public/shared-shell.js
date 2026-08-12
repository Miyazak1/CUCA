(function () {
  const icons = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>',
    saved: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.6c0 5.7-8.5 10.4-8.5 10.4S3.5 14.3 3.5 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.5 2.6Z"/></svg>',
    account: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.2a4.2 4.2 0 1 1-4.2-4.2"/><path d="M14 6.2c1.2 1.9 2.8 3 5 3.2"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><path d="M17.5 6.8h.01"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 8H16V5h-2c-2.4 0-4 1.6-4 4v2H8v3h2v5h3v-5h2.2l.5-3H13V9.2c0-.8.5-1.2 1.5-1.2Z" class="brand-fill"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6.5" width="17" height="11" rx="3"/><path d="m10.5 9.5 5 2.5-5 2.5Z" class="brand-fill"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10v8"/><path d="M6 6.5v.01"/><path d="M11 18v-8"/><path d="M11 13.5c0-2.2 1.4-3.8 3.5-3.8S18 11.3 18 13.8V18"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14"/><path d="M19 5 5 19"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg>',
    agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.5A4.5 4.5 0 0 1 9.5 4h5A4.5 4.5 0 0 1 19 8.5v2A4.5 4.5 0 0 1 14.5 15H11l-4 4v-4.5A4.5 4.5 0 0 1 5 10.5Z"/><path d="m17 3 .7 1.5L19 5l-1.3.5L17 7l-.7-1.5L15 5l1.3-.5Z"/></svg>',
    intent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11h6"/><path d="M9 15h4"/><path d="M5 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/><path d="M14 3v5h5"/></svg>',
    city: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  };

  const navItems = [
    { id: "home", label: "Home", href: "home-v3.html" },
    { id: "programs", label: "Programs", href: "#" },
    { id: "universities", label: "Universities", href: "universities.html" },
    { id: "scholarships", label: "Scholarships", href: "#" },
    { id: "cities", label: "Cities", href: "#" },
    { id: "guides", label: "Guides", href: "#" },
  ];

  const footerGroups = [
    {
      title: "Students",
      links: [
        ["Search programs", "#"],
        ["Universities", "universities.html"],
        ["Scholarships", "#"],
        ["City guides", "#"],
      ],
    },
    {
      title: "Apply to China",
      links: [
        ["Documents", "#"],
        ["HSK / IELTS", "#"],
        ["Visa and JW form", "#"],
        ["Intake calendar", "#"],
      ],
    },
    {
      title: "Partners",
      links: [
        ["Chinese universities", "#"],
        ["Advisers", "#"],
        ["Scholarship teams", "#"],
        ["Student services", "#"],
      ],
    },
    {
      title: "CUAC",
      links: [
        ["About us", "#"],
        ["Accessibility", "#"],
        ["Privacy", "#"],
        ["Terms", "#"],
      ],
    },
  ];

  function brand() {
    return '<a class="brand" href="home-v3.html"><span class="logo">CU</span><span>CUAC</span></a>';
  }

  function renderHeader(target) {
    const active = target.dataset.active || "home";
    const note = target.dataset.note || "China admissions 2026:";
    const noteDetail = target.dataset.noteDetail || "";
    target.outerHTML = `
      <div class="top-note">${note}${noteDetail ? `<span>&nbsp;${noteDetail}</span>` : ""}</div>
      <header class="nav">
        ${brand()}
        <nav class="nav-links" aria-label="Primary">
          ${navItems.map((item) => `<a class="${item.id === active ? "active" : ""}" href="${item.href}">${item.label}</a>`).join("")}
        </nav>
        <div class="nav-actions" aria-label="Account actions">
          <a class="nav-icon" href="#" aria-label="Search">${icons.search}</a>
          <a class="nav-icon" href="#" aria-label="Saved list">${icons.saved}</a>
          <a class="nav-icon" href="#" aria-label="Account">${icons.account}</a>
          <a class="sign-in" href="#">Sign in</a>
        </div>
      </header>
    `;
  }

  function renderFooter(target) {
    target.outerHTML = `
      <footer class="footer">
        <div class="footer-grid">
          <div>
            ${brand()}
            <p>China admissions search for international students applying to Chinese universities.</p>
            <div class="footer-actions">
              <a href="#">Contact us</a>
              <a href="#">Need help?</a>
            </div>
            <div class="socials" aria-label="Social links">
              <a href="#" aria-label="TikTok">${icons.tiktok}</a>
              <a href="#" aria-label="Instagram">${icons.instagram}</a>
              <a href="#" aria-label="Facebook">${icons.facebook}</a>
              <a href="#" aria-label="YouTube">${icons.youtube}</a>
              <a href="#" aria-label="LinkedIn">${icons.linkedin}</a>
              <a href="#" aria-label="X">${icons.x}</a>
            </div>
          </div>
          ${footerGroups
            .map((group) => `
              <div class="footer-col">
                <strong>${group.title}</strong>
                ${group.links.map(([label, href]) => `<a href="${href}">${label}</a>`).join("")}
              </div>
            `)
            .join("")}
        </div>
        <div class="footer-bottom">
          <span>© CUAC 2026</span>
          <div class="footer-legal">
            <a href="#">Cookie preferences</a>
            <a href="#">Data and source policy</a>
            <a href="#">Admissions clarity policy</a>
          </div>
        </div>
      </footer>
    `;
  }

  function renderAgentShell() {
    if (document.querySelector("[data-cuac-agent-shell]")) return;
    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <aside class="cuac-agent-panel" data-cuac-agent-panel data-cuac-agent-shell aria-hidden="true" inert>
          <div class="cuac-agent-panel-head">
            <div>
              <div class="cuac-agent-eyebrow">Agent workflow</div>
              <h2>CUAC agent workspace</h2>
              <p>How your study goal is being turned into routes.</p>
            </div>
            <button class="cuac-agent-close" type="button" data-cuac-agent-close aria-label="Collapse agent panel">${icons.close}</button>
          </div>
          <div class="cuac-agent-panel-body">
            <div class="cuac-agent-query">
              <strong>Current goal</strong>
              <span data-cuac-agent-query>English-taught computer science in Hangzhou</span>
            </div>
            <div class="cuac-agent-steps" data-cuac-agent-steps>
              ${[
                [icons.intent, "Understand intent", "Subject, city, language route, intake, and budget signals."],
                [icons.search, "Search matching programs", "Use program, university, and intake filters."],
                [icons.city, "Compare city context", "Balance city cost, campus fit, and student-life signal."],
                [icons.shield, "Check readiness", "Language proof, transcript, deadline, and scholarship blockers."],
                [icons.arrow, "Prepare next action", "Create a shortlist route the student can inspect."],
              ]
                .map(
                  ([icon, title, body], index) => `
                    <article class="cuac-agent-step ${index === 0 ? "active current" : ""}">
                      <span class="cuac-step-icon">${icon}</span>
                      <div><strong>${title}</strong><span>${body}</span></div>
                    </article>
                  `,
                )
                .join("")}
            </div>
          </div>
          <div class="cuac-agent-panel-foot">
            <a href="#">Open matching programs</a>
            <button type="button" data-cuac-agent-close>Keep browsing</button>
          </div>
        </aside>
        <button class="cuac-agent-reopen" type="button" data-cuac-agent-reopen aria-label="Open agent panel">${icons.agent}<span>Agent</span></button>
        <div class="cuac-agent-composer" data-cuac-agent-composer>
          <form class="cuac-agent-form" data-cuac-agent-form>
            <textarea class="cuac-agent-input" data-cuac-agent-input aria-label="Describe your China study goal" rows="2">English-taught computer science in Hangzhou</textarea>
            <button class="cuac-agent-send" type="submit" data-cuac-agent-submit aria-label="Send study goal">${icons.send}</button>
          </form>
        </div>
      `,
    );
  }

  function initAgentShell() {
    renderAgentShell();
    const inputs = Array.from(document.querySelectorAll("[data-cuac-agent-input], [data-planner-input]"));
    const forms = Array.from(document.querySelectorAll("[data-cuac-agent-form], [data-planner-form]"));
    const submits = Array.from(document.querySelectorAll("[data-cuac-agent-submit], [data-planner-submit]"));
    const composer = document.querySelector("[data-cuac-agent-composer]");
    const panel = document.querySelector("[data-cuac-agent-panel]");
    const reopen = document.querySelector("[data-cuac-agent-reopen]");
    const query = document.querySelector("[data-cuac-agent-query]");
    const steps = Array.from(document.querySelectorAll("[data-cuac-agent-steps] .cuac-agent-step"));
    let hasRun = false;
    let requestId = 0;
    let footerVisible = false;
    let nearPageEnd = false;

    function autoSize(input) {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 124)}px`;
    }

    function sync(value) {
      inputs.forEach((input) => {
        if (input.value !== value) input.value = value;
        autoSize(input);
      });
    }

    function setPanel(open) {
      if (!panel || !reopen) return;
      panel.classList.toggle("open", open);
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      reopen.classList.toggle("visible", hasRun && !open);
      if (open) {
        panel.removeAttribute("inert");
      } else {
        panel.setAttribute("inert", "");
      }
    }

    function updateComposerVisibility() {
      if (!composer) return;
      const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      nearPageEnd = remaining < 120;
      composer.classList.toggle("footer-hidden", footerVisible || nearPageEnd);
    }

    function runAgent(value) {
      hasRun = true;
      if (query) query.textContent = value;
      setPanel(true);
      steps.forEach((step, index) => {
        step.classList.toggle("active", index === 0);
        step.classList.remove("done");
        step.classList.toggle("current", index === 0);
        window.setTimeout(() => {
          steps.forEach((item, itemIndex) => {
            item.classList.toggle("active", itemIndex <= index);
            item.classList.toggle("done", itemIndex < index);
            item.classList.toggle("current", itemIndex === index);
          });
        }, index * 180);
      });
    }

    function submit(event) {
      event.preventDefault();
      const value = inputs[0]?.value.trim() || "";
      if (!value) {
        inputs[0]?.focus();
        return;
      }
      const currentRequest = ++requestId;
      sync(value);
      runAgent(value);
      submits.forEach((button) => {
        button.disabled = true;
        button.setAttribute("aria-label", "Reading study goal");
      });
      window.setTimeout(() => {
        if (currentRequest !== requestId) return;
        submits.forEach((button) => {
          button.disabled = false;
          button.setAttribute("aria-label", "Send study goal");
        });
      }, 720);
    }

    inputs.forEach((input) => {
      autoSize(input);
      input.addEventListener("input", (event) => sync(event.target.value));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          input.closest("form")?.requestSubmit();
        }
      });
    });

    forms.forEach((form) => form.addEventListener("submit", submit));
    document.querySelectorAll("[data-cuac-agent-close]").forEach((button) => {
      button.addEventListener("click", () => setPanel(false));
    });
    reopen?.addEventListener("click", () => setPanel(true));

    const footerBottom = document.querySelector(".footer-bottom");
    if ("IntersectionObserver" in window && footerBottom) {
      const footerObserver = new IntersectionObserver(
        ([entry]) => {
          footerVisible = entry.isIntersecting;
          updateComposerVisibility();
        },
        { threshold: 0.08 },
      );
      footerObserver.observe(footerBottom);
    }
    window.addEventListener("scroll", updateComposerVisibility, { passive: true });
    window.addEventListener("resize", updateComposerVisibility);
    updateComposerVisibility();
  }

  document.querySelectorAll("[data-cuac-header]").forEach(renderHeader);
  document.querySelectorAll("[data-cuac-footer]").forEach(renderFooter);
  initAgentShell();
})();
