const detailRoot = document.querySelector("[data-catalog-detail-root]");
const detailType = document.body.dataset.catalogDetailPage;
const query = new URLSearchParams(location.search);

const DETAIL_CONFIG = {
  program: {
    queryKey: "program",
    collection: "programs",
    backHref: "programs.html",
    backLabel: "Back to programs",
    typeLabel: "Program record",
    icon: "file.svg",
    code: "PR",
    uuid: true,
  },
  school: {
    queryKey: "university",
    collection: "schools",
    backHref: "universities.html",
    backLabel: "Back to universities",
    typeLabel: "University record",
    icon: "window.svg",
    code: "UN",
    uuid: true,
  },
  scholarship: {
    queryKey: "scholarship",
    collection: "scholarships",
    backHref: "scholarships.html",
    backLabel: "Back to scholarships",
    typeLabel: "Scholarship record",
    icon: "file.svg",
    code: "SC",
    uuid: true,
  },
  city: {
    queryKey: "city",
    collection: "cities",
    backHref: "cities.html",
    backLabel: "Back to cities",
    typeLabel: "City catalog context",
    icon: "globe.svg",
    code: "CI",
    uuid: false,
  },
};

const config = DETAIL_CONFIG[detailType];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isUuid(value) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(value || ""));
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value), location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function cleanText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function textItems(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean);
}

