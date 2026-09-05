const universities = [];

const universityArrowRight = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
const escapeCatalogHtml = window.CuacCatalogList.escapeHtml;

const state = {
        query: "",
        filters: new Set(),
        criteria: {},
        saved: new Set(),
        sort: "relevance",
        view: "grid",
        page: 1,
        perPage: 8,
      };

      function slugifyRouteParam(value) {
        return String(value || "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }

      function schoolName(item = {}) {
        return item.nameEn || item.name || "University to confirm";
      }

      function schoolKey(item = {}) {
        return String(item.sourceId || item.id || slugifyRouteParam(schoolName(item)));
      }

      function schoolCity(item = {}) {
        return item.cityZh || item.city || "City not published";
      }

      function schoolCitySlug(item = {}) {
        return item.citySlug || slugifyRouteParam(schoolCity(item));
      }

      function schoolProvince(item = {}) {
        return item.region || item.province || "China";
      }

      function schoolSubjects(item = {}) {
        return item.subjectTags || item.subjects || item.programSubjectTags || item.featuredPrograms || [];
      }

      function schoolTags(item = {}) {
        return [item.schoolType, item.sourceStatus].filter(Boolean);
      }

      function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
      }

      function flattenText(value) {
        if (Array.isArray(value)) return value.map(flattenText).join(" ");
        if (value && typeof value === "object") return Object.values(value).map(flattenText).join(" ");
        return String(value || "");
      }

      function compactList(value) {
        if (Array.isArray(value)) return value.filter(Boolean);
        if (value == null || value === "") return [];
        return String(value).split(/[,\n、/]+/).map((item) => item.trim()).filter(Boolean);
      }

      function normalizedIncludes(value, target) {
        const needle = normalizeSearchText(target);
        if (!needle) return true;
        return normalizeSearchText(flattenText(value)).includes(needle);
      }

      function truthyParam(value) {
        return ["1", "true", "yes", "y"].includes(String(value || "").trim().toLowerCase());
      }

      function schoolPrograms(item = {}) {
        if (Array.isArray(item.programRecords)) return item.programRecords;
        if (Array.isArray(item.programs)) return item.programs;
        return [];
      }

      function matchesAnyProgram(item = {}, predicate) {
        return schoolPrograms(item).some(predicate);
      }

      function schoolScholarshipRecords(item = {}) {
        return [
          ...(Array.isArray(item.scholarshipsDetailed) ? item.scholarshipsDetailed : []),
          ...(Array.isArray(item.detailedScholarships) ? item.detailedScholarships : []),
        ].filter(Boolean);
      }

      function schoolCscaRules(item = {}) {
        return Array.isArray(item.cscaRules) ? item.cscaRules.filter(Boolean) : [];
      }

      function schoolApplicationReady(item = {}) {
        if (item.applicationReady != null) return Boolean(item.applicationReady);
        const hasApplicationEntry = Boolean(item.admissionsUrl || item.websiteUrl);
        const hasProgramRoutes = schoolProgramCount(item) > 0 || schoolEnglishRouteCount(item) > 0;
        const hasTiming = Boolean(item.deadlineSummary || item.round1Deadline || item.round2Deadline || item.round1CloseDate || item.round2CloseDate);
        return hasApplicationEntry && hasProgramRoutes && hasTiming;
      }

      function schoolApplicationReadiness(item = {}) {
        return schoolApplicationReady(item) ? "Application ready" : "Admissions page review";
      }

      function schoolScholarship(item = {}) {
        if (item.hasScholarships != null) return Boolean(item.hasScholarships);
        if (item.scholarship != null) return Boolean(item.scholarship);
        return Number(item.scholarshipCount || 0) > 0 || Boolean(schoolScholarshipRecords(item).length);
      }

      function schoolCost(item = {}) {
        return Number(item.cost || item.monthlyCost || 0);
      }

      function schoolAffordable(item = {}) {
        const cost = schoolCost(item);
        if (cost) return cost <= 3900;
        return String(item.tuitionSummary || item.tuition || "").toLowerCase().includes("rmb 3");
      }

      function schoolProgramCount(item = {}) {
        if (item.programCount != null) return item.programCount;
        return schoolPrograms(item).length;
      }

      function schoolEnglishRouteCount(item = {}) {
        if (item.englishProgramCount != null) return item.englishProgramCount;
        if (item.routes != null) return item.routes;
        return schoolPrograms(item).filter((program) => normalizedIncludes([program.teachingLanguage, program.language, program.languageOfInstruction], "english")).length;
      }

      function schoolHasTuition(item = {}) {
        return Boolean(item.tuitionSummary || item.tuitionByCategory || item.tuitionBandLabel || item.tuition) || matchesAnyProgram(item, (program) => Boolean(program.tuitionAmount || program.tuitionText || program.displayTuition));
      }

      function schoolHasUpcomingDeadline(item = {}) {
        return Boolean(item.deadlineSummary || item.round1Deadline || item.round2Deadline || item.round1CloseDate || item.round2CloseDate || (Array.isArray(item.upcomingDeadlines) && item.upcomingDeadlines.length))
          || matchesAnyProgram(item, (program) => Boolean(program.deadlineDate || program.deadlineLabel || program.applicationRound));
      }

      function schoolHasCsc(item = {}) {
        const scholarshipText = [
          schoolScholarshipRecords(item),
          compactList(item.scholarships),
          item.scholarshipText,
        ];
        return schoolScholarshipRecords(item).some((record) => record.isCsc || normalizedIncludes([record.type, record.name, record.nameEn, record.scholarshipSlug], "csc"))
          || normalizedIncludes(scholarshipText, "csc")
          || normalizedIncludes(scholarshipText, "中国政府奖学金");
      }

      function schoolHasCscaRules(item = {}) {
        const requirementText = [item.cscaRequirement, item.cscaRequirementNote]
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean)
          .some((value) => {
            if (["0", "false", "no", "none", "n/a", "na"].includes(value)) return false;
            if (/confirm by|check|pending|待确认|待复核|按项目确认/.test(value)) return false;
            return /csca|考试|科目|subject|math|physics|chemistry|biology|数学|物理|化学|生物/.test(value);
          });
        return schoolCscaRules(item).length > 0 || truthyParam(item.cscaRequired) || requirementText;
      }

      function schoolHasDetailedScholarship(item = {}) {
        return schoolScholarshipRecords(item).length > 0;
      }

      function compareSchoolName(a = {}, b = {}) {
        return schoolName(a).localeCompare(schoolName(b), "en", { sensitivity: "base" });
      }

      function schoolTuition(item = {}) {
        return item.tuitionSummary || "Not published";
      }

      function schoolNote(item = {}) {
        return item.sourceLabel || "No admissions summary published.";
      }

      function schoolImage(item = {}) {
        return "globe.svg";
      }

      function schoolDetailHref(item = {}) {
        return `university-detail.html?university=${encodeURIComponent(item.id)}`;
      }

      function normalizeCityParam(value) {
        if (!value) return "";
        const routeSlug = slugifyRouteParam(value);
        const knownCity = [...new Set(universities.map((item) => schoolCity(item)).filter(Boolean))]
          .find((city) => slugifyRouteParam(city) === routeSlug || city.toLowerCase() === String(value).trim().toLowerCase());
        return knownCity || value;
      }

      const routeParams = new URLSearchParams(window.location.search);
      const cscaliteSchoolCriteriaKeys = [
        "region",
        "schoolType",
        "cscaRequired",
        "applicationLevel",
        "language",
        "subject",
        "hsk",
        "hasTuition",
        "hasScholarship",
        "hasEnglishPrograms",
        "degreeLevel",
        "teachingLanguage",
        "programSubject",
        "fieldCategory",
        "hasProgramTuition",
        "hasUpcomingDeadline",
        "hasCsc",
        "hasCscaRules",
        "hasDetailedScholarship",
      ];
      state.query = routeParams.get("keyword") || routeParams.get("q") || normalizeCityParam(routeParams.get("city")) || "";
      cscaliteSchoolCriteriaKeys.forEach((key) => {
        const value = routeParams.get(key);
        if (value) state.criteria[key] = value;
      });
      routeParams.getAll("filter").forEach((filter) => {
        if (filter) state.filters.add(filter);
      });
      if (routeParams.get("sort")) state.sort = routeParams.get("sort");
      if (routeParams.get("view")) state.view = routeParams.get("view");

      const resultsGrid = document.getElementById("resultsGrid");
      const resultCount = document.getElementById("resultCount");
      const resultContext = document.getElementById("resultContext");
      const activeFilters = document.getElementById("activeFilters");
      const emptyState = document.getElementById("emptyState");
      const pagination = document.getElementById("pagination");
      const searchInput = document.getElementById("searchInput");
      const sortSelect = document.getElementById("sortSelect");
      const criteriaFields = [...document.querySelectorAll("[data-criteria-field]")];

      function normalizeSearchText(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/english[\s-]*taught/g, "english")
          .replace(/english routes?/g, "english")
          .replace(/scholarships?/g, "scholarship")
          .replace(/clear application info/g, "application ready")
          .replace(/application ready/g, "ready")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      }

      function matchesQuery(item) {
        const tokens = normalizeSearchText(state.query).split(/\s+/).filter(Boolean);
        if (!tokens.length) return true;
        const haystack = normalizeSearchText([
          schoolName(item),
          item.nameZh,
          schoolCity(item),
          schoolCitySlug(item),
          schoolProvince(item),
          schoolNote(item),
          schoolTuition(item),
          item.applicationSystemUrl,
          item.officialWebsite,
          schoolApplicationReadiness(item),
          schoolScholarship(item) ? "scholarship funding" : "",
          ...(schoolSubjects(item) || []),
          ...(schoolTags(item) || []),
        ].join(" "));
        return tokens.every((token) => haystack.includes(token));
      }

      function matchesFilters(item) {
        return [...state.filters].every((filter) => {
          if (filter === "Scholarship") return schoolScholarship(item);
          if (filter === "Application ready") return schoolApplicationReady(item);
          if (filter === "Affordable") return schoolAffordable(item);
          if (filter === "English routes") return schoolEnglishRouteCount(item) > 0 || schoolTags(item).includes(filter);
          if (filter === "Upcoming deadlines") return schoolHasUpcomingDeadline(item);
          if (filter === "CSCA rules") return schoolHasCscaRules(item);
          if (filter === "Detailed scholarships") return schoolHasDetailedScholarship(item);
          if (filter === "CSC scholarship") return schoolHasCsc(item);
          return schoolTags(item).includes(filter) || schoolSubjects(item).includes(filter);
        });
      }

      function matchesCriteria(item = {}) {
        const criteria = state.criteria || {};
        if (criteria.region && !normalizedIncludes([schoolProvince(item), schoolCity(item)], criteria.region)) return false;
        if (criteria.schoolType && !normalizedIncludes([item.schoolType, item.type], criteria.schoolType)) return false;
        if (criteria.cscaRequired && truthyParam(criteria.cscaRequired) !== schoolHasCscaRules(item)) return false;
        if (criteria.applicationLevel && !normalizedIncludes([item.applicationLevel, item.admissionLevel, schoolPrograms(item).map((program) => program.degreeLevel)], criteria.applicationLevel)) return false;
        if (criteria.language && !normalizedIncludes([item.languageRequirement, item.languageOfInstruction, item.languageTags, schoolPrograms(item).map((program) => [program.teachingLanguage, program.language])], criteria.language)) return false;
        if (criteria.subject && !normalizedIncludes([schoolSubjects(item), schoolPrograms(item).map((program) => [program.fieldCategory, program.nameEn, program.nameZh, program.displaySubjects])], criteria.subject)) return false;
        if (criteria.hsk === "exempt" && !/exempt|waiver|免/i.test(flattenText([item.hskRequirement, item.hskNotes, item.languageRequirement, item.englishRequirementNote]))) return false;
        if (criteria.hsk === "required" && !/hsk|中文|chinese/i.test(flattenText([item.hskRequirement, item.hskNotes, item.languageRequirement]))) return false;
        if (truthyParam(criteria.hasTuition) && !schoolHasTuition(item)) return false;
        if (truthyParam(criteria.hasScholarship) && !schoolScholarship(item)) return false;
        if (truthyParam(criteria.hasEnglishPrograms) && !(schoolEnglishRouteCount(item) > 0 || normalizedIncludes([item.languageOfInstruction, item.languageTags, schoolPrograms(item).map((program) => program.teachingLanguage)], "english"))) return false;
        if (criteria.degreeLevel && !matchesAnyProgram(item, (program) => normalizedIncludes([program.degreeLevel, program.degree, program.applicationLevel], criteria.degreeLevel))) return false;
        if (criteria.teachingLanguage && !matchesAnyProgram(item, (program) => normalizedIncludes([program.teachingLanguage, program.language, program.languageOfInstruction], criteria.teachingLanguage))) return false;
        if (criteria.programSubject && !normalizedIncludes([schoolSubjects(item), schoolPrograms(item).map((program) => [program.fieldCategory, program.nameEn, program.nameZh, program.displaySubjects])], criteria.programSubject)) return false;
        if (criteria.fieldCategory && !matchesAnyProgram(item, (program) => normalizedIncludes([program.fieldCategory, program.displayGroupLabel, program.displaySubjects], criteria.fieldCategory))) return false;
        if (truthyParam(criteria.hasProgramTuition) && !matchesAnyProgram(item, (program) => Boolean(program.tuitionAmount || program.tuitionText || program.displayTuition))) return false;
        if (truthyParam(criteria.hasUpcomingDeadline) && !schoolHasUpcomingDeadline(item)) return false;
        if (truthyParam(criteria.hasCsc) && !schoolHasCsc(item)) return false;
        if (truthyParam(criteria.hasCscaRules) && !schoolHasCscaRules(item)) return false;
        if (truthyParam(criteria.hasDetailedScholarship) && !schoolHasDetailedScholarship(item)) return false;
        return true;
      }

      function sorted(items) {
        const list = [...items];
        if (state.sort === "name") list.sort(compareSchoolName);
        if (state.sort === "scholarship") list.sort((a, b) => Number(schoolScholarship(b)) - Number(schoolScholarship(a)));
        if (state.sort === "routes") list.sort((a, b) => schoolEnglishRouteCount(b) - schoolEnglishRouteCount(a));
        if (state.sort === "readiness") list.sort((a, b) => Number(schoolApplicationReady(b)) - Number(schoolApplicationReady(a)));
        return list;
      }

      function getResults() {
        return sorted(universities.filter((item) => matchesQuery(item) && matchesFilters(item) && matchesCriteria(item)));
      }

      function card(item, index = 0) {
        const name = schoolName(item);
        const key = schoolKey(item);
        const saved = state.saved.has(key);
        const imageBadge = schoolEnglishRouteCount(item) ? `${schoolEnglishRouteCount(item)} English routes` : `${schoolProgramCount(item)} programs`;
        const signals = [schoolApplicationReadiness(item), ...schoolTags(item).filter((tag) => tag !== "Verified").slice(0, 3)];
        const detailHref = schoolDetailHref(item);
        return `
          <article class="university-card result-enter" style="--enter-index: ${index}" data-name="${escapeCatalogHtml(name)}" role="link" tabindex="0" data-university-card data-detail-href="${detailHref}" aria-label="View ${escapeCatalogHtml(name)} university guide">
            <div class="card-image">
              <span class="badge">${escapeCatalogHtml(imageBadge)}</span>
              <button class="save ${saved ? "saved" : ""}" type="button" data-save="${escapeCatalogHtml(key)}" aria-label="Save ${escapeCatalogHtml(name)}">${saved ? "♥" : "♡"}</button>
              <img alt="University catalog marker" src="${schoolImage(item)}" />
              <span class="university-card-open" aria-hidden="true">${universityArrowRight}</span>
            </div>
            <div class="card-body">
              <h2><a href="${detailHref}">${escapeCatalogHtml(name)}</a></h2>
              <div class="location">${escapeCatalogHtml(schoolCity(item))}, ${escapeCatalogHtml(schoolProvince(item))}</div>
              <div class="signals">${signals.map((signal) => `<span class="signal">${escapeCatalogHtml(signal)}</span>`).join("")}</div>
              <p class="note">${escapeCatalogHtml(schoolNote(item))}</p>
              <div class="facts">
                <div class="mini-fact"><strong>${schoolProgramCount(item)}</strong><span>programs</span></div>
                <div class="mini-fact"><strong>${escapeCatalogHtml(schoolTuition(item))}</strong><span>tuition</span></div>
                <div class="mini-fact"><strong>${schoolEnglishRouteCount(item)}</strong><span>routes</span></div>
              </div>
            </div>
          </article>
        `;
      }

      function renderActiveFilters() {
        const filters = [
          ...[...state.filters].map((filter) => ({ type: "filter", key: filter, label: filter })),
          ...Object.entries(state.criteria || {}).map(([key, value]) => ({ type: "criteria", key, label: criteriaLabel(key, value) })),
        ];
        activeFilters.innerHTML = filters
          .map((filter) => `<span class="active-pill">${escapeHtml(filter.label)}<button type="button" data-remove="${escapeHtml(filter.key)}" data-remove-type="${filter.type}" aria-label="Remove ${escapeHtml(filter.label)}">x</button></span>`)
          .join("");
      }

      function criteriaLabel(key, value) {
        const labels = {
          region: "Region",
          schoolType: "School type",
          cscaRequired: "CSCA required",
          applicationLevel: "Application level",
          language: "Language",
          subject: "Subject",
          hsk: "HSK",
          hasTuition: "Tuition available",
          hasScholarship: "Scholarship options",
          hasEnglishPrograms: "English-taught programs",
          degreeLevel: "Degree level",
          teachingLanguage: "Teaching language",
          programSubject: "Program subject",
          fieldCategory: "Field",
          hasProgramTuition: "Program tuition",
          hasUpcomingDeadline: "Upcoming deadline",
          hasCsc: "CSC scholarship",
          hasCscaRules: "CSCA rules",
          hasDetailedScholarship: "Detailed scholarships",
        };
        if (String(value).toLowerCase() === "true") return labels[key] || key;
        return `${labels[key] || key}: ${value}`;
      }

      function renderPagination(total) {
        const pages = Math.max(1, Math.ceil(total / state.perPage));
        state.page = Math.min(Math.max(1, state.page), pages);
        if (total <= state.perPage) {
          pagination.innerHTML = "";
          return;
        }

        const pageButtons = Array.from({ length: pages }, (_, index) => {
          const page = index + 1;
          return `<button type="button" class="${page === state.page ? "active" : ""}" data-page="${page}" aria-label="Page ${page}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`;
        }).join("");

        pagination.innerHTML = `
          <button type="button" data-page="${state.page - 1}" aria-label="Previous page" ${state.page === 1 ? "disabled" : ""}>‹</button>
          ${pageButtons}
          <button type="button" data-page="${state.page + 1}" aria-label="Next page" ${state.page === pages ? "disabled" : ""}>›</button>
        `;
      }

      function render() {
        const results = getResults();
        const start = (state.page - 1) * state.perPage;
        const shown = results.slice(start, start + state.perPage);
        resultCount.textContent = `${results.length} ${results.length === 1 ? "university" : "universities"}`;
        resultContext.textContent = state.query || state.filters.size || Object.keys(state.criteria || {}).length
          ? "Filtered by your current search and China-study signals."
          : "Showing Chinese universities with international admissions routes.";
        resultsGrid.className = `university-grid ${state.view === "list" ? "list" : ""}`;
        resultsGrid.innerHTML = shown.map(card).join("");
        window.CUAC?.reveal?.(resultsGrid);
        emptyState.style.display = results.length ? "none" : "block";
        renderPagination(results.length);
        renderActiveFilters();
        searchInput.value = state.query;
        sortSelect.value = state.sort;
        document.querySelectorAll("[data-filter], [data-chip]").forEach((button) => {
          const value = button.dataset.filter || button.dataset.chip;
          button.classList.toggle("active", state.filters.has(value));
        });
        document.querySelectorAll("[data-view]").forEach((button) => {
          button.classList.toggle("active", button.dataset.view === state.view);
        });
        criteriaFields.forEach((field) => {
          if (field.dataset.criteriaField === "scholarshipRoute") {
            field.value = truthyParam(state.criteria?.hasCsc) ? "csc" : truthyParam(state.criteria?.hasDetailedScholarship) ? "scholarship" : "";
            return;
          }
          field.value = state.criteria?.[field.dataset.criteriaField] || "";
        });
      }

      function showUniversityAgentNotice(message, options = {}) {
        let notice = document.querySelector("[data-university-agent-notice]");
        if (!notice) {
          notice = document.createElement("div");
          notice.className = "university-agent-notice";
          notice.dataset.universityAgentNotice = "";
          document.querySelector(".result-copy")?.appendChild(notice);
        }
        if (options.html) notice.innerHTML = message;
        else notice.textContent = message;
        notice.classList.add("visible");
      }

      function captureUniversityState() {
        return {
          query: state.query,
          filters: Array.from(state.filters),
          criteria: { ...state.criteria },
          saved: Array.from(state.saved),
          sort: state.sort,
          view: state.view,
          page: state.page,
          notice: document.querySelector("[data-university-agent-notice]")?.textContent || "",
        };
      }

      function restoreUniversityState(snapshot) {
        if (!snapshot) return;
        state.query = snapshot.query || "";
        state.filters = new Set(snapshot.filters || []);
        state.criteria = { ...(snapshot.criteria || {}) };
        state.saved = new Set(snapshot.saved || []);
        state.sort = snapshot.sort || "relevance";
        state.view = snapshot.view || "grid";
        state.page = snapshot.page || 1;
        render();
        const notice = document.querySelector("[data-university-agent-notice]");
        if (notice) {
          notice.textContent = snapshot.notice;
          notice.classList.toggle("visible", Boolean(snapshot.notice));
        }
      }

      function applyUniversityAgentAction(action, detail = {}) {
        const before = captureUniversityState();
        if (action === "apply-smart-filters") {
          state.query = "";
          state.filters = new Set(["Application ready", "English routes", "Affordable"]);
          state.sort = "cityCost";
          state.page = 1;
          render();
          showUniversityAgentNotice("Agent filtered for application-ready, English-route, lower-cost universities.");
          document.querySelector(".results")?.scrollIntoView({ behavior: "smooth", block: "start" });
          detail.setUndo?.(before);
          return true;
        }
        if (action === "save-program-shortlist" || action === "compare-routes") {
          ["Zhejiang University", "Nanjing University", "Fudan University"].forEach((name) => {
            const school = universities.find((item) => schoolName(item) === name);
            state.saved.add(school ? schoolKey(school) : slugifyRouteParam(name));
          });
          state.view = "grid";
          render();
          showUniversityAgentNotice("Agent saved three universities for route comparison.");
          detail.setUndo?.(before);
          return true;
        }
        if (action === "open-choice-modal") {
          window.location.href = "application.html#add-choice";
          return true;
        }
        return false;
      }

      document.getElementById("searchButton").addEventListener("click", () => {
        state.query = searchInput.value;
        state.page = 1;
        render();
      });

      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          state.query = searchInput.value;
          state.page = 1;
          render();
        }
      });

      document.querySelectorAll("[data-filter], [data-chip]").forEach((button) => {
        button.addEventListener("click", () => {
          const value = button.dataset.filter || button.dataset.chip;
          if (state.filters.has(value)) state.filters.delete(value);
          else state.filters.add(value);
          state.page = 1;
          render();
        });
      });

      sortSelect.addEventListener("change", (event) => {
        state.sort = event.target.value;
        state.page = 1;
        render();
      });

      criteriaFields.forEach((field) => {
        field.addEventListener("change", () => {
          const key = field.dataset.criteriaField;
          if (!key) return;
          if (key === "scholarshipRoute") {
            delete state.criteria.hasCsc;
            delete state.criteria.hasDetailedScholarship;
            if (field.value === "csc") state.criteria.hasCsc = "true";
            if (field.value === "scholarship") state.criteria.hasDetailedScholarship = "true";
            state.page = 1;
            render();
            return;
          }
          if (field.value) state.criteria[key] = field.value;
          else delete state.criteria[key];
          state.page = 1;
          render();
        });
      });

      document.querySelectorAll("[data-view]").forEach((button) => {
        button.addEventListener("click", () => {
          state.view = button.dataset.view;
          document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
          render();
        });
      });

      activeFilters.addEventListener("click", (event) => {
        const value = event.target.dataset.remove;
        if (!value) return;
        if (event.target.dataset.removeType === "criteria") delete state.criteria[value];
        else state.filters.delete(value);
        state.page = 1;
        render();
      });

      resultsGrid.addEventListener("click", (event) => {
        const saveButton = event.target.closest("[data-save]");
        if (saveButton) {
          const key = saveButton.dataset.save;
          const school = universities.find((item) => schoolKey(item) === key);
          const name = school ? schoolName(school) : key;
          const resumeSelector = window.CUAC?.dataAttributeSelector?.("data-save", saveButton?.dataset.save || key) || "[data-save]";
          if (window.CUAC?.requireStudentSignedIn && !window.CUAC.requireStudentSignedIn("Save this university", { resumeAction: { type: "click-selector", selector: resumeSelector } })) return;
          const savedNow = !state.saved.has(key);
          if (savedNow) state.saved.add(key);
          else state.saved.delete(key);
          render();
          showUniversityAgentNotice(
            savedNow
              ? `Saved ${name} to Favourites. <a href="favourites.html">Find matching programs</a>`
              : `Removed ${name} from Favourites.`,
            { html: savedNow },
          );
          return;
        }
        const universityCard = event.target.closest("[data-university-card]");
        if (universityCard && !event.target.closest("a, button, input, select, textarea")) {
          window.location.href = universityCard.dataset.detailHref;
        }
      });

      resultsGrid.addEventListener("keydown", (event) => {
        const universityCard = event.target.closest("[data-university-card]");
        if (!universityCard || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        window.location.href = universityCard.dataset.detailHref;
      });

      pagination.addEventListener("click", (event) => {
        const page = Number(event.target.dataset.page);
        if (!page) return;
        state.page = Math.max(1, page);
        render();
      });

      document.getElementById("resetEmpty").addEventListener("click", () => {
        state.query = "";
        state.filters.clear();
        state.criteria = {};
        state.page = 1;
        searchInput.value = "";
        render();
      });

      document.addEventListener("cuac:agent-action", (event) => {
        if (applyUniversityAgentAction(event.detail?.action || "", event.detail || {})) event.preventDefault();
      });

      document.addEventListener("cuac:agent-undo", (event) => {
        if (!event.detail?.undo) return;
        restoreUniversityState(event.detail.undo);
        event.preventDefault();
      });

      window.CuacCatalogList.listState(resultsGrid, "loading", { noun: "universities" });

      async function loadUniversities() {
        window.CuacCatalogList.listState(resultsGrid, "loading", { noun: "universities" });
        resultCount.textContent = "Loading universities";
        resultContext.textContent = "Reading the current published catalog.";
        try {
          const records = await window.CuacCatalogList.load("schools", { limit: 100 });
          universities.splice(0, universities.length, ...records);
          const scholarshipTotal = universities.reduce((total, item) => total + Number(item.scholarshipCount || 0), 0);
          const englishRouteTotal = universities.reduce((total, item) => total + Number(item.englishProgramCount || 0), 0);
          document.querySelector("#summaryUniversities").textContent = universities.length;
          document.querySelector("#summaryEnglishRoutes").textContent = englishRouteTotal;
          const summary = document.querySelector("#summaryScholarships");
          if (summary) summary.textContent = scholarshipTotal;
          render();
        } catch (error) {
          resultCount.textContent = "Universities unavailable";
          resultContext.textContent = "The published catalog could not be loaded.";
          window.CuacCatalogList.listState(resultsGrid, "error", { noun: "universities", message: error.message });
        }
      }

      document.addEventListener("click", (event) => {
        if (event.target.closest("[data-catalog-retry]")) loadUniversities();
      });

      loadUniversities();
