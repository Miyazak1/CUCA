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
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/></svg>',
    expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5H5v3"/><path d="M5 5l6 6"/><path d="M16 19h3v-3"/><path d="m19 19-6-6"/></svg>',
  };

  const navItems = [
    { id: "home", label: "Home", href: "home-v3.html" },
    { id: "programs", label: "Programs", href: "programs.html" },
    { id: "universities", label: "Universities", href: "universities.html" },
    { id: "scholarships", label: "Scholarships", href: "scholarships.html" },
    { id: "cities", label: "Cities", href: "cities.html" },
    { id: "guides", label: "Guides", href: "guides.html" },
    { id: "hub", label: "Hub", href: "hub.html" },
  ];

  const footerGroups = [
    {
      title: "Students",
      links: [
        ["Search programs", "programs.html"],
        ["Universities", "universities.html"],
        ["Scholarships", "scholarships.html"],
        ["City guides", "cities.html"],
      ],
    },
    {
      title: "Apply to China",
      links: [
        ["Documents", "guides.html#documents"],
        ["HSK / IELTS", "guides.html#language"],
        ["Visa and JW form", "guides.html#visa"],
        ["Intake calendar", "guides.html#timeline"],
      ],
    },
    {
      title: "Partners",
      links: [
        ["Chinese universities", "universities.html"],
        ["Advisers", "home-v3.html#cuac-hub"],
        ["Scholarship teams", "scholarships.html"],
        ["Student services", "home-v3.html#cuac-hub"],
      ],
    },
    {
      title: "CUAC",
      links: [
        ["About us", "home-v3.html#cuac-hub"],
        ["Accessibility", "home-v3.html#application-guides"],
        ["Privacy", "home-v3.html#application-guides"],
        ["Terms", "home-v3.html#application-guides"],
      ],
    },
  ];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function containsAny(text, terms) {
    return terms.some((term) => text.includes(term));
  }

  const agentScenarios = [
    { group: "Start", label: "Clarify broad goal", prompt: "I want to study in China" },
    { group: "Search", label: "Find routes", prompt: "Find English-taught computer science master in Hangzhou" },
    { group: "Search", label: "University route", prompt: "Tell me about Zhejiang University and its English computer science route" },
    { group: "Summary", label: "Progress summary", prompt: "Summarize my progress and blockers" },
    { group: "Summary", label: "Saved shortlist", prompt: "Summarize my saved programs" },
    { group: "Documents", label: "Document checklist", prompt: "What documents do I need before Oct 15?" },
    { group: "Documents", label: "Translation", prompt: "Do I need certified transcript translation?" },
    { group: "Cost", label: "Annual cost", prompt: "How much will one year in Hangzhou cost?" },
    { group: "Cost", label: "Cheapest choice", prompt: "Which choice is cheapest?" },
    { group: "City", label: "City comparison", prompt: "Should I choose Hangzhou or Shanghai?" },
    { group: "Scholarship", label: "Funding route", prompt: "Can I get CSC scholarship for computer science master?" },
    { group: "Language", label: "HSK / IELTS", prompt: "Do I need HSK for English-taught computer science?" },
    { group: "Application", label: "Organize choices", prompt: "Organize my application choices by risk and deadline" },
    { group: "Application", label: "Add choice", prompt: "Help me add a specific program choice" },
    { group: "Navigation", label: "Open documents", prompt: "Open my documents page" },
    { group: "Risk", label: "No guarantees", prompt: "Will I definitely get scholarship?" },
  ];

  function renderScenarioMenu() {
    const grouped = agentScenarios.reduce((groups, scenario) => {
      if (!groups[scenario.group]) groups[scenario.group] = [];
      groups[scenario.group].push(scenario);
      return groups;
    }, {});
    return Object.entries(grouped)
      .map(([group, scenarios]) => `
        <div class="cuac-scenario-group">
          <span>${escapeHTML(group)}</span>
          ${scenarios
            .map((scenario) => `
              <button type="button" data-agent-scenario="${escapeHTML(scenario.prompt)}">
                <strong>${escapeHTML(scenario.label)}</strong>
                <small>${escapeHTML(scenario.prompt)}</small>
              </button>
            `)
            .join("")}
        </div>
      `)
      .join("");
  }

  function buildAgentScenario(rawPrompt, mode) {
    const prompt = String(rawPrompt || "").trim();
    const text = prompt.toLowerCase();
    const isApplication = mode === "application" || containsAny(text, ["application", "choice", "choices", "apply", "add choice", "order", "submission", "submit"]);
    const isSummary = containsAny(text, ["summarize", "summary", "progress", "status", "saved", "shortlist", "overview", "what do i have"]);
    const isTimeline = containsAny(text, ["deadline", "timeline", "date", "oct 15", "sep 12", "nov 10", "before", "days"]);
    const isRisk = containsAny(text, ["guarantee", "definitely", "sure", "official", "safe", "risk", "late", "after deadline", "promise"]);
    const isNavigation = containsAny(text, ["open", "show me", "take me", "go to", "where do i", "page"]);
    const isDocs = containsAny(text, ["document", "transcript", "translation", "certified", "checklist", "passport", "study plan", "jw", "visa"]);
    const isCost = containsAny(text, ["cost", "budget", "tuition", "rmb", "monthly", "calculate", "cheapest", "affordable"]);
    const isCity = mode === "cities" || containsAny(text, ["hangzhou", "shanghai", "nanjing", "beijing", "city", "cities", "chengdu"]);
    const isScholarship = mode === "scholarships" || containsAny(text, ["scholarship", "funding", "csc", "stipend", "waiver"]);
    const isLanguage = containsAny(text, ["hsk", "ielts", "english", "language", "chinese-taught", "english-taught"]);
    const isProgram = mode === "programs" || containsAny(text, ["program", "msc", "ba", "computer science", "business", "trade", "engineering"]);
    const isUniversity = mode === "universities" || containsAny(text, ["university", "zhejiang", "zju", "fudan", "uibe", "tsinghua", "tongji", "nanjing"]);

    if (containsAny(text, ["best", "which should i choose", "what should i study", "study in china"]) && !isProgram && !isCity) {
      return {
        type: "clarify",
        kicker: "Clarify first",
        title: "I need one more signal before giving a useful route.",
        summary: "China admissions depends on subject, degree level, teaching language, city budget, intake, and document readiness. Pick one direction and I can turn it into routes.",
        chips: ["Master", "English-taught", "Scholarship needed", "Lower-cost city", "Fall 2026"],
        actions: [
          { label: "Find programs", href: "programs.html", tone: "primary" },
          { label: "Compare cities", href: "cities.html" },
        ],
        source: "Demo uses CUAC page fixtures only. A real agent would ask follow-up questions before ranking.",
      };
    }

    if (isRisk) {
      return {
        type: "risk",
        kicker: "Needs review",
        title: "I should not treat this as guaranteed.",
        summary: "For admission, scholarship, deadline exceptions, visa/JW timing, or official policy certainty, the Agent should separate what CUAC knows from what still needs university or adviser confirmation.",
        cards: [
          { title: "What I can say now", meta: "From CUAC fixtures", body: "The route may be realistic if the program is open, documents are ready, and source dates are current.", tags: ["Known"] },
          { title: "What needs checking", meta: "Official source or adviser", body: "Final eligibility, exception approval, award result, visa/JW sequence, and submission validity.", tags: ["Do not promise"] },
        ],
        actions: [
          { label: "Open relevant guide", href: "guides.html", tone: "primary" },
          { label: "Save source check", action: "save-checklist" },
        ],
        source: "Demo boundary: the front-end can show caution and next steps, but cannot make official guarantees.",
      };
    }

    if (isSummary || mode === "hub") {
      return {
        type: "summary",
        kicker: "Student workspace",
        title: "Your current route has one strong option and two things to fix.",
        summary: "The saved route is coherent: Master, Computer Science, English-taught, Hangzhou. The two visible blockers are language proof and transcript translation before the Oct 15 deadline.",
        checklist: [
          ["Saved programs", "4 routes", "ZJU main route, Nanjing backup, UIBE funding-sensitive, Fudan stretch"],
          ["Documents", "3 missing", "Transcript translation, IELTS or waiver, study plan"],
          ["Earliest deadline", "Oct 15", "ZJU Computer Science MSc in demo data"],
          ["Budget fit", "Good", "Hangzhou and Nanjing stay below Shanghai cost"],
        ],
        actions: [
          { label: "Open Hub", href: "hub.html", tone: "primary" },
          { label: "Build checklist", action: "save-checklist" },
          { label: "Compare routes", action: "compare-routes" },
        ],
        source: "Demo summary uses saved-program, document, city-cost, and deadline fixtures.",
      };
    }

    if (isNavigation) {
      const destination = isDocs
        ? { label: "Open document guide", href: "guides.html#documents" }
        : isScholarship
          ? { label: "Open scholarships", href: "scholarships.html" }
          : isCity || isCost
            ? { label: "Open city comparison", href: "cities.html" }
            : isUniversity
              ? { label: "Open universities", href: "universities.html" }
              : isApplication
                ? { label: "Open application", href: "application.html" }
                : { label: "Open programs", href: "programs.html" };
      return {
        type: "navigation",
        kicker: "Page route",
        title: "I can take you to the right workspace.",
        summary: "The Agent should preview where it will send the student and why, so navigation feels intentional instead of like a blind link.",
        cards: [
          { title: destination.label, meta: "Recommended destination", body: "This page has the most relevant data and controls for your question.", tags: ["Page action"] },
        ],
        actions: [
          { label: destination.label, href: destination.href, tone: "primary" },
          { label: "Apply useful filters", action: "apply-smart-filters" },
        ],
        source: "Demo routing uses current page mode and prompt keywords.",
      };
    }

    if (isApplication && containsAny(text, ["add", "specific", "choice", "program"])) {
      return {
        type: "action",
        kicker: "Application action",
        title: "Add one concrete program as a choice.",
        summary: "A valid application choice should be one university plus one specific program, intake, and language route. In the real flow these fields come from the CUAC program database.",
        cards: [
          { title: "Zhejiang University", meta: "Computer Science MSc", body: "Fall 2026 · English-taught · RMB 42k · Oct 15", tags: ["Main route", "Needs IELTS"] },
          { title: "Nanjing University", meta: "Software Engineering MSc", body: "Fall 2026 · English-taught · RMB 39k · Dec 20", tags: ["Backup", "Ready to compare"] },
        ],
        actions: [
          { label: "Open add choice modal", action: "open-choice-modal", tone: "primary" },
          { label: "Ask Agent to prefill", action: "prefill-choice" },
        ],
        source: "Demo action only. It previews how later database-backed selectors will work.",
      };
    }

    if (isDocs || isTimeline) {
      return {
        type: isTimeline ? "deadline_plan" : "checklist",
        kicker: isTimeline ? "Timeline plan" : "Document plan",
        title: isTimeline ? "Work backwards from Oct 15." : "Start with shared documents, then handle program-specific proof.",
        summary: isTimeline
          ? "For a Fall 2026 route, the demo plan prioritizes translation and language proof first, then scholarship-sensitive forms."
          : "For this route, the shared blockers are transcript translation and language proof. Scholarship-sensitive programs add extra timing risk.",
        checklist: [
          ["Passport scan", "Ready", "Core profile"],
          ["Transcript", "Needs translation", "Use certified translation before submission"],
          ["IELTS or waiver evidence", "Needs review", "English-taught programs usually need proof"],
          ["Study plan", "Missing", "Required by scholarship-sensitive routes"],
          ["Program deadline", "Check date", "ZJU route closes Oct 15 in demo data"],
        ],
        actions: [
          { label: "Open guide", href: "guides.html#documents", tone: "primary" },
          { label: "Save checklist to Hub", action: "save-checklist" },
        ],
        source: "Based on CUAC guide fixtures and selected-route demo data.",
      };
    }

    if (isCost || (isCity && containsAny(text, ["compare", "lower", "budget", "affordable"]))) {
      return {
        type: "calculation",
        kicker: "Cost estimate",
        title: "Hangzhou is the safer first budget fit than Shanghai.",
        summary: "Using demo tuition and city estimates, Hangzhou keeps the annual total lower while still supporting strong English-taught computer science routes.",
        calculation: {
          total: "RMB 85k - 95k / year",
          formula: "ZJU tuition RMB 42k + living estimate RMB 3.6k x 12 + setup buffer",
          assumptions: ["Shared room or modest studio", "No major scholarship counted yet", "Visa, insurance, and arrival costs shown as a buffer"],
        },
        table: [
          ["Hangzhou", "RMB 3.6k/mo", "ZJU, lower daily cost", "Strong fit"],
          ["Nanjing", "RMB 3.4k/mo", "Good backup routes", "Good"],
          ["Shanghai", "RMB 5.2k/mo", "More internships, higher spend", "Cost risk"],
        ],
        actions: [
          { label: "Compare city routes", href: "cities.html", tone: "primary" },
          { label: "Save estimate", action: "save-cost-estimate" },
        ],
        source: "Demo estimate. Final costs need university fee pages and current city assumptions.",
      };
    }

    if (isCity) {
      return {
        type: "city_compare",
        kicker: "City fit",
        title: "Choose the city by study route, not lifestyle alone.",
        summary: "Hangzhou gives a lighter budget and strong ZJU routes. Shanghai gives more internships but raises annual cost. Nanjing is a strong backup if document timing matters.",
        table: [
          ["Hangzhou", "Lower cost", "ZJU, calm tech city", "Best first fit"],
          ["Nanjing", "Lower cost", "Good backup routes", "Backup"],
          ["Shanghai", "Higher cost", "Fudan/UIBE-style business and internship signal", "Stretch"],
        ],
        actions: [
          { label: "Open cities", href: "cities.html", tone: "primary" },
          { label: "Compare selected choices", action: "compare-routes" },
        ],
        source: "Demo city fit combines cost, university routes, and student-life signals.",
      };
    }

    if (isScholarship) {
      return {
        type: "recommendation",
        kicker: "Funding route",
        title: "Use scholarships as a parallel route, not a guarantee.",
        summary: "A strong application should keep one realistic tuition route while checking CSC, university, and city awards in parallel.",
        cards: [
          { title: "CSC route", meta: "High value, competitive", body: "Good for strong academic profiles, but deadlines and channels vary.", tags: ["Full funding", "Needs source check"] },
          { title: "University award", meta: "ZJU-style route", body: "Often more program-specific. Good backup to CSC.", tags: ["Partial funding", "Merit review"] },
          { title: "City award", meta: "Shanghai / Beijing routes", body: "May reduce tuition but can be offset by higher living cost.", tags: ["Local rules", "Date check"] },
        ],
        actions: [
          { label: "Open scholarships", href: "scholarships.html", tone: "primary" },
          { label: "Compare funding risk", action: "compare-funding" },
        ],
        source: "Demo source status separates verified routes from date-check routes.",
      };
    }

    if (isLanguage) {
      return {
        type: "answer",
        kicker: "Language route",
        title: "English-taught does not always mean no language evidence.",
        summary: "Many English-taught China programs do not require HSK first, but they commonly need IELTS, TOEFL, previous-English-study proof, or a waiver letter.",
        cards: [
          { title: "No HSK first", meta: "English-taught MSc", body: "Search by English route, then check each program's proof requirement.", tags: ["Good for CS", "Needs IELTS"] },
          { title: "Chinese-taught route", meta: "Higher language burden", body: "Use only if HSK level and timeline are realistic.", tags: ["HSK needed", "Longer prep"] },
        ],
        actions: [
          { label: "Open language guide", href: "guides.html#language", tone: "primary" },
          { label: "Find English routes", href: "programs.html" },
        ],
        source: "Demo answer from CUAC guide fixtures. Real checks must use official program pages.",
      };
    }

    if (isApplication) {
      return {
        type: "choices",
        kicker: "Choice strategy",
        title: "Keep one main route, one backup, and one funding-sensitive choice.",
        summary: "The current set is directionally good, but the order should reflect realism: documents first, then deadline, then funding uncertainty.",
        cards: [
          { title: "1. Zhejiang University", meta: "Computer Science MSc", body: "Main route. Strong fit, but IELTS and transcript translation need attention.", tags: ["Oct 15", "RMB 42k", "Needs review"] },
          { title: "2. Nanjing University", meta: "Software Engineering MSc", body: "Safer backup with lower cost and lower document burden.", tags: ["Dec 20", "RMB 39k", "Backup"] },
          { title: "3. UIBE", meta: "International Trade MSc", body: "Good business option, but funding timing should be checked.", tags: ["Nov 10", "Funding-sensitive"] },
        ],
        actions: [
          { label: "Confirm choice order", action: "confirm-choice-order", tone: "primary" },
          { label: "Add another choice", action: "open-choice-modal" },
        ],
        source: "Demo ranking uses saved choices, deadline, document effort, and funding-risk signals.",
      };
    }

    if (isUniversity || isProgram) {
      return {
        type: "programs",
        kicker: "Matched routes",
        title: "Start from specific programs, not just famous names.",
        summary: "For an international student, the useful unit is university + program + intake + language route + cost + document effort.",
        cards: [
          { title: "Computer Science MSc", meta: "Zhejiang University · Hangzhou", body: "English-taught · RMB 42k · Oct 15 · strong route with IELTS review.", tags: ["Main route", "Verified"] },
          { title: "Software Engineering MSc", meta: "Nanjing University · Nanjing", body: "English-taught · RMB 39k · Dec 20 · useful lower-burden backup.", tags: ["Backup", "Good cost"] },
          { title: "Data Science MSc", meta: "Fudan University · Shanghai", body: "Selective city route, stronger internship signal but higher living cost.", tags: ["Stretch", "Cost risk"] },
        ],
        actions: [
          { label: "Open programs", href: "programs.html", tone: "primary" },
          { label: "Compare these routes", action: "compare-routes" },
          { label: "Save to shortlist", action: "save-program-shortlist" },
        ],
        source: "Demo fixtures combine program, university, city, intake, and document signals.",
      };
    }

    return {
      type: "answer",
      kicker: "Quick answer",
      title: "I can turn that into routes, checks, or page actions.",
      summary: "For this demo, try asking for English-taught programs, city costs, scholarships, documents, or application choice order.",
      chips: ["Find programs", "Compare city cost", "Check documents", "Add a choice"],
      actions: [
        { label: "Open programs", href: "programs.html", tone: "primary" },
        { label: "Open Hub", href: "hub.html" },
        { label: "Apply useful filters", action: "apply-smart-filters" },
      ],
      source: "Demo response from local CUAC prototype fixtures.",
    };
  }

  function renderAgentScenario(scenario) {
    const chips = (scenario.chips || [])
      .map((chip) => `<span class="cuac-result-chip">${escapeHTML(chip)}</span>`)
      .join("");
    const cards = (scenario.cards || [])
      .map((card) => `
        <article class="cuac-result-card">
          <strong>${escapeHTML(card.title)}</strong>
          <span>${escapeHTML(card.meta || "")}</span>
          <p>${escapeHTML(card.body || "")}</p>
          <div>${(card.tags || []).map((tag) => `<em>${escapeHTML(tag)}</em>`).join("")}</div>
        </article>
      `)
      .join("");
    const checklist = (scenario.checklist || [])
      .map(([label, status, detail]) => `
        <li>
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(status)}</strong>
          <small>${escapeHTML(detail)}</small>
        </li>
      `)
      .join("");
    const table = (scenario.table || [])
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHTML(cell)}</td>`).join("")}</tr>`)
      .join("");
    const calculation = scenario.calculation
      ? `
        <div class="cuac-calculation-card">
          <strong>${escapeHTML(scenario.calculation.total)}</strong>
          <span>${escapeHTML(scenario.calculation.formula)}</span>
          <ul>${scenario.calculation.assumptions.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
        </div>
      `
      : "";
    const actions = (scenario.actions || [])
      .map((action) => {
        const className = `cuac-agent-action ${action.tone === "primary" ? "primary" : ""}`;
        if (action.href) return `<a class="${className}" href="${escapeHTML(action.href)}">${escapeHTML(action.label)}</a>`;
        return `<button class="${className}" type="button" data-agent-action="${escapeHTML(action.action || action.label)}">${escapeHTML(action.label)}</button>`;
      })
      .join("");

    return `
      <section class="cuac-agent-result" data-agent-result>
        <div class="cuac-result-head">
          <span>${escapeHTML(scenario.kicker || "Agent result")}</span>
          <strong>${escapeHTML(scenario.type || "answer")}</strong>
        </div>
        <h3>${escapeHTML(scenario.title)}</h3>
        <p>${escapeHTML(scenario.summary)}</p>
        ${chips ? `<div class="cuac-result-chips">${chips}</div>` : ""}
        ${cards ? `<div class="cuac-result-cards">${cards}</div>` : ""}
        ${checklist ? `<ul class="cuac-agent-checklist">${checklist}</ul>` : ""}
        ${calculation}
        ${table ? `<table class="cuac-result-table"><tbody>${table}</tbody></table>` : ""}
        ${actions ? `<div class="cuac-agent-actions">${actions}</div>` : ""}
        ${scenario.source ? `<div class="cuac-agent-source">${escapeHTML(scenario.source)}</div>` : ""}
      </section>
    `;
  }

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
          <a class="nav-icon" href="programs.html" aria-label="Saved list">${icons.saved}</a>
          <a class="account-pill" href="hub.html" aria-label="Open your CUAC Hub">
            ${icons.account}
            <span>Hub</span>
          </a>
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
              <a href="home-v3.html#cuac-hub">Contact us</a>
              <a href="home-v3.html#cuac-hub">Need help?</a>
            </div>
            <div class="socials" aria-label="Social links">
              <button type="button" aria-label="TikTok">${icons.tiktok}</button>
              <button type="button" aria-label="Instagram">${icons.instagram}</button>
              <button type="button" aria-label="Facebook">${icons.facebook}</button>
              <button type="button" aria-label="YouTube">${icons.youtube}</button>
              <button type="button" aria-label="LinkedIn">${icons.linkedin}</button>
              <button type="button" aria-label="X">${icons.x}</button>
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
            <a href="home-v3.html#application-guides">Cookie preferences</a>
            <a href="home-v3.html#application-guides">Data and source policy</a>
            <a href="home-v3.html#application-guides">Admissions clarity policy</a>
          </div>
        </div>
      </footer>
    `;
  }

  function renderAgentShell() {
    if (document.body.dataset.agentMode === "off") return;
    if (document.querySelector("[data-cuac-agent-shell]")) return;
    const agentMode = document.body.dataset.agentMode || "";
    const isScholarshipMode = agentMode === "scholarships";
    const isCitiesMode = agentMode === "cities";
    const isGuidesMode = agentMode === "guides";
    const isHubMode = agentMode === "hub";
    const isApplicationMode = agentMode === "application";
    const panelCopy = isApplicationMode
      ? {
          body: "How your selected schools and programs are being organized into a clearer China application set.",
          goal: "Organize my China application choices by risk, deadline, and document effort",
          steps: [
            [icons.intent, "Read selected choices", "Use saved programs, universities, cities, intake timing, tuition, language route, and source status."],
            [icons.search, "Rank application roles", "Separate main route, safer backup, funding-sensitive option, and choices that need more checking."],
            [icons.shield, "Find shared blockers", "Group common documents first, then program-specific proof, scholarship forms, and deadline risks."],
            [icons.city, "Check China context", "Compare city cost, campus route, funding path, and arrival timing before submission."],
            [icons.arrow, "Suggest next action", "Return the smallest useful action: confirm order, add choice, prepare document, or ask an adviser."],
          ],
        }
      : isHubMode
      ? {
          body: "How your Hub context is being turned into one clearer next action.",
          goal: "Check which saved route is most realistic",
          steps: [
            [icons.intent, "Read Hub context", "Use saved programs, onboarding profile, deadline, and document readiness signals."],
            [icons.search, "Compare shortlist", "Look across program, city, tuition, language route, source status, and deadline."],
            [icons.shield, "Find blockers", "Identify missing proof, translation, scholarship timing, and program-specific risks."],
            [icons.city, "Balance alternatives", "Check safer cities, lower document burden, and still-open routes."],
            [icons.arrow, "Prepare next action", "Return a concise route, checklist, or page action the student can inspect."],
          ],
        }
      : isScholarshipMode
      ? {
          body: "How your funding goal is being turned into scholarship routes.",
          goal: "Full scholarship for English-taught computer science master",
          steps: [
            [icons.intent, "Understand funding goal", "Degree level, subject, route type, country, and timing signals."],
            [icons.search, "Match scholarship types", "Compare CSC, university, province, city, and partner routes."],
            [icons.city, "Check fit and coverage", "Look at tuition, stipend, accommodation, insurance, and city cost."],
            [icons.shield, "Verify eligibility", "Confirm source, degree scope, deadline, documents, and language blockers."],
            [icons.arrow, "Prepare next route", "Suggest scholarships, programs, or universities to inspect next."],
          ],
        }
      : isCitiesMode
        ? {
            body: "How your city preference is being turned into a China study shortlist.",
            goal: "Affordable city for English-taught computer science",
            steps: [
              [icons.intent, "Understand city preference", "Budget, subject, language route, pace, climate, and lifestyle signals."],
              [icons.city, "Compare city fit", "Check monthly cost, daily pace, climate, and arrival context."],
              [icons.search, "Match study routes", "Connect cities to universities, programs, and English-taught options."],
              [icons.shield, "Check opportunity", "Review scholarship, internship, source, and support signals."],
              [icons.arrow, "Prepare next shortlist", "Suggest cities and program routes the student can inspect next."],
            ],
          }
        : isGuidesMode
          ? {
              body: "How your China application question is being turned into a clearer checklist.",
              goal: "Make me a Fall 2026 China application checklist",
              steps: [
                [icons.intent, "Understand application stage", "Identify whether the student is choosing, applying, waiting for offer, or preparing arrival."],
                [icons.shield, "Find blockers", "Check documents, language proof, deadline, scholarship, and source-status risks."],
                [icons.search, "Connect routes", "Link the guide question to programs, universities, scholarships, cities, or Hub."],
                [icons.city, "Map China context", "Account for city cost, university variation, visa/JW sequence, and arrival timing."],
                [icons.arrow, "Prepare next action", "Create a concise checklist or page route the student can inspect next."],
              ],
            }
        : {
          body: "How your study goal is being turned into routes.",
          goal: "English-taught computer science in Hangzhou",
          steps: [
            [icons.intent, "Understand intent", "Subject, city, language route, intake, and budget signals."],
            [icons.search, "Search matching programs", "Use program, university, and intake filters."],
            [icons.city, "Compare city context", "Balance city cost, campus fit, and student-life signal."],
            [icons.shield, "Check readiness", "Language proof, transcript, deadline, and scholarship blockers."],
            [icons.arrow, "Prepare next action", "Create a shortlist route the student can inspect."],
          ],
        };
    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <aside class="cuac-agent-panel" data-cuac-agent-panel data-cuac-agent-shell aria-hidden="true" inert>
          <button class="cuac-agent-resize" type="button" data-cuac-agent-resize aria-label="Expand agent panel" aria-pressed="false">${icons.expand}</button>
          <div class="cuac-agent-panel-head">
            <div>
              <div class="cuac-agent-eyebrow">Agent workflow</div>
              <h2>CUAC agent workspace</h2>
              <p>${panelCopy.body}</p>
            </div>
            <button class="cuac-agent-close" type="button" data-cuac-agent-close aria-label="Collapse agent panel">${icons.close}</button>
          </div>
          <div class="cuac-agent-panel-body">
            <div class="cuac-agent-query">
              <strong>Current goal</strong>
              <span data-cuac-agent-query>${panelCopy.goal}</span>
            </div>
            <div class="cuac-agent-steps" data-cuac-agent-steps>
              ${panelCopy.steps
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
            <div class="cuac-agent-results" data-cuac-agent-results aria-live="polite"></div>
            <div class="cuac-agent-log" data-cuac-agent-log aria-live="polite"></div>
          </div>
          <div class="cuac-agent-panel-composer-slot" data-cuac-agent-panel-composer></div>
        </aside>
        <button class="cuac-agent-reopen" type="button" data-cuac-agent-reopen aria-label="Open agent panel">${icons.agent}<span>Agent</span></button>
        <div class="cuac-agent-composer-host" data-cuac-agent-composer-host>
          <div class="cuac-agent-composer" data-cuac-agent-composer>
            <form class="cuac-agent-form" data-cuac-agent-form>
              <div class="cuac-scenario-picker" data-agent-scenario-picker>
                <button class="cuac-scenario-trigger" type="button" data-agent-scenario-trigger aria-expanded="false" aria-label="Choose a demo Agent scenario">
                  ${icons.spark}
                  <span>Scenarios</span>
                </button>
                <div class="cuac-scenario-menu" data-agent-scenario-menu hidden>
                  ${renderScenarioMenu()}
                </div>
              </div>
              <textarea class="cuac-agent-input" data-cuac-agent-input aria-label="Describe your China study goal" rows="2">${panelCopy.goal}</textarea>
              <button class="cuac-agent-send" type="submit" data-cuac-agent-submit aria-label="Send study goal">${icons.send}</button>
            </form>
          </div>
        </div>
      `,
    );
  }

  function initAgentShell() {
    renderAgentShell();
    const inputs = Array.from(document.querySelectorAll("[data-cuac-agent-input], [data-planner-input]"));
    const forms = Array.from(document.querySelectorAll("[data-cuac-agent-form], [data-planner-form]"));
    const submits = Array.from(document.querySelectorAll("[data-cuac-agent-submit], [data-planner-submit]"));
    const composerHost = document.querySelector("[data-cuac-agent-composer-host]");
    const panelComposerSlot = document.querySelector("[data-cuac-agent-panel-composer]");
    const composer = document.querySelector("[data-cuac-agent-composer]");
    const panel = document.querySelector("[data-cuac-agent-panel]");
    const reopen = document.querySelector("[data-cuac-agent-reopen]");
    const resizePanel = document.querySelector("[data-cuac-agent-resize]");
    const query = document.querySelector("[data-cuac-agent-query]");
    const steps = Array.from(document.querySelectorAll("[data-cuac-agent-steps] .cuac-agent-step"));
    const results = document.querySelector("[data-cuac-agent-results]");
    const actionLog = document.querySelector("[data-cuac-agent-log]");
    const primaryPlanner = document.querySelector("main [data-planner-form]");
    const scenarioPicker = document.querySelector("[data-agent-scenario-picker]");
    const scenarioTrigger = document.querySelector("[data-agent-scenario-trigger]");
    const scenarioMenu = document.querySelector("[data-agent-scenario-menu]");
    let hasRun = false;
    let requestId = 0;
    let footerVisible = false;
    let nearPageEnd = false;
    let primaryPlannerVisible = false;
    let beforePrimaryPlanner = false;
    let actionSequence = 0;

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
      composer?.classList.toggle("in-panel", open);
      if (open && panelComposerSlot && composer) {
        panelComposerSlot.appendChild(composer);
      } else if (!open && composerHost && composer) {
        composerHost.appendChild(composer);
      }
      if (open) {
        panel.removeAttribute("inert");
      } else {
        panel.setAttribute("inert", "");
      }
      updateComposerVisibility();
    }

    function updateComposerVisibility() {
      if (!composer) return;
      const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      nearPageEnd = remaining < 120;
      if (primaryPlanner) {
        const plannerRect = primaryPlanner.getBoundingClientRect();
        beforePrimaryPlanner = plannerRect.bottom > 96;
      }
      composer.classList.toggle(
        "footer-hidden",
        !composer.classList.contains("in-panel") && (footerVisible || nearPageEnd || primaryPlannerVisible || beforePrimaryPlanner),
      );
    }

    function runAgent(value) {
      hasRun = true;
      if (query) query.textContent = value;
      if (results) {
        results.innerHTML = `
          <div class="cuac-agent-working">
            <span></span>
            <strong>Reading CUAC context...</strong>
          </div>
        `;
      }
      if (actionLog) actionLog.innerHTML = "";
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
      window.setTimeout(() => {
        if (results) results.innerHTML = renderAgentScenario(buildAgentScenario(value, document.body.dataset.agentMode || ""));
      }, Math.max(820, steps.length * 180 + 160));
    }

    function fallbackAgentAction(actionId) {
      const targets = {
        "save-program-shortlist": "programs.html",
        "compare-routes": "programs.html",
        "apply-smart-filters": "programs.html",
        "open-choice-modal": "application.html",
        "prefill-choice": "application.html",
        "confirm-choice-order": "application.html",
        "save-checklist": "guides.html#documents",
        "compare-funding": "scholarships.html",
        "save-cost-estimate": "cities.html",
      };
      const target = targets[actionId];
      if (!target) return;
      window.setTimeout(() => {
        window.location.href = target;
      }, 520);
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
      if (document.activeElement instanceof HTMLElement && composer?.contains(document.activeElement)) {
        document.activeElement.blur();
      }
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

    function setScenarioMenu(open) {
      if (!scenarioTrigger || !scenarioMenu) return;
      scenarioTrigger.setAttribute("aria-expanded", open ? "true" : "false");
      scenarioMenu.hidden = !open;
      composer?.classList.toggle("menu-open", open);
    }

    scenarioTrigger?.addEventListener("click", () => {
      setScenarioMenu(scenarioMenu?.hidden !== false);
    });

    scenarioMenu?.addEventListener("click", (event) => {
      const option = event.target.closest("[data-agent-scenario]");
      if (!option) return;
      const prompt = option.dataset.agentScenario || "";
      sync(prompt);
      setScenarioMenu(false);
      inputs[0]?.focus();
    });

    document.addEventListener("click", (event) => {
      if (!scenarioPicker || scenarioPicker.contains(event.target)) return;
      setScenarioMenu(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setScenarioMenu(false);
    });

    forms.forEach((form) => form.addEventListener("submit", submit));
    document.querySelectorAll("[data-cuac-agent-close]").forEach((button) => {
      button.addEventListener("click", () => setPanel(false));
    });
    reopen?.addEventListener("click", () => setPanel(true));
    resizePanel?.addEventListener("click", () => {
      if (!panel) return;
      const wide = !panel.classList.contains("wide");
      panel.classList.toggle("wide", wide);
      resizePanel.setAttribute("aria-pressed", wide ? "true" : "false");
      resizePanel.setAttribute("aria-label", wide ? "Use compact agent panel" : "Expand agent panel");
    });
    document.addEventListener("click", (event) => {
      const action = event.target.closest("[data-agent-action]");
      if (!action || !results) return;
      event.preventDefault();
      const actionId = action.dataset.agentAction || "";
      const label = action.textContent.trim();
      const actionRunId = `agent-action-${++actionSequence}`;
      let undoToken = null;
      const agentActionEvent = new CustomEvent("cuac:agent-action", {
        bubbles: true,
        cancelable: true,
        detail: {
          action: actionId,
          label,
          runId: actionRunId,
          setUndo(token) {
            undoToken = token;
          },
        },
      });
      document.dispatchEvent(agentActionEvent);
      if (!agentActionEvent.defaultPrevented) fallbackAgentAction(actionId);
      const statusText = agentActionEvent.defaultPrevented ? "Applied" : "Prepared";
      if (actionLog) {
        const item = document.createElement("div");
        item.className = "cuac-agent-log-item";
        item.dataset.agentRunId = actionRunId;
        item.innerHTML = `
          <span>${statusText}</span>
          <strong>${escapeHTML(label)}</strong>
          <small>${agentActionEvent.defaultPrevented ? "Current page updated locally." : "Waiting for a page that can handle this action."}</small>
        `;
        actionLog.prepend(item);
      }
      const toast = document.createElement("div");
      toast.className = "cuac-agent-toast";
      toast.dataset.agentRunId = actionRunId;
      toast.dataset.agentAction = actionId;
      if (undoToken) toast.dataset.agentUndo = JSON.stringify(undoToken);
      toast.innerHTML = `
        <strong>${escapeHTML(label)}</strong>
        <span>${agentActionEvent.defaultPrevented ? "Demo action applied to the current page." : "Demo action prepared locally."} Real submission and persistence are intentionally not connected.</span>
        <button type="button" data-agent-toast-undo>Undo</button>
      `;
      results.prepend(toast);
      window.setTimeout(() => toast.classList.add("visible"), 20);
    });
    document.addEventListener("click", (event) => {
      const undoButton = event.target.closest("[data-agent-toast-undo]");
      if (!undoButton) return;
      const toast = undoButton.closest(".cuac-agent-toast");
      if (!toast) return;
      let undoPayload = null;
      try {
        undoPayload = toast.dataset.agentUndo ? JSON.parse(toast.dataset.agentUndo) : null;
      } catch {
        undoPayload = null;
      }
      const undoEvent = new CustomEvent("cuac:agent-undo", {
        bubbles: true,
        cancelable: true,
        detail: {
          action: toast.dataset.agentAction || "",
          runId: toast.dataset.agentRunId || "",
          undo: undoPayload,
        },
      });
      document.dispatchEvent(undoEvent);
      const logItem = toast.dataset.agentRunId ? document.querySelector(`.cuac-agent-log-item[data-agent-run-id="${toast.dataset.agentRunId}"]`) : null;
      if (logItem) {
        logItem.classList.add("undone");
        logItem.querySelector("span").textContent = undoEvent.defaultPrevented ? "Reverted" : "Dismissed";
        logItem.querySelector("small").textContent = undoEvent.defaultPrevented ? "Local page state restored." : "Agent feedback removed.";
      }
      toast.remove();
    });

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
    if ("IntersectionObserver" in window && primaryPlanner) {
      const plannerObserver = new IntersectionObserver(
        ([entry]) => {
          primaryPlannerVisible = entry.isIntersecting;
          updateComposerVisibility();
        },
        { rootMargin: "-80px 0px -25% 0px", threshold: 0.1 },
      );
      plannerObserver.observe(primaryPlanner);
    }
    window.addEventListener("scroll", updateComposerVisibility, { passive: true });
    window.addEventListener("resize", updateComposerVisibility);
    updateComposerVisibility();
  }

  function initPageReveal(root = document) {
    const motionOff = new URLSearchParams(window.location.search).get("motion") === "off";
    if (motionOff) document.body.classList.add("motion-off");

    const resultItems = Array.from(root.querySelectorAll(".result-enter:not(.visible)"));
    if (resultItems.length) {
      window.requestAnimationFrame(() => {
        resultItems.forEach((item) => item.classList.add("visible"));
      });
    }

    const revealItems = Array.from(root.querySelectorAll(".reveal:not([data-cuac-reveal-bound])"));
    if (!revealItems.length) return;

    if (!("IntersectionObserver" in window) || motionOff) {
      revealItems.forEach((item) => item.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    revealItems.forEach((item) => {
      item.dataset.cuacRevealBound = "true";
      observer.observe(item);
    });
  }

  document.querySelectorAll("[data-cuac-header]").forEach(renderHeader);
  document.querySelectorAll("[data-cuac-footer]").forEach(renderFooter);
  initAgentShell();
  window.CUAC = { ...(window.CUAC || {}), reveal: initPageReveal };
  initPageReveal();
})();