function structuredItems(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const scalar = cleanText(item);
    if (scalar) return { label: scalar, body: "", included: null };
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const label = cleanText(item.label || item.title || item.name || item.value);
    const body = cleanText(item.body || item.note || item.text || item.description);
    const included = typeof item.included === "boolean" ? item.included : null;
    if (!label && !body) return null;
    return { label: label || body, body: label ? body : "", included };
  }).filter(Boolean);
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value, fallback = "Not provided") {
  if (!value) return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return fallback;
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function formatMoney(record, fallback = "Not provided") {
  if (cleanText(record.displayTuition)) return cleanText(record.displayTuition);
  if (cleanText(record.tuitionText)) return cleanText(record.tuitionText);
  if (Number.isFinite(record.tuitionAmount)) {
    const currency = cleanText(record.tuitionCurrency) || "CNY";
    const period = cleanText(record.tuitionPeriod);
    const amount = new Intl.NumberFormat("en").format(record.tuitionAmount);
    return `${currency} ${amount}${period ? ` / ${period}` : ""}`;
  }
  return fallback;
}

function formatDuration(record, fallback = "Not provided") {
  const years = Number(record.durationYears);
  const months = Number(record.durationMonths);
  if (Number.isInteger(years) && years > 0) return `${years} ${years === 1 ? "year" : "years"}`;
  if (Number.isInteger(months) && months > 0) return `${months} ${months === 1 ? "month" : "months"}`;
  return fallback;
}

function displayValue(value, fallback = "Not provided") {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = cleanText(value);
  return text || fallback;
}

function hasDisplayValue(value) {
  return typeof value === "boolean" || (value !== undefined && value !== null && cleanText(value) !== "");
}

function statusLabel(value) {
  const labels = {
    verified: "Verified source",
    unverified: "Not yet verified",
    stale: "Verification is stale",
    disputed: "Source is disputed",
    invalid: "Source is invalid",
    draft: "Draft source record",
    unknown: "Verification unknown",
  };
  return labels[value] || labels.unknown;
}

function sourceClass(value) {
  return `source-${String(value || "unknown").replace(/[^a-z]/g, "") || "unknown"}`;
}

function renderChips(items) {
  const values = textItems(items);
  if (!values.length) return "";
  return `<ul class="catalog-chip-list">${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderDefinitions(rows, emptyMessage = "") {
  const visible = rows.filter((row) => row && cleanText(row[0]) && hasDisplayValue(row[1]));
  if (!visible.length) return emptyMessage ? renderEmpty(emptyMessage) : "";
  return `<dl class="catalog-definition-list">${visible.map(([label, value]) => `
    <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(displayValue(value))}</dd></div>
  `).join("")}</dl>`;
}

function renderEmpty(message) {
  return `<p class="catalog-empty-inline">${escapeHtml(message)}</p>`;
}

function renderSection(kicker, title, content, description = "") {
  if (!content) return "";
  return `<section class="catalog-section">
    <header class="catalog-section-head">
      <span class="catalog-section-kicker">${escapeHtml(kicker)}</span>
      <h2>${escapeHtml(title)}</h2>
      ${description ? `<p>${escapeHtml(description)}</p>` : ""}
    </header>
    ${content}
  </section>`;
}

function renderSource(record) {
  const status = record.sourceStatus || "unknown";
  const sourceHref = safeUrl(record.sourceUrl);
  return `<aside class="catalog-evidence-rail ${sourceClass(status)}" aria-label="Source status">
    <div class="catalog-evidence-heading">
      <span class="catalog-evidence-dot" aria-hidden="true"></span>
      <div><span class="catalog-evidence-label">Source status</span>
      <strong>${escapeHtml(statusLabel(status))}</strong></div>
    </div>
    <p>${record.lastVerifiedAt ? `Last verified ${escapeHtml(formatDate(record.lastVerifiedAt))}.` : "This published record has not yet completed source verification."}</p>
    ${sourceHref ? `<a class="catalog-source-link" href="${escapeHtml(sourceHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.sourceLabel || "Open source")}</a>` : `<p>${escapeHtml(record.sourceLabel || "No public source link provided")}</p>`}
  </aside>`;
}

function renderHero(record, options) {
  const localName = cleanText(options.localName);
  const intro = cleanText(options.intro);
  const context = (options.context || []).filter(Boolean);
  const title = cleanText(options.title) || "Published catalog record";
  return `<section class="catalog-record-hero">
    <div class="catalog-record-code" aria-hidden="true"><span>${escapeHtml(config.code)}</span><small>CUAC</small></div>
    <div class="catalog-record-title">
      <span class="catalog-record-type"><img src="${escapeHtml(config.icon)}" alt="" />${escapeHtml(config.typeLabel)}</span>
      <h1 class="${title.length > 46 ? "long-title" : ""}">${escapeHtml(title)}</h1>
      ${localName && localName !== title ? `<p class="catalog-record-local-name">${escapeHtml(localName)}</p>` : ""}
      ${intro ? `<p class="catalog-record-intro">${escapeHtml(intro)}</p>` : ""}
      ${context.length ? `<ul class="catalog-record-context">${context.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}
    </div>
    ${renderSource(record)}
  </section>`;
}

function renderStrip(items) {
  const values = items.filter((item) => item && cleanText(item[0]) && hasDisplayValue(item[1])).slice(0, 4);
  if (!values.length) return "";
  return `<section class="catalog-record-strip" style="--summary-count:${values.length}" aria-label="Record summary">${values.map(([label, value]) => `
    <article><span>${escapeHtml(label)}</span><strong>${escapeHtml(displayValue(value))}</strong></article>
  `).join("")}</section>`;
}

function renderActions(actions) {
  const visible = actions.map((action) => ({ ...action, href: safeUrl(action.href) })).filter((action) => action.href);
  if (!visible.length) return "";
  return `<div class="catalog-action-list">${visible.map((action, index) => `
    <a class="catalog-action ${index === 0 ? "primary" : ""}" href="${escapeHtml(action.href)}" ${action.external ? 'target="_blank" rel="noopener noreferrer"' : ""}>
      <span>${escapeHtml(action.label)}</span><span aria-hidden="true">&rarr;</span>
    </a>
  `).join("")}</div>`;
}

function renderAside(record, heading, actions, note) {
  const updateParts = [record.updatedAt ? formatDate(record.updatedAt) : "", Number.isSafeInteger(record.version) ? `Version ${record.version}` : ""].filter(Boolean);
  return `<aside class="catalog-aside">
    <section class="catalog-aside-panel">
      <h2>${escapeHtml(heading)}</h2>
      ${renderActions(actions)}
    </section>
    <section class="catalog-aside-panel catalog-disclaimer">
      <h3>Before you decide</h3>
      <p>${escapeHtml(note)}</p>
    </section>
    ${updateParts.length ? `<section class="catalog-aside-panel">
      <h3>Record update</h3>
      <p>${escapeHtml(updateParts.join(". "))}.</p>
    </section>` : ""}
  </aside>`;
}

function renderLayout(main, aside) {
  return `<div class="catalog-detail-layout"><div class="catalog-detail-flow">${main}</div>${aside}</div>`;
}

function relationLink(file, key, record, label) {
  if (!record || !record.id) return "";
  return `<a href="${escapeHtml(`${file}?${key}=${encodeURIComponent(record.id)}`)}">${escapeHtml(label || record.nameEn)}</a>`;
}

function renderIntakes(intakes) {
  if (!intakes.length) return renderEmpty("No currently open intake is published for this program.");
  return `<ol class="catalog-item-list">${intakes.map((intake) => `
    <li>
      <span class="catalog-item-label">${escapeHtml(`${titleCase(intake.intakeTerm)} ${intake.intakeYear}`)}</span>
      <div class="catalog-item-copy">
        <strong>${escapeHtml(formatDate(intake.deadlineDate, intake.deadlineLabel || "Deadline not provided"))}</strong>
        <div class="catalog-item-meta">
          <span>Opens: ${escapeHtml(formatDate(intake.openDate))}</span>
          ${intake.applicationRound ? `<span>Round: ${escapeHtml(intake.applicationRound)}</span>` : ""}
        </div>
      </div>
    </li>
  `).join("")}</ol>`;
}

function renderRequirements(requirements) {
  const document = requirements && requirements.document;
  const items = Array.isArray(document && document.requirements) ? document.requirements : [];
  if (!items.length) return renderEmpty("No current, approved requirement document is published for this intake. Check the official application page before relying on requirements.");
  return `<ol class="catalog-item-list">${items.map((item) => `
    <li>
      <span class="catalog-item-label">${escapeHtml(titleCase(item.category || "Requirement"))}</span>
      <div class="catalog-item-copy">
        <span class="catalog-requirement-level">${escapeHtml(titleCase(item.level))}</span>
        <strong>${escapeHtml(item.ruleText)}</strong>
        ${item.appliesTo ? `<p>Applies to: ${escapeHtml(item.appliesTo)}</p>` : ""}
        <div class="catalog-item-meta"><span>${escapeHtml(titleCase(item.stage))}</span><span>${escapeHtml(titleCase(item.evidenceType))}</span></div>
      </div>
    </li>
  `).join("")}</ol>`;
}

function renderProgram(record, extras) {
  const school = record.school || null;
  const city = record.city || null;
  const schoolLink = relationLink("university-detail.html", "university", school, school && school.nameEn);
  const cityLink = city ? `<a href="city-detail.html?city=${encodeURIComponent(city.slug)}">${escapeHtml(city.nameEn)}</a>` : "";
  const context = [schoolLink, cityLink, record.degreeLevel ? escapeHtml(titleCase(record.degreeLevel)) : ""];
  const intakes = extras.intakes || [];
  const firstIntake = intakes[0];
  const admissionFacts = renderDefinitions([
    ["English", record.englishRequirement],
    ["HSK", record.hskRequirement],
    ["CSCA", record.cscaRequirement],
    ["Application note", record.applicationNote],
  ]);
  const admissionContent = `${admissionFacts}${renderChips(record.cscaSubjects)}`;
  const main = [
    renderSection("Program profile", "Study route and cost", renderDefinitions([
      ["Degree", titleCase(record.degreeLevel)],
      ["Subject area", record.subjectArea || record.fieldCategory],
      ["Teaching language", titleCase(record.teachingLanguage)],
      ["Duration", formatDuration(record, "")],
      ["Tuition", formatMoney(record, "")],
      ["Scholarship note", record.scholarshipText],
      ["Catalog group", record.displayGroupLabel || record.displayGroup],
    ])),
    renderSection("Intakes", "Open application windows", renderIntakes(intakes), "Only open, non-expired intakes from the public catalog are shown."),
    firstIntake ? renderSection("Requirements", `${titleCase(firstIntake.intakeTerm)} ${firstIntake.intakeYear} requirements`, renderRequirements(extras.requirements), "Requirement documents are information-only and retain their review and evidence controls.") : "",
    renderSection("Admission route", "Language and assessment conditions", admissionContent, "These summary fields do not replace the intake-specific approved requirement document."),
  ].join("");
  const applicationHref = safeUrl(record.applicationUrl);
  const choiceHref = firstIntake ? `application.html?programId=${encodeURIComponent(record.id)}&intakeId=${encodeURIComponent(firstIntake.id)}#add-choice` : "application.html#add-choice";
  return `${renderHero(record, { title: record.nameEn, localName: record.nameZh, context })}
    ${renderStrip([
      ["Next intake", firstIntake ? `${titleCase(firstIntake.intakeTerm)} ${firstIntake.intakeYear}` : "None published"],
      ["Deadline", firstIntake ? formatDate(firstIntake.deadlineDate, firstIntake.deadlineLabel || "Not provided") : "Not provided"],
      ["Tuition", formatMoney(record)],
      ["Language", titleCase(record.teachingLanguage) || "Not provided"],
    ])}
    ${renderLayout(main, renderAside(record, "Continue with this program", [
      { label: "Add to application", href: choiceHref },
      { label: "Official application", href: applicationHref, external: true },
      { label: "View university", href: school ? `university-detail.html?university=${encodeURIComponent(school.id)}` : null },
    ], "Choose an exact intake before relying on deadlines or requirements. CUAC does not infer eligibility from profile data on this page."))}`;
}

function renderDeadlineItems(items) {
  if (!Array.isArray(items) || !items.length) return renderEmpty("No upcoming published intake deadlines are available for this university.");
  return `<ol class="catalog-item-list">${items.map((item) => `
    <li>
      <span class="catalog-item-label">${escapeHtml(`${titleCase(item.intakeTerm)} ${item.intakeYear}`)}</span>
      <div class="catalog-item-copy">
        <strong>${escapeHtml(item.programNameEn || "Published program")}</strong>
        <p>${escapeHtml(formatDate(item.deadlineDate, item.deadlineLabel || "Deadline not provided"))}</p>
        ${item.programId ? `<div class="catalog-item-meta"><a href="program-detail.html?program=${encodeURIComponent(item.programId)}">Open program record</a></div>` : ""}
      </div>
    </li>
  `).join("")}</ol>`;
}

function renderSchool(record) {
  const location = [record.cityZh || record.city, record.province, record.regionLabel || record.region].filter(Boolean).map(escapeHtml).join(", ");
  const cityLink = record.citySlug ? `<a href="city-detail.html?city=${encodeURIComponent(record.citySlug)}">${escapeHtml(record.cityZh || record.city || "City record")}</a>` : "";
  const campusLabels = [...(textItems(record.subjectTags)), ...(textItems(record.languageTags)), ...(textItems(record.campusHighlights))];
  const nextDeadline = Array.isArray(record.upcomingDeadlines) ? record.upcomingDeadlines[0] : null;
  const main = [
    renderSection("University profile", "Institution and study context", renderDefinitions([
      ["School type", titleCase(record.schoolType)],
      ["Application level", record.applicationLevel],
      ["Location", location],
      ["Ranking", record.ranking],
      ["Tuition summary", record.tuitionSummary],
      ["Tuition band", record.tuitionBandLabel],
      ["Application fee", record.applicationFee],
    ])),
    renderSection("Admissions", "Language and assessment context", `${renderDefinitions([
      ["Instruction language", record.languageOfInstruction],
      ["Language requirement", record.languageRequirement],
      ["English requirement", record.englishRequirement],
      ["HSK requirement", record.hskRequirement],
      ["CSCA required", record.cscaRequired],
      ["CSCA detail", record.cscaRequirement],
    ])}${renderChips(record.cscaSubjects)}`, "Confirm program-level requirements because a university summary may cover several routes."),
    renderSection("Catalog coverage", "Published routes in CUAC", renderDefinitions([
      ["Programs", record.programCount],
      ["English-taught programs", record.englishProgramCount],
      ["Scholarships", record.scholarshipCount],
      ["Deadline summary", record.deadlineSummary],
    ])),
    Array.isArray(record.upcomingDeadlines) && record.upcomingDeadlines.length
      ? renderSection("Upcoming", "Published intake deadlines", renderDeadlineItems(record.upcomingDeadlines))
      : "",
    campusLabels.length ? renderSection("Campus context", "Source-backed tags and highlights", renderChips(campusLabels)) : "",
  ].join("");
  return `${renderHero(record, { title: record.nameEn, localName: record.nameZh, context: [cityLink, escapeHtml(titleCase(record.schoolType)), escapeHtml(location)] })}
    ${renderStrip([
      ["Programs", record.programCount],
      ["English routes", record.englishProgramCount],
      ["Scholarships", record.scholarshipCount],
      ["Next deadline", nextDeadline ? formatDate(nextDeadline.deadlineDate, nextDeadline.deadlineLabel || "Not provided") : "Not provided"],
    ])}
    ${renderLayout(main, renderAside(record, "Explore this university", [
      { label: "Browse matching programs", href: `programs.html?university=${encodeURIComponent(record.slug)}` },
      { label: "Admissions website", href: record.admissionsUrl, external: true },
      { label: "University website", href: record.websiteUrl, external: true },
    ], "University-level summaries help narrow the catalog. Application decisions must use the exact program and intake record."))}`;
}

function normalizedBlocks(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === "string") return { title: `Detail ${index + 1}`, body: item, items: [] };
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const title = cleanText(item.title || item.heading || item.label) || `Detail ${index + 1}`;
    const body = cleanText(item.body || item.text || item.content || item.value);
    const paragraphs = textItems(item.paragraphs);
    const items = textItems(item.items || item.points || item.values);
    return body || paragraphs.length || items.length ? { title, body, paragraphs, items } : null;
  }).filter(Boolean);
}

