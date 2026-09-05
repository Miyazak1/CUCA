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
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-2.1-.5 1.7 1.7 0 0 0-1 1.6V22H9.5v-.3a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-2.1.5l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.4-1H3v-4h.2a1.7 1.7 0 0 0 1.4-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 2.1.5 1.7 1.7 0 0 0 1-1.6V2h5v.3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 2.1-.5l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.4 1h.2v4h-.2a1.7 1.7 0 0 0-1.4 1Z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17 5 12l5-5"/><path d="M5 12h12"/><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/></svg>',
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

  const roleNavItems = [
    { id: "home", label: "首页", href: "home-v3.html" },
    { id: "programs", label: "项目", href: "programs.html" },
    { id: "universities", label: "大学", href: "universities.html" },
    { id: "scholarships", label: "奖学金", href: "scholarships.html" },
    { id: "cities", label: "城市", href: "cities.html" },
    { id: "guides", label: "指南", href: "guides.html" },
    { id: "hub", label: "工作台", href: "hub.html" },
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

  const footerGroupsZh = [
    {
      title: "学生",
      links: [
        ["搜索项目", "programs.html"],
        ["大学", "universities.html"],
        ["奖学金", "scholarships.html"],
        ["城市指南", "cities.html"],
      ],
    },
    {
      title: "申请中国",
      links: [
        ["申请材料", "guides.html#documents"],
        ["HSK / IELTS", "guides.html#language"],
        ["签证和 JW 表", "guides.html#visa"],
        ["入学日历", "guides.html#timeline"],
      ],
    },
    {
      title: "合作方",
      links: [
        ["中国高校", "universities.html"],
        ["顾问", "home-v3.html#cuac-hub"],
        ["奖学金团队", "scholarships.html"],
        ["学生服务", "home-v3.html#cuac-hub"],
      ],
    },
    {
      title: "CUAC",
      links: [
        ["关于我们", "home-v3.html#cuac-hub"],
        ["无障碍", "home-v3.html#application-guides"],
        ["隐私", "home-v3.html#application-guides"],
        ["条款", "home-v3.html#application-guides"],
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
    { group: "Favourites", label: "Review saved routes", prompt: "Summarize my saved routes and tell me which can become application choices" },
    { group: "Favourites", label: "Build shortlist", prompt: "Build my application shortlist from favourites" },
    { group: "Favourites", label: "Safest route", prompt: "Which saved route is safest for Fall 2026?" },
    { group: "Documents", label: "Document checklist", prompt: "What documents do I need before Oct 15?" },
    { group: "Documents", label: "Translation", prompt: "Do I need certified transcript translation?" },
    { group: "Cost", label: "Annual cost", prompt: "How much will one year in Hangzhou cost?" },
    { group: "Cost", label: "Cheapest choice", prompt: "Which choice is cheapest?" },
    { group: "City", label: "City comparison", prompt: "Should I choose Hangzhou or Shanghai?" },
    { group: "Scholarship", label: "Funding route", prompt: "Can I get CSC scholarship for computer science master?" },
    { group: "Language", label: "HSK / IELTS", prompt: "Do I need HSK for English-taught computer science?" },
    { group: "Application", label: "Organize choices", prompt: "Organize my application choices by risk and deadline" },
    { group: "Application", label: "Add choice", prompt: "Help me add a specific program choice" },
    { group: "Application", label: "Fee summary", prompt: "Explain my CUAC fee and submission next step" },
    { group: "Application", label: "Send to schools", prompt: "Submit my application to selected schools" },
    { group: "School", label: "Queue summary", prompt: "Summarize this school's CUAC application queue" },
    { group: "School", label: "Need contact", prompt: "Which Zhejiang University applicants need first contact?" },
    { group: "School", label: "Document request", prompt: "Prepare a document request template for the selected applicant" },
    { group: "School", label: "Tenant export", prompt: "Export this school's visible CUAC records" },
    { group: "Ops", label: "Agent audit", prompt: "Review denied Agent export requests" },
    { group: "Ops", label: "Routing health", prompt: "Summarize routing failures and payment mismatches" },
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
    const isPayment = containsAny(text, ["fee", "payment", "pay", "paid", "usd", "dollar", "first school", "extra school", "send to schools"]);
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
    const isSchool = mode === "school" || containsAny(text, ["school queue", "admissions", "tenant", "applicant", "applicants", "first contact", "export", "teacher", "document request"]);
    const isOps = mode === "ops" || containsAny(text, ["ops", "internal", "agent audit", "audit", "routing failure", "payment mismatch", "support lookup", "denied export", "data quality"]);

    if (isOps) {
      return {
        type: "ops_audit",
        kicker: "Internal Ops",
        title: containsAny(text, ["routing", "payment"]) ? "Ops Agent can summarize operational risk, but changes are confirmed." : "Review denied Agent actions with audit context.",
        summary: "CUAC Ops Agent context is internal and audited. It can summarize routing health, payment mismatches, support lookups, and Agent policy denials, but high-risk actions require confirmation before page state changes.",
        cards: [
          { title: "Agent denials", meta: "Policy review", body: "Denied export or cross-tenant requests should be reviewed with reason and audit trail.", tags: ["High risk", "Audited"] },
          { title: "Routing failures", meta: "Idempotency", body: "Retry actions should preserve idempotency and avoid duplicate school notifications.", tags: ["Ops"] },
          { title: "Support access", meta: "Reason required", body: "Raw support lookup must stay purpose-limited and visible in the audit log.", tags: ["Internal only"] },
        ],
        actions: [
          { label: "Review Agent audit", action: "ops-review-agent-audit", tone: "primary" },
          { label: "Open Ops control room", href: "ops-admin.html" },
        ],
        source: "Ops Agent mode is internal-only and requires confirmation for high-risk audit actions.",
      };
    }

    if (isSchool) {
      const isSchoolSettingsPage = currentRouteName() === "school-settings.html";
      return {
        type: "school_queue",
        kicker: "School tenant",
        title: isSchoolSettingsPage ? "School settings Agent can prepare tenant templates." : containsAny(text, ["export", "csv"]) ? "Export is tenant-scoped and needs confirmation." : "This summary only uses this school's visible records.",
        summary: "School staff Agent context is limited to the current tenant queue, visible filters, analytics, and document-request templates. It cannot see the student's other school choices or private long-term Agent memory.",
        cards: [
          { title: "Need first contact", meta: "Queue priority", body: "New and needs-review records should be contacted before waiting-document records.", tags: ["Tenant only", "Actionable"] },
          { title: "Documents", meta: "School asks directly", body: "Request transcript, passport scan, language proof, and program-specific forms through the school process.", tags: ["No CUAC files"] },
          { title: "Analytics", meta: "Programs and countries", body: "Use the visible charts to summarize route demand and regional mix.", tags: ["School scope"] },
        ],
        actions: isSchoolSettingsPage
          ? [
              { label: "Copy request template", action: "school-copy-request-template", tone: "primary" },
              { label: "Open applicant queue", href: "school-portal.html" },
            ]
          : [
              { label: "Copy request template", action: "school-copy-request-template", tone: "primary" },
              { label: "Mark selected contacted", action: "school-bulk-contact" },
              { label: "Export tenant CSV", action: "school-export-csv" },
            ],
        source: "School Agent mode uses tenant-scoped CUAC records only. Cross-school data and student private memory are blocked.",
      };
    }

    if (isPayment || (isApplication && containsAny(text, ["send", "submit", "submission"]))) {
      const isSubmitIntent = isApplication && containsAny(text, ["send", "submit", "submission"]);
      return {
        type: "payment",
        kicker: "Submission fee",
        title: isSubmitIntent ? "Submit only after you confirm the high-risk action." : "First school is included. Extra schools use a small CUAC routing fee.",
        summary: "CUAC charges USD 20 for each additional school after the first. The fee is based on distinct schools, not programs. After sending, schools contact the student directly for documents and official next steps.",
        checklist: [
          ["Pricing unit", "School", "Two programs at the same university still count as one school"],
          ["First school", "Included", "No CUAC fee is due when only one school is selected"],
          ["Extra school", "USD 20", "Current routing fee for each additional school"],
          ["After send", "School follows up", "CUAC does not collect documents in this flow"],
        ],
        actions: [
          isSubmitIntent
            ? { label: "Submit application set", action: "submit-application", tone: "primary" }
            : { label: "Review fee and send", action: "review-fee", tone: "primary" },
          { label: "Open application", href: "application.html" },
        ],
        source: "Fee logic uses selected distinct schools and the configurable extra-school fee.",
      };
    }

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
        source: "CUAC is using the current page context. The Agent may ask follow-up questions before ranking routes.",
      };
    }

    if (isRisk) {
      return {
        type: "risk",
        kicker: "Needs review",
        title: "I should not treat this as guaranteed.",
        summary: "For admission, scholarship, deadline exceptions, visa/JW timing, or official policy certainty, the Agent should separate what CUAC knows from what still needs university or adviser confirmation.",
        cards: [
          { title: "What I can say now", meta: "Current page context", body: "The route may be realistic if the program is open, documents are ready, and key dates are current.", tags: ["Known"] },
          { title: "What needs checking", meta: "Official notice or adviser", body: "Final eligibility, exception approval, award result, visa/JW sequence, and submission validity.", tags: ["Do not promise"] },
        ],
        actions: [
          { label: "Open relevant guide", href: "guides.html", tone: "primary" },
          { label: "Save detail check", action: "save-checklist" },
        ],
        source: "Planning boundary: CUAC can show caution and next steps, but cannot make official guarantees.",
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
          ["Earliest deadline", "Oct 15", "ZJU Computer Science MSc in current CUAC data"],
          ["Budget fit", "Good", "Hangzhou and Nanjing stay below Shanghai cost"],
        ],
        actions: [
          { label: "Open Hub", href: "hub.html", tone: "primary" },
          { label: "Build checklist", action: "save-checklist" },
          { label: "Compare routes", action: "compare-routes" },
        ],
        source: "Summary uses saved programs, document, city cost, and deadline context.",
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
        summary: "The Agent can explain where it will send the student and why, so navigation feels intentional instead of like a blind link.",
        cards: [
          { title: destination.label, meta: "Recommended destination", body: "This page has the most relevant data and controls for your question.", tags: ["Page action"] },
        ],
        actions: [
          { label: destination.label, href: destination.href, tone: "primary" },
          { label: "Apply useful filters", action: "apply-smart-filters" },
        ],
        source: "Routing uses current page mode and prompt keywords.",
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
          { label: "Prefill choice", action: "prefill-choice" },
        ],
        source: "Choice actions use the current page selector and CUAC program data.",
      };
    }

    if (isDocs || isTimeline) {
      return {
        type: isTimeline ? "deadline_plan" : "checklist",
        kicker: isTimeline ? "Timeline plan" : "Document plan",
        title: isTimeline ? "Work backwards from Oct 15." : "Start with shared documents, then handle program-specific proof.",
        summary: isTimeline
          ? "For a Fall 2026 route, the plan prioritizes translation and language proof first, then scholarship-sensitive forms."
          : "For this route, the shared blockers are transcript translation and language proof. Scholarship-sensitive programs add extra timing risk.",
        checklist: [
          ["Passport scan", "Ready", "Core profile"],
          ["Transcript", "Needs translation", "Use certified translation before submission"],
          ["IELTS or waiver evidence", "Needs review", "English-taught programs usually need proof"],
          ["Study plan", "Missing", "Required by scholarship-sensitive routes"],
          ["Program deadline", "Check date", "ZJU route closes Oct 15 in current CUAC data"],
        ],
        actions: [
          { label: "Open guide", href: "guides.html#documents", tone: "primary" },
          { label: "Save checklist to Hub", action: "save-checklist" },
        ],
        source: "Based on CUAC guide context and selected route information.",
      };
    }

    if (isCost || (isCity && containsAny(text, ["compare", "lower", "budget", "affordable"]))) {
      return {
        type: "calculation",
        kicker: "Cost estimate",
        title: "Hangzhou is the safer first budget fit than Shanghai.",
        summary: "Using CUAC tuition and city estimates, Hangzhou keeps the annual total lower while still supporting strong English-taught computer science routes.",
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
        source: "Planning estimate. Final costs need university fee pages and current city assumptions.",
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
        source: "City fit combines cost, university routes, and student-life signals.",
      };
    }

    if (isScholarship) {
      return {
        type: "recommendation",
        kicker: "Funding route",
        title: "Use scholarships as a parallel route, not a guarantee.",
        summary: "A strong application should keep one realistic tuition route while checking CSC, university, and city awards in parallel.",
        cards: [
          { title: "CSC route", meta: "High value, competitive", body: "Good for strong academic profiles, but deadlines and channels vary.", tags: ["Full funding", "Check notice"] },
          { title: "University award", meta: "ZJU-style route", body: "Often more program-specific. Good backup to CSC.", tags: ["Partial funding", "Merit review"] },
          { title: "City award", meta: "Shanghai / Beijing routes", body: "May reduce tuition but can be offset by higher living cost.", tags: ["Local rules", "Date check"] },
        ],
        actions: [
          { label: "Open scholarships", href: "scholarships.html", tone: "primary" },
          { label: "Compare funding risk", action: "compare-funding" },
        ],
        source: "Scholarship details should be checked against the official notice before the student relies on them.",
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
        source: "Answer based on CUAC guide context. Final checks should use official program pages.",
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
        source: "Route ranking uses saved choices, deadline, document effort, and funding-risk signals.",
      };
    }

    if (isUniversity || isProgram) {
      return {
        type: "programs",
        kicker: "Matched routes",
        title: "Start from specific programs, not just famous names.",
        summary: "For an international student, the useful unit is university + program + intake + language route + cost + document effort.",
        cards: [
          { title: "Computer Science MSc", meta: "Zhejiang University · Hangzhou", body: "English-taught · RMB 42k · Oct 15 · strong route with IELTS review.", tags: ["Main route", "Application ready"] },
          { title: "Software Engineering MSc", meta: "Nanjing University · Nanjing", body: "English-taught · RMB 39k · Dec 20 · useful lower-burden backup.", tags: ["Backup", "Good cost"] },
          { title: "Data Science MSc", meta: "Fudan University · Shanghai", body: "Selective city route, stronger internship signal but higher living cost.", tags: ["Stretch", "Cost risk"] },
        ],
        actions: [
          { label: "Open programs", href: "programs.html", tone: "primary" },
          { label: "Compare these routes", action: "compare-routes" },
          { label: "Save to shortlist", action: "save-program-shortlist" },
        ],
        source: "CUAC combines program, university, city, intake, and document signals.",
      };
    }

    return {
      type: "answer",
      kicker: "Quick answer",
      title: "I can turn that into routes, checks, or page actions.",
      summary: "Try asking for English-taught programs, city costs, scholarships, documents, or application choice order.",
      chips: ["Find programs", "Compare city cost", "Check documents", "Add a choice"],
      actions: [
        { label: "Open programs", href: "programs.html", tone: "primary" },
        { label: "Open Hub", href: "hub.html" },
        { label: "Apply useful filters", action: "apply-smart-filters" },
      ],
      source: "CUAC response from the current page context.",
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

  let authNavigationPending = false;
  let runtimeAuthState = {
    resolved: false,
    authState: "signed-out",
    role: "visitor",
    surface: "public",
    tenantSchoolId: null,
  };

  function runtimeSurface(role, selectedSurface) {
    if (role === "school_staff" || selectedSurface === "school") return "school-staff";
    if (["cuac_ops", "cuac_admin"].includes(role) || selectedSurface === "ops") return "cuac-internal";
    if (role === "student" || selectedSurface === "student") return "authenticated-student";
    return "public";
  }

  function getShellContext(target = {}) {
    const routeContract = window.CuacDataClient?.getRouteContract?.(currentRouteName()) || {};
    const portalRole = document.body.dataset.portalRole || target.dataset?.portalRole || "";
    const routeSurface = portalRole === "school" ? "school-staff" : routeContract.surface || "public";
    if (runtimeAuthState.authState === "signed-in") {
      return { authState: "signed-in", role: runtimeAuthState.role, surface: runtimeAuthState.surface };
    }
    return { authState: "signed-out", role: "visitor", surface: routeSurface };
  }

  function renderAccountMenu(target) {
    const shellContext = getShellContext(target);
    const authState = shellContext.authState;
    const userName = shellContext.role === "school_staff"
      ? "School staff account"
      : ["cuac_ops", "cuac_admin"].includes(shellContext.role)
        ? "CUAC internal account"
        : "Student account";
    const initial = userName.charAt(0).toUpperCase();

    if (authState === "signed-out") {
      const localized = ["school", "ops"].includes(document.body.dataset.agentMode || "");
      return `
        <button class="sign-in-pill" type="button" data-cuac-sign-in-trigger>
          ${icons.account}
          <span>${localized ? "登录" : "Sign in"}</span>
        </button>
      `;
    }

    const profileHref = shellContext.role === "school_staff" || shellContext.surface === "school-staff" ? "school-settings.html" : ["cuac_ops", "cuac_admin"].includes(shellContext.role) || shellContext.surface === "cuac-internal" ? "ops-admin.html" : "application.html#info";
    const accountLinks =
      shellContext.role === "school_staff" || shellContext.surface === "school-staff"
        ? [
            ["school-portal.html", icons.account, "学校工作台"],
            ["school-settings.html", icons.settings, "租户设置"],
            ["school-settings.html", icons.intent, "请求模板"],
          ]
        : ["cuac_ops", "cuac_admin"].includes(shellContext.role) || shellContext.surface === "cuac-internal"
          ? [
              ["ops-admin.html", icons.account, "运营后台"],
              ["ops-admin.html", icons.shield, "Agent 审计"],
              ["ops-admin.html", icons.search, "数据质量"],
            ]
          : [
              ["hub.html", icons.account, "Hub"],
              ["application.html#info", icons.shield, "Student info"],
              ["notifications.html", icons.bell, "Notifications"],
              ["favourites.html", icons.saved, "Favourites"],
              ["billing.html", icons.intent, "Billing"],
              ["preferences.html", icons.settings, "Preferences"],
            ];

    return `
      <div class="account-menu" data-account-menu>
        <button class="account-avatar-button" type="button" data-account-menu-trigger aria-expanded="false" aria-label="${["school_staff", "cuac_ops", "cuac_admin"].includes(shellContext.role) ? "打开账号菜单" : "Open account menu"}">
          <span class="account-avatar">${escapeHTML(initial)}</span>
        </button>
        <div class="account-popover" data-account-menu-popover hidden>
          <div class="account-popover-head">
            <span class="account-avatar large">${escapeHTML(initial)}</span>
            <div>
              <strong>${escapeHTML(userName)}</strong>
              <a href="${profileHref}">${["school_staff", "cuac_ops", "cuac_admin"].includes(shellContext.role) ? "编辑账号" : "Student info"}</a>
            </div>
          </div>
          ${accountLinks.map(([href, icon, label]) => `<a href="${href}">${icon}<span>${label}</span></a>`).join("")}
          <a href="auth.html" class="account-signout">${icons.logout}<span>${["school_staff", "cuac_ops", "cuac_admin"].includes(shellContext.role) ? "退出登录" : "Sign out"}</span></a>
        </div>
      </div>
    `;
  }

  function normalizeActiveNav(active) {
    if (["favourites", "notifications", "preferences", "auth"].includes(active)) return "hub";
    return active;
  }

  function shouldShowSavedShortcut(shellContext) {
    return shellContext.authState === "signed-in" && shellContext.role === "student" && !["school-staff", "cuac-internal"].includes(shellContext.surface);
  }

  function renderSavedShortcut() {
    return `<a class="nav-icon" data-nav-saved-shortcut href="favourites.html" aria-label="Saved list">${icons.saved}</a>`;
  }

  function renderHeader(target) {
    const active = normalizeActiveNav(target.dataset.active || "home");
    const note = target.dataset.note || "China admissions 2026:";
    const noteDetail = target.dataset.noteDetail || "";
    const shellContext = getShellContext(target);
    const showSavedShortcut = shouldShowSavedShortcut(shellContext);
    const localizedNav = ["school_staff", "cuac_ops", "cuac_admin"].includes(shellContext.role) || ["school", "ops"].includes(document.body.dataset.agentMode || "");
    const headerNavItems = localizedNav ? roleNavItems : navItems;
    target.outerHTML = `
      <div class="top-note">${note}${noteDetail ? `<span>&nbsp;${noteDetail}</span>` : ""}</div>
      <header class="nav">
        ${brand()}
        <nav class="nav-links" aria-label="${localizedNav ? "主导航" : "Primary"}">
          ${headerNavItems.map((item) => `<a class="${item.id === active ? "active" : ""}" href="${item.href}">${item.label}</a>`).join("")}
        </nav>
        <div class="nav-actions" aria-label="Account actions">
          ${showSavedShortcut ? renderSavedShortcut() : ""}
          ${renderAccountMenu(target)}
        </div>
      </header>
    `;
  }

  function renderFooter(target) {
    const localized = ["school", "ops"].includes(document.body.dataset.agentMode || "");
    const groups = localized ? footerGroupsZh : footerGroups;
    target.outerHTML = `
      <footer class="footer">
        <div class="footer-grid">
          <div>
            ${brand()}
            <p>${localized ? "面向国际学生申请中国高校的招生搜索与管理平台。" : "China admissions search for international students applying to Chinese universities."}</p>
            <div class="footer-actions">
              <a href="home-v3.html#cuac-hub">${localized ? "联系我们" : "Contact us"}</a>
              <a href="home-v3.html#cuac-hub">${localized ? "需要帮助？" : "Need help?"}</a>
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
          ${groups
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
            <a href="home-v3.html#application-guides">${localized ? "Cookie 偏好" : "Cookie preferences"}</a>
            <a href="home-v3.html#application-guides">${localized ? "数据与来源政策" : "Data and source policy"}</a>
            <a href="home-v3.html#application-guides">${localized ? "招生透明政策" : "Admissions clarity policy"}</a>
          </div>
        </div>
      </footer>
    `;
  }

  function currentRouteName() {
    return window.location.pathname.split("/").pop() || "home-v3.html";
  }

  const protectedStudentRoutes = new Set(["onboarding.html", "hub.html", "favourites.html", "application.html", "billing.html", "notifications.html", "preferences.html"]);
  const protectedRoleRoutes = {
    "school-portal.html": { role: "school_staff", title: "Sign in to CUAC" },
    "school-settings.html": { role: "school_staff", title: "Sign in to CUAC" },
    "ops-admin.html": { role: "cuac_ops", title: "Sign in to CUAC" },
  };

  function routeNameFromHref(href) {
    try {
      const url = new URL(href, window.location.href);
      return url.pathname.split("/").pop() || "home-v3.html";
    } catch {
      return String(href || "").split(/[?#]/)[0].split("/").pop();
    }
  }

  function authRoleParam(role) {
    if (role === "school_staff") return "school";
    if (role === "cuac_ops") return "ops";
    return "student";
  }

  function currentRelativeUrl() {
    return `${currentRouteName()}${window.location.search || ""}${window.location.hash || ""}`;
  }

  function normalizeContinuationTarget(value) {
    try {
      const url = new URL(value || currentRelativeUrl(), window.location.href);
      if (url.origin !== window.location.origin || url.search) return null;
      return `${url.pathname}${url.hash}`;
    } catch {
      return null;
    }
  }

  function continuationRequestFor(options = {}) {
    const requiredRole = options.requiredRole || options.role || "student";
    let targetRoute = normalizeContinuationTarget(options.returnUrl);
    let actionKey = options.actionKey || "";

    if (actionKey === "application.open_add_choice") actionKey = "application.add_choice";
    if (actionKey === "application.add_choice") targetRoute = "/application.html#add-choice";
    if (!actionKey && targetRoute === "/application.html#add-choice") actionKey = "application.add_choice";

    const route = routeNameFromHref(targetRoute || "");
    if (!actionKey && requiredRole === "student" && protectedStudentRoutes.has(route)) actionKey = "navigation.open_student_workspace";
    if (!actionKey && requiredRole === "school_staff" && ["school-portal.html", "school-settings.html"].includes(route)) actionKey = "navigation.open_school_workspace";
    if (!actionKey && requiredRole === "cuac_ops" && route === "ops-admin.html") actionKey = "navigation.open_ops_workspace";
    if (!targetRoute || !actionKey) return null;

    return {
      targetRoute,
      actionKey,
      requiredRole,
      payloadPreview: options.payloadPreview || {},
    };
  }

  async function createServerContinuation(input) {
    const guestResponse = await fetch("/api/v1/auth/guest-session", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: "{}",
    });
    if (!guestResponse.ok) throw new Error("Guest browser session could not be initialized.");

    const response = await fetch("/api/v1/auth/sign-in-continuations", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || "The saved navigation could not be created.");
    const continuation = payload?.data;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(continuation?.continuationId || "")
      || !/^[A-Za-z0-9_-]{43}$/.test(continuation?.continuationToken || "")) {
      throw new Error("The saved navigation response was invalid.");
    }
    return continuation;
  }

  function dataAttributeSelector(attribute, value) {
    const safeValue = String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `[${attribute}="${safeValue}"]`;
  }

  function navigateToAuthPage(options = {}) {
    const params = new URLSearchParams();
    if (options.selectedRole) params.set("role", authRoleParam(options.selectedRole));
    if (options.capability) params.set("continue", "1");
    if (options.mode === "register") params.set("mode", "register");
    const query = params.toString();
    const capability = options.capability
      ? `#continuation=${encodeURIComponent(`${options.capability.continuationId}.${options.capability.continuationToken}`)}`
      : "";
    window.location.href = `${query ? `auth.html?${query}` : "auth.html"}${capability}`;
  }

  function refreshRenderedHeader() {
    const header = document.querySelector("header.nav");
    const navActions = header?.querySelector(".nav-actions");
    if (!header || !navActions) return;
    const shellContext = getShellContext();
    navActions.innerHTML = `${shouldShowSavedShortcut(shellContext) ? renderSavedShortcut() : ""}${renderAccountMenu({ dataset: {} })}`;
    initAccountMenus();
  }

  async function loadRuntimeAuthState() {
    try {
      const response = await fetch("/api/v1/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      const actor = response.ok ? payload?.data : null;
      const role = actor?.activeRole;
      const allowedRole = ["student", "school_staff", "cuac_ops", "cuac_admin"].includes(role);
      runtimeAuthState = actor?.actorUserId && allowedRole
        ? {
            resolved: true,
            authState: "signed-in",
            role,
            surface: runtimeSurface(role, actor.selectedSurface),
            tenantSchoolId: actor.tenantSchoolId || null,
          }
        : { resolved: true, authState: "signed-out", role: "visitor", surface: "public", tenantSchoolId: null };
    } catch {
      runtimeAuthState = { resolved: true, authState: "signed-out", role: "visitor", surface: "public", tenantSchoolId: null };
    }

    refreshRenderedHeader();
    initProtectedStudentPage();
    initProtectedRolePage();
    return runtimeAuthState;
  }

  function showSignInRequired(labelOrOptions = "Use this feature", maybeOptions = {}) {
    const options = labelOrOptions && typeof labelOrOptions === "object" ? labelOrOptions : maybeOptions;
    if (authNavigationPending) return;
    authNavigationPending = true;
    void (async () => {
      let capability = null;
      const continuationRequest = continuationRequestFor(options);
      if (continuationRequest) {
        try {
          capability = await createServerContinuation(continuationRequest);
        } catch {
          capability = null;
        }
      }
      navigateToAuthPage({
        capability,
        mode: options.mode,
        selectedRole: options.requiredRole || options.role,
      });
    })();
  }

  function requireSignedIn(label = "Use this feature", afterSignIn) {
    if (getShellContext().authState === "signed-in") return true;
    const options = typeof afterSignIn === "object" && afterSignIn ? afterSignIn : {};
    showSignInRequired(label, options);
    return false;
  }

  function isStudentSignedIn() {
    const shellContext = getShellContext();
    return shellContext.authState === "signed-in" && shellContext.role === "student";
  }

  function requireStudentSignedIn(label = "Use this feature", afterSignIn) {
    if (isStudentSignedIn()) return true;
    const options = typeof afterSignIn === "object" && afterSignIn ? afterSignIn : {};
    showSignInRequired(label, { ...options, role: "student" });
    return false;
  }

  function initProtectedStudentLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link) return;
      if (currentRouteName() === "auth.html") return;
      const route = routeNameFromHref(link.getAttribute("href") || "");
      if (!protectedStudentRoutes.has(route)) return;
      if (isStudentSignedIn()) return;
      const href = link.href;
      event.preventDefault();
      if (!runtimeAuthState.resolved) {
        void runtimeAuthReadyPromise.then(() => {
          if (isStudentSignedIn()) window.location.assign(href);
          else showSignInRequired(link.textContent.trim() || "Open student workspace", { requiredRole: "student", returnUrl: href });
        });
        return;
      }
      showSignInRequired(link.textContent.trim() || "Open student workspace", { requiredRole: "student", returnUrl: href });
    });
  }

  function initProtectedStudentPage() {
    const route = currentRouteName();
    if (!protectedStudentRoutes.has(route)) return;
    if (!runtimeAuthState.resolved) return;
    const shellContext = getShellContext();
    if (shellContext.surface !== "authenticated-student") return;
    if (isStudentSignedIn()) return;
    window.setTimeout(() => {
      if (isStudentSignedIn() || currentRouteName() === "auth.html") return;
      showSignInRequired("Sign in to open your student workspace", { requiredRole: "student" });
    }, 160);
  }

  function isRequiredRoleSignedIn(requiredRole) {
    const shellContext = getShellContext();
    if (shellContext.authState !== "signed-in") return false;
    if (requiredRole === "cuac_ops") return ["cuac_ops", "cuac_admin"].includes(shellContext.role);
    return shellContext.role === requiredRole;
  }

  function initProtectedRolePage() {
    const route = currentRouteName();
    const requirement = protectedRoleRoutes[route];
    if (!requirement) return;
    if (!runtimeAuthState.resolved) return;
    if (isRequiredRoleSignedIn(requirement.role)) return;
    window.setTimeout(() => {
      if (isRequiredRoleSignedIn(requirement.role) || currentRouteName() === "auth.html") return;
      showSignInRequired(requirement.title, { requiredRole: requirement.role });
    }, 160);
  }

  function initAuthNavigationControls() {
    document.addEventListener("click", (event) => {
      const signInTrigger = event.target.closest("[data-cuac-sign-in-trigger]");
      if (!signInTrigger) return;
      event.preventDefault();
      navigateToAuthPage();
    });
  }

  function getAgentContextPolicy() {
    const header = document.querySelector("[data-cuac-header]");
    const routeContract = window.CuacDataClient?.getRouteContract?.(currentRouteName()) || {};
    const shellContext = getShellContext(header || {});
    return window.CuacDataClient?.getAgentContextPolicy?.({ authState: shellContext.authState, role: shellContext.role, surface: routeContract.surface }) || {
      label: shellContext.authState === "signed-in" ? "Signed-in context" : "Guest page context",
      retentionCopy: shellContext.authState === "signed-in" ? "Uses signed-in workspace context." : "Uses only this page while it is open.",
      storage: shellContext.authState === "signed-in" ? "account" : "memory",
      retention: shellContext.authState === "signed-in" ? "application-lifecycle" : "current-page-session",
    };
  }

  function collectAgentEntityContext(sourceElement = null) {
    const detailRoot = document.querySelector("[data-detail-root]");
    const sourceHost = sourceElement?.closest?.("[data-entity-type], [data-detail-root], [data-choice], [data-saved-item], [data-school-status]");
    const entityHost = sourceHost || (detailRoot?.dataset.detailEntityType ? detailRoot : null);
    const dataset = entityHost?.dataset || {};
    const entityType =
      dataset.entityType ||
      dataset.detailEntityType ||
      (dataset.programId ? "SchoolProgram" : dataset.schoolId ? "School" : dataset.noticeId ? "Notification" : "");
    const entityId = dataset.entityId || dataset.detailEntityId || dataset.programId || dataset.schoolId || dataset.noticeId || dataset.choice || "";
    const sourceModel = dataset.sourceModel || dataset.detailSourceModel || "";
    return {
      entityType,
      entityId,
      sourceModel,
      noticeId: dataset.noticeId || "",
      schoolId: dataset.schoolId || "",
      programId: dataset.programId || "",
      school: dataset.school || dataset.schoolStatus || "",
      program: dataset.program || dataset.programName || "",
    };
  }

  function collectAgentInvocationContext(sourceElement = null, prompt = "") {
    const header = document.querySelector("[data-cuac-header]");
    const route = currentRouteName();
    const routeContract = window.CuacDataClient?.getRouteContract?.(route) || {};
    const shellContext = getShellContext(header || {});
    const contextPolicy = getAgentContextPolicy();
    return {
      prompt,
      route,
      agentMode: document.body.dataset.agentMode || "",
      surface: shellContext.surface || routeContract.surface || "",
      authState: shellContext.authState || "",
      role: shellContext.role || "",
      contextPolicy,
      entity: collectAgentEntityContext(sourceElement),
    };
  }

  function readAgentContextStore(storage, key) {
    if (!storage || !key) return null;
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function writeAgentContextStore(storage, key, value) {
    if (!storage || !key) return;
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage may be unavailable in private or restricted browser contexts.
    }
  }

  function persistAgentInvocationContext(context = {}) {
    const policy = context.contextPolicy || {};
    const key = policy.storageKey || (policy.storage === "account" ? "cuacStudentAgentMemory" : "cuacGuestAgentPageContext");
    const storage = policy.storage === "account" || policy.storage === "internal-audit" ? window.localStorage : window.sessionStorage;
    const previous = readAgentContextStore(storage, key) || {};
    const entry = {
      prompt: context.prompt || "",
      route: context.route || "",
      surface: context.surface || "",
      role: context.role || "",
      authState: context.authState || "",
      retention: policy.retention || "",
      storage: policy.storage || "",
      entity: context.entity || {},
      createdAt: new Date().toISOString(),
    };
    writeAgentContextStore(storage, key, {
      status: policy.storage === "account" ? "active" : "session-active",
      retention: policy.retention || "",
      storage: policy.storage || "",
      storageKey: key,
      updatedAt: entry.createdAt,
      entries: [entry, ...(Array.isArray(previous.entries) ? previous.entries : [])].slice(0, 12),
    });
  }

  function renderAgentShell() {
    if (document.body.dataset.agentMode === "off") return;
    if (document.querySelector("[data-cuac-agent-shell]")) return;
    const agentMode = document.body.dataset.agentMode || "";
    const contextPolicy = getAgentContextPolicy();
    const isScholarshipMode = agentMode === "scholarships";
    const isCitiesMode = agentMode === "cities";
    const isGuidesMode = agentMode === "guides";
    const isHubMode = agentMode === "hub";
    const isFavouritesMode = agentMode === "favourites";
    const isApplicationMode = agentMode === "application";
    const isSchoolMode = agentMode === "school";
    const panelCopy = isApplicationMode
      ? {
          body: "How your selected schools and programs are being organized into a clearer China application set.",
          goal: "Organize my China application choices by risk, deadline, and document effort",
        steps: [
          [icons.intent, "Read selected choices", "Use saved programs, universities, cities, intake timing, tuition, language route, and official detail checks."],
          [icons.search, "Rank application roles", "Separate main route, safer backup, funding-sensitive option, and choices that need more checking."],
          [icons.shield, "Check shareable info", "Confirm contact, study profile, academic summary, and consent before schools receive the record."],
          [icons.city, "Calculate fee", "First school included; each additional school uses the configured extra-school fee."],
          [icons.arrow, "Send to school portals", "After payment or free confirmation, schools receive the record and contact the student directly."],
        ],
      }
      : isHubMode
      ? {
          body: "How your Hub context is being turned into one clearer next action.",
          goal: "Check which saved route is most realistic",
          steps: [
            [icons.intent, "Read Hub context", "Use saved programs, onboarding profile, deadline, and document readiness signals."],
            [icons.search, "Compare shortlist", "Look across program, city, tuition, language route, official details, and deadline."],
            [icons.shield, "Find blockers", "Identify missing proof, translation, scholarship timing, and program-specific risks."],
            [icons.city, "Balance alternatives", "Check safer cities, lower document burden, and still-open routes."],
            [icons.arrow, "Prepare next action", "Return a concise route, checklist, or page action the student can inspect."],
          ],
        }
      : isFavouritesMode
      ? {
          body: "How your saved programs, universities, scholarships, cities, and guides are becoming application-ready routes.",
          goal: "Review my saved routes",
          steps: [
            [icons.intent, "Read saved items", "Separate concrete program routes from university, scholarship, city, and guide interests."],
            [icons.search, "Rank route fit", "Compare deadline, tuition, language route, official details, and document effort."],
            [icons.shield, "Find blockers", "Flag items that need scholarship, language, deadline, or document checks."],
            [icons.city, "Connect context", "Use saved cities and scholarships to explain budget and funding-sensitive routes."],
            [icons.arrow, "Prepare next action", "Suggest shortlist, compare, checklist, or application-set actions."],
          ],
        }
      : isSchoolMode
        ? {
            body: "How this school tenant queue is being summarized and prepared for staff follow-up.",
            goal: "Summarize this school's CUAC application queue",
            steps: [
              [icons.intent, "Read tenant queue", "Use only this school's visible CUAC records, filters, status, owner, and priority fields."],
              [icons.search, "Summarize analytics", "Look at program demand, source mix, funding signals, country mix, and pipeline status."],
              [icons.shield, "Protect scope", "Do not reveal other school choices, student private memory, or cross-tenant data."],
              [icons.account, "Prepare staff action", "Draft contact steps, copy request templates, or mark selected records after confirmation."],
              [icons.arrow, "Audit sensitive actions", "Exports and bulk updates stay tenant-scoped and high-risk actions require confirmation."],
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
            <div class="cuac-agent-context" data-agent-context-policy data-agent-context-retention="${escapeHTML(contextPolicy.retention || "")}" data-agent-context-storage="${escapeHTML(contextPolicy.storage || "")}">
              <strong>${escapeHTML(contextPolicy.label || "Agent context")}</strong>
              <span>${escapeHTML(contextPolicy.retentionCopy || "")}</span>
            </div>
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
                <button class="cuac-scenario-trigger" type="button" data-agent-scenario-trigger aria-expanded="false" aria-label="Choose an Agent scenario">
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
    const composerAvoidZones = Array.from(document.querySelectorAll("[data-agent-composer-avoid]"));
    const scenarioPicker = document.querySelector("[data-agent-scenario-picker]");
    const scenarioTrigger = document.querySelector("[data-agent-scenario-trigger]");
    const scenarioMenu = document.querySelector("[data-agent-scenario-menu]");
    let hasRun = false;
    let requestId = 0;
    let footerVisible = false;
    let nearPageEnd = false;
    let primaryPlannerVisible = false;
    let beforePrimaryPlanner = false;
    let composerAvoidVisible = false;
    let actionSequence = 0;
    let activeAgentContext = null;

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
        !composer.classList.contains("in-panel") && (footerVisible || nearPageEnd || primaryPlannerVisible || beforePrimaryPlanner || composerAvoidVisible),
      );
    }

    function runAgent(value, sourceElement = null) {
      hasRun = true;
      activeAgentContext = collectAgentInvocationContext(sourceElement, value);
      persistAgentInvocationContext(activeAgentContext);
      if (query) query.textContent = value;
      if (results) {
        results.dataset.agentEntityType = activeAgentContext.entity.entityType || "";
        results.dataset.agentEntityId = activeAgentContext.entity.entityId || "";
        results.dataset.agentSourceModel = activeAgentContext.entity.sourceModel || "";
        results.dataset.agentContextRetention = activeAgentContext.contextPolicy.retention || "";
        results.dataset.agentContextStorage = activeAgentContext.contextPolicy.storage || "";
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

    function launchAgentPrompt(prompt, sourceElement = null) {
      const value = String(prompt || "").trim();
      if (!value) return;
      sync(value);
      runAgent(value, sourceElement);
      if (document.activeElement instanceof HTMLElement && composer?.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    }

    function fallbackAgentAction(actionId) {
      const targets = {
        "save-program-shortlist": "programs.html",
        "compare-routes": "programs.html",
        "apply-smart-filters": "programs.html",
        "open-choice-modal": "application.html#add-choice",
        "prefill-choice": "application.html",
        "confirm-choice-order": "application.html",
        "review-fee": "application.html",
        "submit-application": "application.html",
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
      runAgent(value, event.submitter || event.target);
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

    document.addEventListener("click", (event) => {
      const promptTrigger = event.target.closest("[data-agent-prompt]");
      if (!promptTrigger || document.body.dataset.agentMode === "off") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (promptTrigger.closest("[data-choice-modal]")) {
        promptTrigger.closest("[data-choice-modal]")?.classList.remove("open");
        promptTrigger.closest("[data-choice-modal]")?.setAttribute("aria-hidden", "true");
        promptTrigger.closest("[data-choice-modal]")?.setAttribute("inert", "");
      }
      launchAgentPrompt(promptTrigger.dataset.agentPrompt, promptTrigger);
    });

    window.CUAC = {
      ...(window.CUAC || {}),
      openAgentPrompt: launchAgentPrompt,
      collectAgentContext: collectAgentInvocationContext,
    };

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
      const label = action.dataset.agentLabel || action.textContent.trim();
      const actionRunId = `agent-action-${++actionSequence}`;
      let undoToken = null;
      const shellContext = getShellContext();
      const actionGuard = window.CuacActionRegistry?.canRunAction?.({
        uiAction: actionId,
        authState: shellContext.authState,
        surface: shellContext.surface,
        role: shellContext.role,
        route: currentRouteName(),
      });
      if (actionGuard && !actionGuard.allowed) {
        const blockedCopy =
          actionGuard.reason === "sign-in-required"
            ? "Sign in to save, apply, or keep this Agent result after the page closes."
            : `Action policy: ${actionGuard.reason}.`;
        if (actionLog) {
          const item = document.createElement("div");
          item.className = "cuac-agent-log-item blocked";
          item.dataset.agentRunId = actionRunId;
          item.innerHTML = `
            <span>Blocked</span>
            <strong>${escapeHTML(label)}</strong>
            <small>${escapeHTML(blockedCopy)}</small>
          `;
          actionLog.prepend(item);
        }
        if (actionGuard.reason === "sign-in-required") {
          showSignInRequired(label, {
            requiredRole: "student",
            actionKey: actionGuard?.action?.actionKey || "",
          });
        }
        return;
      }
      if (actionGuard?.action?.confirmationRequired && action.dataset.agentConfirmed !== "true") {
        const card = document.createElement("div");
        card.className = "cuac-agent-confirmation";
        card.dataset.agentConfirmation = actionRunId;
        card.innerHTML = `
          <span>${escapeHTML((actionGuard.action.riskLevel || "high").toUpperCase())} risk action</span>
          <strong>${escapeHTML(label)}</strong>
          <small>Confirm before CUAC changes school, application, payment, export, or internal audit state. Audit event: ${escapeHTML(actionGuard.action.auditEvent || actionGuard.action.actionKey)}.</small>
          <div>
            <button class="cuac-agent-action primary" type="button" data-agent-action="${escapeHTML(actionId)}" data-agent-confirmed="true" data-agent-label="${escapeHTML(label)}">Confirm action</button>
            <button class="cuac-agent-confirm-cancel" type="button" data-agent-confirm-cancel>Cancel</button>
          </div>
        `;
        results.prepend(card);
        window.setTimeout(() => card.classList.add("visible"), 20);
        return;
      }
      if (action.dataset.agentConfirmed === "true") {
        document.querySelectorAll(`[data-agent-confirmation]`).forEach((card) => card.remove());
      }
      const agentActionEvent = new CustomEvent("cuac:agent-action", {
        bubbles: true,
        cancelable: true,
        detail: {
          action: actionId,
          actionKey: actionGuard?.action?.actionKey || "",
          riskLevel: actionGuard?.action?.riskLevel || "unknown",
          confirmationRequired: Boolean(actionGuard?.action?.confirmationRequired),
          context: activeAgentContext,
          sourceContext: activeAgentContext?.entity || null,
          shellContext: activeAgentContext
            ? { authState: activeAgentContext.authState, role: activeAgentContext.role, surface: activeAgentContext.surface, route: activeAgentContext.route }
            : null,
          contextPolicy: activeAgentContext?.contextPolicy || null,
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
          <small>${agentActionEvent.defaultPrevented ? "Current page updated." : "Waiting for a page that can handle this action."}</small>
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
        <span>${agentActionEvent.defaultPrevented ? "Action applied to the current page." : "Action prepared for the current page."}</span>
        <button type="button" data-agent-toast-undo>Undo</button>
      `;
      results.prepend(toast);
      window.setTimeout(() => toast.classList.add("visible"), 20);
    });
    document.addEventListener("click", (event) => {
      const cancel = event.target.closest("[data-agent-confirm-cancel]");
      if (!cancel) return;
      cancel.closest("[data-agent-confirmation]")?.remove();
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

    if ("IntersectionObserver" in window && composerAvoidZones.length) {
      const avoidObserver = new IntersectionObserver(
        (entries) => {
          composerAvoidVisible = entries.some((entry) => entry.isIntersecting);
          updateComposerVisibility();
        },
        { rootMargin: "-44% 0px -22% 0px", threshold: 0.01 },
      );
      composerAvoidZones.forEach((zone) => avoidObserver.observe(zone));
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

  function initAccountMenus() {
    const menus = Array.from(document.querySelectorAll("[data-account-menu]"));
    if (!menus.length) return;

    function setMenu(menu, open) {
      const trigger = menu.querySelector("[data-account-menu-trigger]");
      const popover = menu.querySelector("[data-account-menu-popover]");
      if (!trigger || !popover) return;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      popover.hidden = !open;
      menu.classList.toggle("open", open);
    }

    menus.forEach((menu) => {
      const trigger = menu.querySelector("[data-account-menu-trigger]");
      trigger?.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = trigger.getAttribute("aria-expanded") !== "true";
        menus.forEach((item) => setMenu(item, false));
        setMenu(menu, open);
      });
      menu.querySelector(".account-signout")?.addEventListener("click", async (event) => {
        event.preventDefault();
        const link = event.currentTarget;
        link.setAttribute("aria-disabled", "true");
        try {
          const response = await fetch("/api/v1/auth/logout", {
            method: "POST",
            credentials: "same-origin",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: "{}",
          });
          if (!response.ok) throw new Error("Sign out failed.");
          runtimeAuthState = { resolved: true, authState: "signed-out", role: "visitor", surface: "public", tenantSchoolId: null };
          window.location.assign("auth.html");
        } catch {
          link.removeAttribute("aria-disabled");
          const label = link.querySelector("span");
          if (label) label.textContent = "Try sign out again";
        }
      });
    });

    document.addEventListener("click", (event) => {
      menus.forEach((menu) => {
        if (!menu.contains(event.target)) setMenu(menu, false);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      menus.forEach((menu) => setMenu(menu, false));
    });
  }

  document.querySelectorAll("[data-cuac-header]").forEach(renderHeader);
  document.querySelectorAll("[data-cuac-footer]").forEach(renderFooter);
  window.CUAC = { ...(window.CUAC || {}), requireSignedIn, requireStudentSignedIn, showSignInRequired, dataAttributeSelector, isSignedIn: () => getShellContext().authState === "signed-in", isStudentSignedIn, authReady: () => runtimeAuthReadyPromise };
  initProtectedStudentLinks();
  initAuthNavigationControls();
  initAccountMenus();
  const runtimeAuthReadyPromise = loadRuntimeAuthState();
  initAgentShell();
  window.CUAC = { ...(window.CUAC || {}), reveal: initPageReveal };
  initPageReveal();
})();
