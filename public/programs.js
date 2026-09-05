const iconHeart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.6c0 5.7-8.5 10.4-8.5 10.4S3.5 14.3 3.5 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.5 2.6Z"/></svg>';
const iconCompare = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"/><path d="M5 7h14"/><path d="m6 7-3 7"/><path d="m8 7 3 7"/><path d="m16 7-3 7"/><path d="m18 7 3 7"/><path d="M3 14h8"/><path d="M13 14h8"/><path d="M7 21h10"/></svg>';
const iconArrowRight = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';

      let programs = [];
      const escapeCatalogHtml = window.CuacCatalogList.escapeHtml;

      const state = {
        page: 1,
        pageSize: 8,
        view: "list",
        saved: new Set(),
        compared: new Set(),
        filters: {
          q: "",
          degree: "",
          subject: "",
          language: "",
          city: "",
          intake: "",
          deadline: "",
          tuition: "",
          scholarship: false,
          upcomingDeadline: false,
          langReq: "",
          documents: "",
        },
      };

      const routeParams = new URLSearchParams(window.location.search);
      const focusedProgram = routeParams.get("program");
      const focusedUniversity = routeParams.get("university");
      const scholarshipRoute = routeParams.get("route") || routeParams.get("type") || "";
      const scholarshipFunding = routeParams.get("funding") || "";
      const scholarshipParam = String(routeParams.get("scholarship") || "").trim().toLowerCase();
      let initialProgram = null;
      const initialQuery = routeParams.get("keyword") || routeParams.get("q") || focusedUniversity || (initialProgram ? programName(initialProgram) : "") || scholarshipRouteQuery(scholarshipRoute, scholarshipFunding) || scholarshipParamQuery(scholarshipParam);
      if (initialQuery) state.filters.q = initialQuery;
      ["degree", "subject", "language", "city", "intake", "deadline", "tuition", "langReq", "documents"].forEach((key) => {
        const value = routeParams.get(key);
        if (value) state.filters[key] = key === "city" ? normalizeCityParam(value) : key === "degree" ? normalizeDegreeParam(value) : key === "language" ? normalizeLanguageParam(value) : value;
      });
      const degreeLevelParam = routeParams.get("degreeLevel") || routeParams.get("applicationLevel");
      const teachingLanguageParam = routeParams.get("teachingLanguage");
      const subjectParam = routeParams.get("programSubject") || routeParams.get("fieldCategory") || routeParams.get("subject");
      if (degreeLevelParam) state.filters.degree = normalizeDegreeParam(degreeLevelParam);
      if (teachingLanguageParam) state.filters.language = normalizeLanguageParam(teachingLanguageParam);
      if (subjectParam) state.filters.subject = subjectParam;
      if (truthyParam(routeParams.get("hasScholarship")) || (scholarshipParam && !["false", "0", "no"].includes(scholarshipParam))) state.filters.scholarship = true;
      if (truthyParam(routeParams.get("hasUpcomingDeadline"))) state.filters.upcomingDeadline = true;

      const filterGroups = [
        {
          label: "Study goal",
          fields: [
            ["degree", "Degree level", [["", "All levels"], ["undergraduate", "Undergraduate"], ["master", "Master"], ["phd", "PhD"], ["non-degree", "Non-degree / Language"]]],
            ["subject", "Subject", [["", "Any subject"], ["Computer Science", "Computer Science"], ["Engineering", "Engineering"], ["Business", "Business"], ["Economics", "Economics"], ["Medicine", "Medicine"], ["Chinese Language", "Chinese Language"], ["International Relations", "International Relations"]]],
            ["language", "Teaching language", [["", "Any language"], ["english", "English-taught"], ["chinese", "Chinese-taught"], ["bilingual", "Bilingual"]]],
          ],
        },
        {
          label: "Cost",
          fields: [
            ["tuition", "Tuition", [["", "Any published tuition"], ["under-25", "Under RMB 25k"], ["25-40", "RMB 25k-40k"], ["40-60", "RMB 40k-60k"], ["60-plus", "RMB 60k+"]]],
          ],
        },
        {
          label: "Application timing",
          fields: [
            ["deadline", "Deadline", [["", "Any open status"], ["open", "Open"], ["closes-soon", "Closes soon"], ["urgent", "Urgent"], ["late", "Late intake"]]],
          ],
        },
      ];

      const searchInput = document.querySelector("#searchInput");
      const programList = document.querySelector("#programList");
      const resultCount = document.querySelector("#resultCount");
      const resultContext = document.querySelector("#resultContext");
      const activeChips = document.querySelector("#activeChips");
      const programFocus = document.querySelector("#programFocus");
      const pagination = document.querySelector("#pagination");
      const emptyState = document.querySelector("#emptyState");
      const shortlistCard = document.querySelector("#shortlistCard");
      const sortSelect = document.querySelector("#sortSelect");
      const drawer = document.querySelector("#filterDrawer");
      const drawerBackdrop = document.querySelector("#drawerBackdrop");

      function formatMoney(value) {
        if (!Number(value)) return "Tuition pending";
        return `RMB ${value.toLocaleString("en-US")}`;
      }

      function formatShortDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "date pending";
        return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
      }

      function labelDegree(value) {
        return {
          undergraduate: "Undergraduate",
          master: "Master",
          phd: "PhD",
          "non-degree": "Non-degree",
        }[value] || value;
      }

      function labelLanguage(value) {
        return {
          english: "English-taught",
          chinese: "Chinese-taught",
          bilingual: "Bilingual",
        }[value] || value;
      }

      function labelDocuments(value) {
        return `${value[0].toUpperCase()}${value.slice(1)} documents`;
      }

      function programId(program = {}) {
        return program.id || program.slug || program.programId || "";
      }

      function programName(program = {}) {
        return program.nameEn || program.name || "Program to confirm";
      }

      function programUniversity(program = {}) {
        return program.schoolNameEn || program.university || program.school || "University to confirm";
      }

      function programCity(program = {}) {
        return program.city || program.cityZh || "China";
      }

      function programProvince(program = {}) {
        return program.province || program.region || "China";
      }

      function programDegreeValue(program = {}) {
        const value = String(program.degree || program.degreeLevel || "").trim().toLowerCase();
        if (value.includes("under") || value.includes("bachelor")) return "undergraduate";
        if (value.includes("master")) return "master";
        if (value.includes("phd") || value.includes("doctor")) return "phd";
        if (value.includes("non") || value.includes("language")) return "non-degree";
        return value;
      }

      function programSubject(program = {}) {
        return program.subject || program.fieldCategory || "General";
      }

      function compactList(value, fallback = "Confirm") {
        const items = Array.isArray(value) ? value : String(value || "").split(/[,;/\n]+/);
        const cleaned = items.map((item) => String(item || "").trim()).filter(Boolean);
        return cleaned.length ? cleaned.slice(0, 3).join(" / ") : fallback;
      }

      function programLanguageValue(program = {}) {
        const value = String(program.language || program.teachingLanguage || "").trim().toLowerCase();
        if (value.includes("english")) return "english";
        if (value.includes("chinese")) return "chinese";
        if (value.includes("bilingual")) return "bilingual";
        return value;
      }

      function programLanguageLabel(program = {}) {
        return program.teachingLanguage || labelLanguage(programLanguageValue(program));
      }

      function programIntake(program = {}) {
        return program.applicationRound || program.intake || "Intake pending";
      }

      function programTerm(program = {}) {
        const value = String(program.term || programIntake(program)).toLowerCase();
        if (value.includes("spring")) return "spring";
        if (value.includes("late")) return "late";
        if (value.includes("fall")) return "fall";
        return value;
      }

      function programDeadline(program = {}) {
        return program.deadlineDate || program.deadline || "";
      }

      function programDeadlineStatus(program = {}) {
        if (program.deadlineStatus) return program.deadlineStatus;
        if (programTerm(program) === "late") return "late";
        const date = new Date(programDeadline(program));
        if (Number.isNaN(date.getTime())) return "open";
        const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
        if (days < 0) return "closed";
        if (days <= 45) return "urgent";
        if (days <= 70) return "closes-soon";
        return "open";
      }

      function programTuitionAmount(program = {}) {
        const value = Number(program.tuitionAmount ?? program.tuition);
        return Number.isFinite(value) ? value : 0;
      }

      function programScholarship(program = {}) {
        return Boolean(program.hasScholarship ?? program.scholarship ?? (program.schoolScholarships || []).length);
      }

      function programScholarshipLabel(program = {}) {
        if (program.scholarshipType) return program.scholarshipType;
        if (program.scholarshipText) return program.scholarshipText;
        const first = (program.schoolScholarships || [])[0];
        return first?.name || "No listed award";
      }

      function programLanguageRequirement(program = {}) {
        return program.langReq || program.englishRequirement || program.languageRequirement || "Not published";
      }

      function programHskRequirement(program = {}) {
        return program.hsk || program.hskRequirement || "Not published";
      }

      function programCscaSummary(program = {}) {
        return compactList(program.displaySubjects || program.cscaSubjects || program.cscaRequirement, "Check CSCA subjects");
      }

      function programLanguageProofSummary(program = {}) {
        const language = programLanguageValue(program);
        const english = programLanguageRequirement(program);
        const hsk = programHskRequirement(program);
        if (language === "chinese") return hsk || "Check HSK requirement";
        if (language === "english" && /no hsk/i.test(hsk)) return english || "English proof";
        return [english, hsk].filter(Boolean).slice(0, 2).join(" / ") || "Check language proof";
      }

      function programApplicationNoteSummary(program = {}) {
        const note = program.applicationNote || program.fit || "";
        if (!note) return "School confirms document steps";
        return String(note).replace(/\s+/g, " ").trim();
      }

      function renderRequirementCards(program = {}) {
        const items = [
          ["CSCA", programCscaSummary(program)],
          ["Language proof", programLanguageProofSummary(program)],
          ["Application note", programApplicationNoteSummary(program)],
        ];
        return `
          <div class="program-requirements" aria-label="Program requirements">
            ${items.map(([label, value]) => `
              <div class="program-requirement">
                <span>${label}</span>
                <strong>${value}</strong>
              </div>
            `).join("")}
          </div>
        `;
      }

      function programDocumentEffort(program = {}) {
        return program.documents || program.documentEffort || "medium";
      }

      function programDocumentCount(program = {}) {
        return Number(program.documentCount || program.documentsCount || 0) || (programDocumentEffort(program) === "light" ? 3 : programDocumentEffort(program) === "heavy" ? 7 : 5);
      }

      function programSourceStatus(program = {}) {
        if (program.sourceStatus) return program.sourceStatus;
        if (program.source) return program.source;
        if (program.isVerified || program.verificationStatus === "verified") return "verified";
        if (program.lastVerifiedAt) return "stale";
        return "pending";
      }

      function programVerifiedAt(program = {}) {
        return program.verified || program.lastVerifiedAt || "Pending";
      }

      function programFit(program = {}) {
        return program.applicationNote || program.sourceLabel || "No application note published.";
      }

      function programReadiness(program = {}) {
        const readiness = program.readiness;
        const normalizedReadiness = String(readiness || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (readiness && !["source-pending", "confirm-details", "official-details"].includes(normalizedReadiness)) return readiness;
        return programSourceStatus(program) === "verified" ? "Ready to compare" : "Review before applying";
      }

      function programReadinessType(program = {}) {
        return program.readinessType || (programSourceStatus(program) === "verified" ? "good" : "warn");
      }

      function programApplicationReadinessScore(program = {}) {
        const deadline = programDeadlineStatus(program);
        const source = programSourceStatus(program);
        return (
          (source === "verified" ? 30 : source === "stale" ? 16 : 8) +
          (programScholarship(program) ? 12 : 0) +
          (programDocumentEffort(program) === "light" ? 10 : programDocumentEffort(program) === "medium" ? 6 : 2) +
          (deadline === "urgent" ? 4 : deadline === "closes-soon" ? 8 : deadline === "late" ? 10 : 12)
        );
      }

      function deadlineBadge(program) {
        const deadline = programDeadline(program);
        const dateLabel = deadline ? formatShortDate(deadline) : "date pending";
        const status = programDeadlineStatus(program);
        if (status === "urgent") return ["danger", `Urgent: ${dateLabel}`];
        if (status === "closes-soon") return ["warning", `Closes ${dateLabel}`];
        if (status === "late") return ["success", `Late intake until ${dateLabel}`];
        if (status === "closed") return ["danger", `Closed ${dateLabel}`];
        return ["", `Open until ${dateLabel}`];
      }

      function programDecisionNote(program) {
        const source = programSourceStatus(program);
        if (source === "verified") return "Ready to compare with saved choices";
        if (source === "stale") return "Review deadline and requirements before adding";
        return "Check program fit before adding";
      }

      function slugifyRouteParam(value) {
        return String(value || "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }

      function normalizeCityParam(value) {
        if (!value) return "";
        const routeSlug = slugifyRouteParam(value);
        const knownCity = [...new Set(programs.map((program) => programCity(program)).filter(Boolean))]
          .find((city) => slugifyRouteParam(city) === routeSlug || city.toLowerCase() === String(value).trim().toLowerCase());
        return knownCity || value;
      }

      function normalizeDegreeParam(value) {
        const routeSlug = slugifyRouteParam(value);
        return {
          undergraduate: "undergraduate",
          bachelor: "undergraduate",
          master: "master",
          phd: "phd",
          doctoral: "phd",
          "non-degree": "non-degree",
          nondegree: "non-degree",
          language: "non-degree",
        }[routeSlug] || value;
      }

      function normalizeLanguageParam(value) {
        const routeSlug = slugifyRouteParam(value);
        return {
          english: "english",
          "english-taught": "english",
          chinese: "chinese",
          "chinese-taught": "chinese",
          bilingual: "bilingual",
        }[routeSlug] || value;
      }

      function truthyParam(value) {
        const normalized = String(value || "").trim().toLowerCase();
        return ["1", "true", "yes", "y", "available"].includes(normalized);
      }

      function scholarshipRouteQuery(route, funding) {
        const routeSlug = slugifyRouteParam(route);
        const fundingSlug = slugifyRouteParam(funding);
        const routeTerms = {
          government: "CSC scholarship",
          university: "university award scholarship",
          province: "city scholarship",
          partner: "scholarship",
        }[routeSlug] || "";
        const fundingTerms = {
          full: "",
          partial: "",
        }[fundingSlug] || "";
        return [routeTerms, fundingTerms].filter(Boolean).join(" ");
      }

      function scholarshipParamQuery(value) {
        const scholarshipSlug = slugifyRouteParam(value);
        if (!scholarshipSlug || ["true", "1", "yes", "available"].includes(scholarshipSlug)) return "";
        return {
          csc: "CSC scholarship",
          government: "CSC scholarship",
          university: "university award scholarship",
          province: "city scholarship",
          city: "city scholarship",
        }[scholarshipSlug] || `${value} scholarship`;
      }

      function programImage() {
        return "window.svg";
      }

      function tuitionMatch(program, value) {
        if (!value) return true;
        const tuition = programTuitionAmount(program);
        if (!tuition) return false;
        if (value === "under-25") return tuition < 25000;
        if (value === "25-40") return tuition >= 25000 && tuition <= 40000;
        if (value === "40-60") return tuition > 40000 && tuition <= 60000;
        return tuition > 60000;
      }

      function langReqMatch(program, value) {
        if (!value) return true;
        const combined = `${programLanguageRequirement(program)} ${programHskRequirement(program)}`.toLowerCase();
        if (value === "no-hsk") return combined.includes("no hsk");
        if (value === "hsk") return combined.includes("hsk required");
        if (value === "ielts") return combined.includes("ielts") || combined.includes("toefl");
        if (value === "flexible") return combined.includes("flexible");
        return true;
      }

      function normalizeSearchText(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/english[\s-]*taught/g, "english")
          .replace(/chinese[\s-]*taught/g, "chinese")
          .replace(/\bmsc\b/g, "master")
          .replace(/\bma\b/g, "master")
          .replace(/\bba\b/g, "undergraduate")
          .replace(/\bbsc\b/g, "undergraduate")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      }

      function queryMatchesProgram(query, program) {
        const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
        if (!tokens.length) return true;
        const haystack = normalizeSearchText([
          programName(program),
          programUniversity(program),
          programCity(program),
          programProvince(program),
          labelDegree(programDegreeValue(program)),
          program.degreeLevel,
          programSubject(program),
          programLanguageLabel(program),
          program.teachingLanguage,
          programCscaSummary(program),
          programIntake(program),
          programTerm(program),
          programScholarshipLabel(program),
          programLanguageRequirement(program),
          programHskRequirement(program),
          programFit(program),
        ].join(" "));
        return tokens.every((token) => haystack.includes(token));
      }

      function matches(program) {
        const f = state.filters;
        return (
          queryMatchesProgram(f.q, program) &&
          (!f.degree || programDegreeValue(program) === f.degree) &&
          (!f.subject || programSubject(program) === f.subject) &&
          (!f.language || programLanguageValue(program) === f.language) &&
          (!f.city || programCity(program) === f.city) &&
          (!f.intake || (f.intake === "late" ? programDeadlineStatus(program) === "late" : programTerm(program) === f.intake)) &&
          (!f.deadline || programDeadlineStatus(program) === f.deadline) &&
          (!f.upcomingDeadline || Boolean(programDeadline(program))) &&
          tuitionMatch(program, f.tuition) &&
          (!f.scholarship || programScholarship(program)) &&
          langReqMatch(program, f.langReq) &&
          (!f.documents || programDocumentEffort(program) === f.documents)
        );
      }

      function sortedPrograms(items) {
        const mode = sortSelect.value;
        const sortDateValue = (program) => {
          const date = new Date(programDeadline(program));
          return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
        };
        return [...items].sort((a, b) => {
          if (mode === "deadline") return sortDateValue(a) - sortDateValue(b);
          if (mode === "tuition") return programTuitionAmount(a) - programTuitionAmount(b);
          if (mode === "scholarship") return Number(programScholarship(b)) - Number(programScholarship(a));
          if (mode === "readiness") return programApplicationReadinessScore(b) - programApplicationReadinessScore(a);
          if (mode === "documents") return programDocumentCount(a) - programDocumentCount(b);
          return programApplicationReadinessScore(b) - programApplicationReadinessScore(a);
        });
      }

      function currentResults() {
        return sortedPrograms(programs.filter(matches));
      }

      function renderFilters(target, options = {}) {
        const showHeader = options.showHeader ?? true;
        target.innerHTML = `
          ${showHeader ? `
            <div class="filter-head">
              <h2>Filters</h2>
              <button class="ghost" type="button" data-reset>Reset</button>
            </div>
          ` : ""}
          ${filterGroups.map((group) => `
            <div class="filter-group">
              <span>${group.label}</span>
              ${group.fields.map(([key, label, options]) => `
                <label>
                  <span>${label}</span>
                  <select class="filter-select" data-filter-key="${key}">
                    ${options.map(([value, optionLabel]) => `<option value="${value}">${optionLabel}</option>`).join("")}
                  </select>
                </label>
              `).join("")}
            </div>
          `).join("")}
          <div class="filter-group">
            <span>Opportunity</span>
            <div class="check-list">
              <label><input type="checkbox" data-filter-key="scholarship" /> Scholarship available</label>
            </div>
          </div>
        `;
      }

      function syncFilterControls() {
        document.querySelectorAll("[data-filter-key]").forEach((control) => {
          const key = control.dataset.filterKey;
          if (control.type === "checkbox") {
            control.checked = Boolean(state.filters[key]);
          } else {
            control.value = state.filters[key] || "";
          }
        });
        searchInput.value = state.filters.q;
      }

      function setFilter(key, value) {
        state.filters[key] = value;
        state.page = 1;
        render();
      }

      function resetFilters() {
        state.filters = {
          q: "",
          degree: "",
          subject: "",
          language: "",
          city: "",
          intake: "",
          deadline: "",
          tuition: "",
          scholarship: false,
          upcomingDeadline: false,
          langReq: "",
          documents: "",
        };
        state.page = 1;
        render();
      }

      function activeFilterEntries() {
        const f = state.filters;
        const entries = [];
        if (f.q) entries.push(["q", `Search: ${f.q}`]);
        if (f.degree) entries.push(["degree", labelDegree(f.degree)]);
        if (f.subject) entries.push(["subject", f.subject]);
        if (f.language) entries.push(["language", labelLanguage(f.language)]);
        if (f.city) entries.push(["city", f.city]);
        if (f.intake) entries.push(["intake", f.intake === "late" ? "Late intake" : `${f.intake[0].toUpperCase()}${f.intake.slice(1)} intake`]);
        if (f.deadline) entries.push(["deadline", f.deadline.replace("-", " ")]);
        if (f.tuition) entries.push(["tuition", document.querySelector(`[data-filter-key="tuition"] option[value="${f.tuition}"]`)?.textContent || f.tuition]);
        if (f.scholarship) entries.push(["scholarship", "Scholarship"]);
        if (f.upcomingDeadline) entries.push(["upcomingDeadline", "Upcoming deadline"]);
        if (f.langReq) entries.push(["langReq", document.querySelector(`[data-filter-key="langReq"] option[value="${f.langReq}"]`)?.textContent || f.langReq]);
        if (f.documents) entries.push(["documents", labelDocuments(f.documents)]);
        return entries;
      }

      function renderActiveChips() {
        activeChips.innerHTML = activeFilterEntries().map(([key, label]) => `
          <span class="active-chip">${escapeCatalogHtml(label)}<button type="button" aria-label="Remove ${escapeCatalogHtml(label)}" data-remove-filter="${key}">x</button></span>
        `).join("");
      }

      function renderRow(program, index = 0) {
        const [badgeClassName, badgeLabel] = deadlineBadge(program);
        const id = programId(program);
        const name = programName(program);
        const university = programUniversity(program);
        const isSaved = state.saved.has(id);
        const isCompared = state.compared.has(id);
        const programHref = `program-detail.html?program=${encodeURIComponent(id)}`;
        const universityHref = `university-detail.html?university=${encodeURIComponent(program.schoolId)}`;
        const scholarship = programScholarship(program);
        return `
          <article class="program-row result-enter" style="--enter-index: ${index}" role="link" tabindex="0" data-program-id="${escapeCatalogHtml(id)}" data-program-card data-detail-href="${programHref}" aria-label="View ${escapeCatalogHtml(name)} program route">
            <div class="program-art">
              <a href="${programHref}" aria-label="Open ${escapeCatalogHtml(name)}">
                <img alt="University catalog marker" src="${programImage(program)}" />
              </a>
              <div class="row-top">
                <span class="badge ${badgeClassName}">${escapeCatalogHtml(badgeLabel)}</span>
                <button class="save-button ${isSaved ? "saved" : ""}" type="button" data-save="${escapeCatalogHtml(id)}" aria-label="${isSaved ? "Saved" : "Save"} ${escapeCatalogHtml(name)}">${iconHeart}</button>
              </div>
              <span class="program-card-open" aria-hidden="true">${iconArrowRight}</span>
            </div>
            <div class="program-main">
              <h2><a href="${programHref}">${escapeCatalogHtml(name)}</a></h2>
              <div class="meta"><a href="${universityHref}">${escapeCatalogHtml(university)}</a> · ${escapeCatalogHtml(labelDegree(programDegreeValue(program)))} · ${escapeCatalogHtml(programLanguageLabel(program) || "Language not published")}</div>
              <div class="facts">
                <div class="fact"><strong>${escapeCatalogHtml(programIntake(program))}</strong><span>application round</span></div>
                <div class="fact"><strong>${escapeCatalogHtml(formatMoney(programTuitionAmount(program)))}</strong><span>tuition</span></div>
              </div>
              <div class="signals">
                <span class="signal ${scholarship ? "good" : ""}">${scholarship ? "Scholarship signal" : "No award listed"}</span>
                <span class="signal ${programSourceStatus(program) === "verified" ? "good" : "warn"}">${escapeCatalogHtml(programSourceStatus(program))}</span>
                <span class="signal ${programReadinessType(program)}">${escapeCatalogHtml(programReadiness(program))}</span>
              </div>
              <p class="fit-line">${escapeCatalogHtml(programFit(program))}</p>
            </div>
            <div class="row-actions">
              <button class="program-card-action program-action-secondary compare-action ${isCompared ? "is-compared" : ""}" type="button" data-compare="${escapeCatalogHtml(id)}" aria-pressed="${isCompared ? "true" : "false"}" aria-label="${isCompared ? "Remove from compare" : "Add to compare"}: ${escapeCatalogHtml(name)}" title="${isCompared ? "Compared" : "Compare"}">${iconCompare}</button>
            </div>
          </article>
        `;
      }

      function renderPagination(total) {
        const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
        state.page = Math.min(Math.max(1, state.page), totalPages);
        if (total <= state.pageSize) {
          pagination.innerHTML = "";
          return;
        }

        const start = (state.page - 1) * state.pageSize + 1;
        const end = Math.min(total, state.page * state.pageSize);
        const pageButtons = Array.from({ length: totalPages }, (_, index) => {
          const page = index + 1;
          return `<button class="${page === state.page ? "active" : ""}" type="button" data-page="${page}" aria-label="Page ${page}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`;
        }).join("");

        pagination.innerHTML = `
          <span class="pagination-summary">Showing ${start}-${end} of ${total}</span>
          <button type="button" data-page="${state.page - 1}" aria-label="Previous page" ${state.page === 1 ? "disabled" : ""}>‹</button>
          ${pageButtons}
          <button type="button" data-page="${state.page + 1}" aria-label="Next page" ${state.page === totalPages ? "disabled" : ""}>›</button>
        `;
      }

      function renderResults() {
        const results = currentResults();
        const totalPages = Math.max(1, Math.ceil(results.length / state.pageSize));
        if (state.page > totalPages) state.page = totalPages;
        const start = (state.page - 1) * state.pageSize;
        const visible = results.slice(start, start + state.pageSize);
        resultCount.textContent = `${results.length} program${results.length === 1 ? "" : "s"}`;
        resultContext.textContent = activeFilterEntries().length
          ? "Filtered by China-study fit, requirements, and application details."
          : "Published programs with deadline, tuition, language, and source status.";
        programList.className = `program-list ${state.view === "compact" ? "compact" : ""}`;
        programList.innerHTML = visible.map(renderRow).join("");
        window.CUAC?.reveal?.(programList);
        emptyState.classList.toggle("visible", results.length === 0);
        renderPagination(results.length);
      }

      function renderShortlist() {
        const saved = programs.filter((program) => state.saved.has(programId(program)));
        const compared = programs.filter((program) => state.compared.has(programId(program)));
        shortlistCard.innerHTML = `
          <div class="shortlist-head">
            <h2>Shortlist</h2>
            <button class="ghost" type="button" data-clear-compare>Clear compare</button>
          </div>
          <p class="rail-note">Save programs first, then compare deadline, tuition, documents, and application readiness.</p>
          <div class="rail-stats">
            <div class="rail-stat"><strong>${saved.length}</strong><span>saved</span></div>
            <div class="rail-stat"><strong>${compared.length}</strong><span>compared</span></div>
          </div>
          <div class="compare-items">
            ${compared.length ? compared.map((program) => `
              <div class="compare-item">
                <strong>${programName(program)}</strong>
                <span>${programUniversity(program)}</span>
                <span>${formatMoney(programTuitionAmount(program))} · ${programDocumentCount(program)} docs · ${formatShortDate(programDeadline(program))}</span>
              </div>
            `).join("") : `<div class="compare-item"><strong>No compared programs yet</strong><span>Add up to 3 programs for a cleaner decision.</span></div>`}
          </div>
          <button class="primary" type="button" ${compared.length < 2 ? "disabled" : ""}>Open comparison</button>
        `;
      }

      function renderProgramFocus() {
        if (!initialProgram) {
          programFocus.classList.remove("visible");
          programFocus.innerHTML = "";
          return;
        }
        const [badgeClassName, badgeLabel] = deadlineBadge(initialProgram);
        const university = programUniversity(initialProgram);
        const universityHref = `university-detail.html?university=${encodeURIComponent(initialProgram.schoolId)}`;
        programFocus.classList.add("visible");
        programFocus.innerHTML = `
          <div class="focus-image">
            <img alt="${university} campus context" src="${programImage(initialProgram)}" />
          </div>
          <div class="focus-main">
            <span class="badge ${badgeClassName}">${badgeLabel}</span>
            <h2>${programName(initialProgram)}</h2>
            <div class="focus-meta">
              <span><a href="${universityHref}">${university}</a></span>
              <span>${labelDegree(programDegreeValue(initialProgram))}</span>
              <span>${programLanguageLabel(initialProgram)}</span>
            </div>
            <p>${programFit(initialProgram)}</p>
            <div class="focus-actions">
              <a class="details-link" href="${universityHref}">View university</a>
              <a class="secondary" href="programs.html">Back to all programs</a>
            </div>
          </div>
          <div class="focus-panel">
            <strong>Application snapshot</strong>
            <div class="focus-facts">
              <span>${programIntake(initialProgram)}</span>
              <span>${formatMoney(programTuitionAmount(initialProgram))} / year</span>
              <span>${programScholarship(initialProgram) ? programScholarshipLabel(initialProgram) : "No listed award"}</span>
              <span>${programSourceStatus(initialProgram)} source</span>
              <span>${programDecisionNote(initialProgram)}</span>
            </div>
          </div>
        `;
      }

      function renderSummary() {
        const open = programs.filter((program) => programDeadlineStatus(program) !== "closed").length;
        const scholarship = programs.filter(programScholarship).length;
        const urgent = programs.filter((program) => ["urgent", "closes-soon", "late"].includes(programDeadlineStatus(program))).length;
        document.querySelector("#summaryOpen").textContent = open;
        document.querySelector("#summaryScholarship").textContent = scholarship;
        document.querySelector("#summaryUrgent").textContent = urgent;
      }

      function render() {
        syncFilterControls();
        renderActiveChips();
        renderProgramFocus();
        renderResults();
        renderShortlist();
        renderSummary();
      }

      function handleQuick(value) {
        const [key, raw] = value.split(":");
        if (key === "degree") {
          state.filters.degree = raw;
          state.filters.language = "english";
        }
        if (key === "langReq") state.filters.langReq = raw;
        if (key === "scholarship") state.filters.scholarship = raw === "true";
        if (key === "deadline") state.filters.deadline = raw;
        if (key === "tuition") state.filters.tuition = raw;
        if (key === "documents") state.filters.documents = raw;
        state.page = 1;
        render();
      }

      function showAgentProgramNotice(message, options = {}) {
        let notice = document.querySelector("[data-program-agent-notice]");
        if (!notice) {
          notice = document.createElement("div");
          notice.className = "program-agent-notice";
          notice.dataset.programAgentNotice = "";
          document.querySelector(".result-bar")?.appendChild(notice);
        }
        if (options.html) notice.innerHTML = message;
        else notice.textContent = message;
        notice.classList.add("visible");
      }

      function captureProgramState() {
        return {
          filters: { ...state.filters },
          saved: Array.from(state.saved),
          compared: Array.from(state.compared),
          page: state.page,
          view: state.view,
          notice: document.querySelector("[data-program-agent-notice]")?.textContent || "",
        };
      }

      function restoreProgramState(snapshot) {
        if (!snapshot) return;
        state.filters = { ...snapshot.filters };
        state.saved = new Set(snapshot.saved || []);
        state.compared = new Set(snapshot.compared || []);
        state.page = snapshot.page || 1;
        state.view = snapshot.view || "list";
        render();
        const notice = document.querySelector("[data-program-agent-notice]");
        if (notice) {
          notice.textContent = snapshot.notice;
          notice.classList.toggle("visible", Boolean(snapshot.notice));
        }
      }

      function applyAgentProgramAction(action, detail = {}) {
        const before = captureProgramState();
        if (action === "apply-smart-filters") {
          state.filters.q = "English-taught computer science Hangzhou";
          state.filters.degree = "master";
          state.filters.language = "english";
          state.filters.city = "Hangzhou";
          state.page = 1;
          render();
          showAgentProgramNotice("Agent applied English-taught Master + Hangzhou filters.");
          document.querySelector(".results-pane")?.scrollIntoView({ behavior: "smooth", block: "start" });
          detail.setUndo?.(before);
          return true;
        }
        if (action === "save-program-shortlist") {
          ["zju-cs-msc", "nanjing-software-msc", "fudan-data-msc"].forEach((id) => state.saved.add(id));
          render();
          showAgentProgramNotice("Agent saved three routes to the shortlist.");
          detail.setUndo?.(before);
          return true;
        }
        if (action === "compare-routes") {
          state.compared = new Set(["zju-cs-msc", "nanjing-software-msc", "fudan-data-msc"]);
          render();
          showAgentProgramNotice("Agent prepared a three-route comparison.");
          document.querySelector("#shortlist")?.scrollIntoView({ behavior: "smooth", block: "center" });
          detail.setUndo?.(before);
          return true;
        }
        if (action === "open-choice-modal") {
          window.location.href = "application.html#add-choice";
          return true;
        }
        return false;
      }

      renderFilters(document.querySelector("#desktopFilters"));
      renderFilters(document.querySelector("#mobileFilters"), { showHeader: false });
      window.CuacCatalogList.listState(programList, "loading", { noun: "programs" });

      async function loadPrograms() {
        window.CuacCatalogList.listState(programList, "loading", { noun: "programs" });
        resultCount.textContent = "Loading programs";
        resultContext.textContent = "Reading the current published catalog.";
        try {
          programs = await window.CuacCatalogList.load("programs", { limit: 100 });
          initialProgram = focusedProgram
            ? programs.find((program) => programId(program) === focusedProgram)
            : null;
          if (initialProgram && !routeParams.get("q") && !routeParams.get("keyword")) {
            state.filters.q = programName(initialProgram);
          }
          render();
        } catch (error) {
          resultCount.textContent = "Programs unavailable";
          resultContext.textContent = "The published catalog could not be loaded.";
          window.CuacCatalogList.listState(programList, "error", { noun: "programs", message: error.message });
        }
      }

      loadPrograms();

      document.addEventListener("change", (event) => {
        const control = event.target.closest("[data-filter-key]");
        if (!control) return;
        const key = control.dataset.filterKey;
        setFilter(key, control.type === "checkbox" ? control.checked : control.value);
      });

      document.addEventListener("click", (event) => {
        if (event.target.closest("[data-catalog-retry]")) {
          loadPrograms();
          return;
        }
        const remove = event.target.closest("[data-remove-filter]");
        if (remove) {
          const key = remove.dataset.removeFilter;
          state.filters[key] = key === "scholarship" ? false : "";
          state.page = 1;
          render();
          return;
        }

        const save = event.target.closest("[data-save]");
        if (save) {
          const resumeSelector = window.CUAC?.dataAttributeSelector?.("data-save", save.dataset.save) || "[data-save]";
          if (window.CUAC?.requireStudentSignedIn && !window.CUAC.requireStudentSignedIn("Save this program", { resumeAction: { type: "click-selector", selector: resumeSelector } })) return;
          const id = save.dataset.save;
          const program = programs.find((item) => programId(item) === id);
          const savedNow = !state.saved.has(id);
          if (savedNow) state.saved.add(id);
          else state.saved.delete(id);
          render();
          showAgentProgramNotice(
            savedNow
              ? `Saved ${program ? programName(program) : "program"} to Favourites. <a href="favourites.html">Review saved items</a>`
              : `Removed ${program ? programName(program) : "program"} from Favourites.`,
            { html: savedNow },
          );
          return;
        }

        const compare = event.target.closest("[data-compare]");
        if (compare) {
          const id = compare.dataset.compare;
          if (state.compared.has(id)) {
            state.compared.delete(id);
          } else if (state.compared.size < 3) {
            state.compared.add(id);
          }
          render();
          return;
        }

        const programCard = event.target.closest("[data-program-card]");
        if (programCard && !event.target.closest("a, button, input, select, textarea")) {
          window.location.href = programCard.dataset.detailHref;
          return;
        }

        const page = event.target.closest("[data-page]");
        if (page) {
          if (page.disabled) return;
          const nextPage = Number(page.dataset.page);
          if (!nextPage) return;
          state.page = Math.max(1, nextPage);
          render();
          return;
        }

        const quick = event.target.closest("[data-quick]");
        if (quick) {
          handleQuick(quick.dataset.quick);
          return;
        }

        const reset = event.target.closest("[data-reset], #resetEmpty, #drawerReset");
        if (reset) {
          resetFilters();
          return;
        }

        const clearCompare = event.target.closest("[data-clear-compare]");
        if (clearCompare) {
          state.compared.clear();
          render();
        }
      });

      document.addEventListener("cuac:agent-action", (event) => {
        if (applyAgentProgramAction(event.detail?.action || "", event.detail || {})) event.preventDefault();
      });

      document.addEventListener("cuac:agent-undo", (event) => {
        if (!event.detail?.undo) return;
        restoreProgramState(event.detail.undo);
        event.preventDefault();
      });

      document.querySelector("#searchButton").addEventListener("click", () => setFilter("q", searchInput.value.trim()));
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") setFilter("q", searchInput.value.trim());
      });
      searchInput.addEventListener("input", (event) => {
        state.filters.q = event.target.value;
        state.page = 1;
        render();
      });

      sortSelect.addEventListener("change", () => {
        state.page = 1;
        render();
      });

      document.querySelectorAll("[data-view]").forEach((button) => {
        button.addEventListener("click", () => {
          state.view = button.dataset.view;
          document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
          render();
        });
      });

      function setDrawer(open) {
        drawer.classList.toggle("open", open);
        drawerBackdrop.classList.toggle("open", open);
        drawer.setAttribute("aria-hidden", String(!open));
        if (open) {
          drawer.removeAttribute("inert");
        } else {
          drawer.setAttribute("inert", "");
        }
      }

      document.querySelector("#openFilters").addEventListener("click", () => setDrawer(true));
      document.querySelector("#closeFilters").addEventListener("click", () => setDrawer(false));
      document.querySelector("#drawerApply").addEventListener("click", () => setDrawer(false));
      drawerBackdrop.addEventListener("click", () => setDrawer(false));
      document.addEventListener("keydown", (event) => {
        const programCard = event.target.closest("[data-program-card]");
        if (programCard && !event.target.closest("a, button, input, select, textarea") && ["Enter", " "].includes(event.key)) {
          event.preventDefault();
          window.location.href = programCard.dataset.detailHref;
          return;
        }
        if (event.key === "Escape") setDrawer(false);
      });