function renderBlocks(blocks) {
  if (!blocks.length) return renderEmpty("No additional published description is available.");
  return `<div class="catalog-content-blocks">${blocks.map((block) => `
    <article class="catalog-content-block">
      <h3>${escapeHtml(block.title)}</h3>
      ${block.body ? `<p>${escapeHtml(block.body)}</p>` : ""}
      ${block.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      ${renderChips(block.items)}
    </article>
  `).join("")}</div>`;
}

function renderTextList(items, emptyMessage, ordered = false) {
  const values = structuredItems(items);
  if (!values.length) return renderEmpty(emptyMessage);
  const tag = ordered ? "ol" : "ul";
  return `<${tag} class="catalog-item-list">${values.map((item, index) => `
    <li class="${item.included === false ? "catalog-item-excluded" : ""}">
      <span class="catalog-item-label ${ordered ? "" : "catalog-item-bullet"}" aria-hidden="${ordered ? "false" : "true"}">${ordered ? String(index + 1).padStart(2, "0") : ""}</span>
      <div class="catalog-item-copy">
        ${item.included !== null ? `<span class="catalog-item-state">${item.included ? "Included" : "Not included"}</span>` : ""}
        <strong>${escapeHtml(item.label)}</strong>
        ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
      </div>
    </li>
  `).join("")}</${tag}>`;
}

function renderScholarship(record) {
  const schoolLink = relationLink("university-detail.html", "university", record.school, record.school && record.school.nameEn);
  const programLink = relationLink("program-detail.html", "program", record.program, record.program && record.program.nameEn);
  const provider = record.providerNameEn || record.providerName;
  const actions = Array.isArray(record.actionLinks) ? record.actionLinks.map((item) => ({
    label: cleanText(item && (item.label || item.title || item.name)) || "Official scholarship action",
    href: item && (item.url || item.href),
    external: true,
  })) : [];
  const benefitItems = Array.isArray(record.benefitItems) && record.benefitItems.length ? record.benefitItems : record.benefits;
  const detailBlocks = normalizedBlocks(record.bodySections);
  const eligibilityList = structuredItems(record.eligibilityItems);
  const eligibilityTags = [...textItems(record.targetCountries), ...textItems(record.targetRegions)];
  const eligibilityContent = `${renderDefinitions([
    ["Applicable degree", record.applicableDegree],
    ["Applicable program", record.applicableProgram],
    ["Requirement summary", record.requirementText],
  ])}${eligibilityList.length ? renderTextList(record.eligibilityItems, "") : ""}${renderChips(eligibilityTags)}`;
  const main = [
    renderSection("Award profile", "Funding and coverage", renderDefinitions([
      ["Funding level", titleCase(record.fundingLevel)],
      ["Type", record.typeLabel || titleCase(record.type)],
      ["Amount", record.amountText],
      ["Coverage", record.coverage],
      ["Provider", provider],
      ["Provider location", record.providerLocation],
    ])),
    renderSection("Eligibility", "Who the award applies to", eligibilityContent, "These fields describe the published award. They are not an eligibility decision."),
    structuredItems(benefitItems).length ? renderSection("Benefits", "What the award includes", renderTextList(benefitItems, "")) : "",
    structuredItems(record.applicationMaterials).length ? renderSection("Materials", "Application materials", renderTextList(record.applicationMaterials, "")) : "",
    structuredItems(record.applicationSteps).length ? renderSection("Process", "Published application steps", renderTextList(record.applicationSteps, "", true)) : "",
    detailBlocks.length ? renderSection("Details", "Additional published information", renderBlocks(detailBlocks)) : "",
    renderSection("Relations", "Linked catalog records", `${renderDefinitions([
      ["University", record.school && record.school.nameEn],
      ["Program", record.program && record.program.nameEn],
      ["Application round", record.applicationRound],
    ])}${renderChips(record.tags)}`),
  ].join("");
  return `${renderHero(record, { title: record.title, localName: record.nameZh, intro: record.summary, context: [provider ? escapeHtml(provider) : "", schoolLink, programLink] })}
    ${renderStrip([
      ["Funding", titleCase(record.fundingLevel)],
      ["Amount", record.amountText || "Not provided"],
      ["Deadline", formatDate(record.deadlineDate, record.deadlineLabel || "Not provided")],
      ["Provider", provider || "Not provided"],
    ])}
    ${renderLayout(main, renderAside(record, "Use this funding route", [
      ...actions,
      { label: "Find matching programs", href: record.program ? `program-detail.html?program=${encodeURIComponent(record.program.id)}` : "programs.html" },
      { label: "View related university", href: record.school ? `university-detail.html?university=${encodeURIComponent(record.school.id)}` : null },
    ], "CUAC shows the award as published. Funding is never treated as guaranteed, and contact data is not exposed through this public page."))}`;
}

function cityContentBlocks(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return [];
  const blocks = [];
  const overview = cleanText(content.overview);
  const summary = cleanText(content.summary);
  if (summary || overview) blocks.push({ title: "Overview", body: summary, paragraphs: overview && overview !== summary ? [overview] : [], items: [] });
  const budget = content.budgetSummary;
  if (budget && typeof budget === "object" && !Array.isArray(budget)) {
    const items = [["Monthly", budget.monthly], ["Yearly", budget.yearly], ["Note", budget.note]]
      .filter(([, value]) => cleanText(value)).map(([label, value]) => `${label}: ${cleanText(value)}`);
    if (items.length) blocks.push({ title: "Budget summary", body: "", paragraphs: [], items });
  }
  for (const [key, title] of [["quickFacts", "Quick facts"], ["costProfiles", "Cost profiles"], ["costBreakdown", "Cost breakdown"]]) {
    const items = Array.isArray(content[key]) ? content[key].map((item) => {
      if (!item || typeof item !== "object") return "";
      const note = cleanText(item.note);
      return `${cleanText(item.label)}: ${cleanText(item.value)}${note ? ` - ${note}` : ""}`;
    }).filter(Boolean) : [];
    if (items.length) blocks.push({ title, body: "", paragraphs: [], items });
  }
  for (const [key, title] of [["why", "Why consider this city"], ["lifeSections", "Student life"], ["transportNotes", "Transport"], ["applicationAdvice", "Application advice"], ["nextSteps", "Next steps"]]) {
    const items = Array.isArray(content[key]) ? content[key].map((item) => {
      if (!item || typeof item !== "object") return "";
      const label = cleanText(item.label);
      return `${label ? `${label}: ` : ""}${cleanText(item.text)}`;
    }).filter(Boolean) : [];
    if (items.length) blocks.push({ title, body: "", paragraphs: [], items });
  }
  for (const [key, title] of [["bestFor", "Best for"], ["applicationTips", "Application tips"], ["relatedProgramKeywords", "Related program directions"]]) {
    const items = textItems(content[key]);
    if (items.length) blocks.push({ title, body: "", paragraphs: [], items });
  }
  const faqItems = [...(Array.isArray(content.faqs) ? content.faqs : []), ...(Array.isArray(content.cityFaqs) ? content.cityFaqs : [])]
    .map((item) => item && typeof item === "object" ? `${cleanText(item.question)}: ${cleanText(item.answer)}` : "").filter(Boolean);
  if (faqItems.length) blocks.push({ title: "City questions", body: "", paragraphs: [], items: faqItems });
  return blocks;
}

function renderCity(record) {
  const references = record.references || {};
  const location = [record.province, record.region].filter(Boolean).join(", ");
  const contentBlocks = cityContentBlocks(record.content);
  const nearby = textItems(record.nearby);
  const tags = textItems(record.tags);
  const main = [
    renderSection("Living context", "Cost and city profile", renderDefinitions([
      ["Monthly cost", record.monthlyCost],
      ["Monthly cost reference", Number.isFinite(record.monthlyCostRmb) ? `CNY ${new Intl.NumberFormat("en").format(record.monthlyCostRmb)}` : null],
      ["Cost level", titleCase(record.costLevel)],
      ["City density", titleCase(record.density)],
    ]), "These values are catalog references, not a personal budget estimate."),
    contentBlocks.length ? renderSection("City record", "Source-backed city information", renderBlocks(contentBlocks), "Only keys present in the published city content object appear here.") : "",
    renderSection("Catalog coverage", "Published reference counts", renderDefinitions([
      ["Universities", references.schoolCount],
      ["Programs", references.programCount],
      ["English-taught programs", references.englishProgramCount],
      ["Scholarships", references.scholarshipCount],
      ["CSCA universities", references.cscaRequiredSchoolCount],
    ]), "Counts are imported reference snapshots. They are not labeled as live totals."),
    nearby.length ? renderSection("Nearby", "Published nearby references", renderTextList(nearby, "")) : "",
    tags.length ? renderSection("Tags", "Source-backed catalog labels", renderChips(tags)) : "",
  ].join("");
  return `${renderHero(record, { title: record.nameEn, localName: record.nameZh, context: [escapeHtml(location), escapeHtml(titleCase(record.costLevel)), escapeHtml(titleCase(record.density))] })}
    ${renderStrip([
      ["Universities", references.schoolCount],
      ["Programs", references.programCount],
      ["English routes", references.englishProgramCount],
      ["Scholarships", references.scholarshipCount],
    ])}
    ${renderLayout(main, renderAside(record, "Explore this city", [
      { label: "Browse universities", href: `universities.html?city=${encodeURIComponent(record.slug)}` },
      { label: "Browse programs", href: `programs.html?city=${encodeURIComponent(record.slug)}` },
      { label: "Browse scholarships", href: `scholarships.html?city=${encodeURIComponent(record.slug)}` },
    ], "Use a city as a catalog filter, then make decisions from exact university, program, intake, and funding records."))}`;
}

async function requestData(path) {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body && body.error && body.error.message;
    throw new Error(message || `Catalog request failed with status ${response.status}.`);
  }
  return body.data;
}

function identityCandidates(item) {
  return [item.id, item.slug, item.name, item.nameEn, item.nameZh, item.title]
    .map((value) => cleanText(value))
    .filter(Boolean);
}

async function resolveIdentifier(rawIdentifier) {
  if (!rawIdentifier) throw new Error("This detail link does not include a catalog identifier.");
  if (config.uuid && isUuid(rawIdentifier)) return rawIdentifier.toLowerCase();
  if (!config.uuid && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawIdentifier)) return rawIdentifier;

  const items = await requestData(`/api/v1/catalog/${config.collection}?limit=100`);
  const wanted = slugify(rawIdentifier);
  const match = (Array.isArray(items) ? items : []).find((item) => identityCandidates(item).some((candidate) => candidate === rawIdentifier || slugify(candidate) === wanted));
  if (!match) throw new Error("This link points to a demo or unpublished record. Open the catalog and choose a published result.");
  return config.uuid ? match.id : match.slug;
}

async function loadProgramExtras(record) {
  const intakes = await requestData(`/api/v1/catalog/programs/${encodeURIComponent(record.id)}/intakes?limit=20`);
  const first = Array.isArray(intakes) ? intakes[0] : null;
  let requirements = null;
  if (first) {
    requirements = await requestData(`/api/v1/catalog/programs/${encodeURIComponent(record.id)}/intakes/${encodeURIComponent(first.id)}/requirements`);
  }
  return { intakes: Array.isArray(intakes) ? intakes : [], requirements };
}

function renderLoading() {
  detailRoot.innerHTML = `<section class="catalog-state" aria-busy="true">
    <span class="catalog-state-mark"><img src="${escapeHtml(config.icon)}" alt="" /></span>
    <h1>Loading published record</h1>
    <p>Reading the current public catalog and source status.</p>
    <div class="catalog-loading-line" aria-hidden="true"></div>
  </section>`;
}

function renderError(error) {
  detailRoot.innerHTML = `<section class="catalog-state" role="alert">
    <span class="catalog-state-mark"><img src="${escapeHtml(config.icon)}" alt="" /></span>
    <h1>Record unavailable</h1>
    <p>${escapeHtml(error instanceof Error ? error.message : "The published catalog record could not be loaded.")}</p>
    <div class="catalog-state-actions">
      <button type="button" data-catalog-retry>Try again</button>
      <a class="catalog-action" href="${escapeHtml(config.backHref)}">${escapeHtml(config.backLabel)}</a>
    </div>
  </section>`;
  detailRoot.querySelector("[data-catalog-retry]")?.addEventListener("click", loadDetail);
}

async function loadDetail() {
  renderLoading();
  try {
    const identifier = await resolveIdentifier(query.get(config.queryKey));
    const record = await requestData(`/api/v1/catalog/${config.collection}/${encodeURIComponent(identifier)}`);
    if (!record) throw new Error("This record is not currently published.");
    let html = "";
    if (detailType === "program") html = renderProgram(record, await loadProgramExtras(record));
    if (detailType === "school") html = renderSchool(record);
    if (detailType === "scholarship") html = renderScholarship(record);
    if (detailType === "city") html = renderCity(record);
    const name = record.nameEn || record.title || record.slug;
    document.title = `${name} | CUAC`;
    detailRoot.innerHTML = `<a class="catalog-back-link" href="${escapeHtml(config.backHref)}"><span aria-hidden="true">&larr;</span>${escapeHtml(config.backLabel)}</a>${html}`;
  } catch (error) {
    renderError(error);
  }
}

if (detailRoot && config) loadDetail();
