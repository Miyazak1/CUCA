const iconHeart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.6c0 5.7-8.5 10.4-8.5 10.4S3.5 14.3 3.5 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.5 2.6Z"/></svg>';

      const programs = [
        {
          id: "zju-cs-msc",
          name: "Computer Science MSc",
          university: "Zhejiang University",
          city: "Hangzhou",
          province: "Zhejiang",
          degree: "master",
          subject: "Computer Science",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-10-15",
          deadlineStatus: "closes-soon",
          tuition: 42000,
          scholarship: true,
          scholarshipType: "CSC + university",
          langReq: "IELTS 6.5",
          hsk: "No HSK first",
          documents: "heavy",
          documentCount: 7,
          source: "verified",
          verified: "Aug 1",
          readiness: "Needs IELTS",
          readinessType: "warn",
          fit: "English route, Hangzhou, scholarship options, but documents are heavy.",
        },
        {
          id: "fudan-econ-ba",
          name: "Economics BA",
          university: "Fudan University",
          city: "Shanghai",
          province: "Shanghai",
          degree: "undergraduate",
          subject: "Economics",
          language: "chinese",
          intake: "Fall 2026",
          term: "fall",
          duration: "4 years",
          deadline: "2026-09-12",
          deadlineStatus: "urgent",
          tuition: 26000,
          scholarship: true,
          scholarshipType: "Shanghai Government",
          langReq: "HSK 5",
          hsk: "HSK required",
          documents: "medium",
          documentCount: 5,
          source: "verified",
          verified: "Jul 28",
          readiness: "HSK blocker",
          readinessType: "risk",
          fit: "Strong Shanghai option, but Chinese-taught route requires HSK.",
        },
        {
          id: "tongji-civil-msc",
          name: "Civil Engineering MSc",
          university: "Tongji University",
          city: "Shanghai",
          province: "Shanghai",
          degree: "master",
          subject: "Engineering",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-11-20",
          deadlineStatus: "open",
          tuition: 39000,
          scholarship: true,
          scholarshipType: "CSC + city",
          langReq: "IELTS 6.0",
          hsk: "No HSK first",
          documents: "medium",
          documentCount: 6,
          source: "stale",
          verified: "Apr 18",
          readiness: "Needs source recheck",
          readinessType: "warn",
          fit: "Engineering strength and scholarship signal, but source is older than target.",
        },
        {
          id: "blcu-language",
          name: "Chinese Language Non-degree",
          university: "Beijing Language and Culture University",
          city: "Beijing",
          province: "Beijing",
          degree: "non-degree",
          subject: "Chinese Language",
          language: "chinese",
          intake: "Spring 2027",
          term: "spring",
          duration: "1 year",
          deadline: "2026-12-20",
          deadlineStatus: "open",
          tuition: 22000,
          scholarship: false,
          scholarshipType: "No scholarship listed",
          langReq: "Placement after arrival",
          hsk: "No HSK first",
          documents: "light",
          documentCount: 3,
          source: "verified",
          verified: "Aug 3",
          readiness: "Light documents",
          readinessType: "good",
          fit: "Good preparatory language path with low document effort.",
        },
        {
          id: "hitsz-ai-msc",
          name: "Artificial Intelligence MSc",
          university: "Harbin Institute of Technology Shenzhen",
          city: "Shenzhen",
          province: "Guangdong",
          degree: "master",
          subject: "Computer Science",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-10-05",
          deadlineStatus: "closes-soon",
          tuition: 45000,
          scholarship: true,
          scholarshipType: "STEM grant",
          langReq: "IELTS 6.5",
          hsk: "No HSK first",
          documents: "heavy",
          documentCount: 6,
          source: "pending",
          verified: "Pending",
          readiness: "Source pending",
          readinessType: "warn",
          fit: "Strong tech-city fit, but admissions source needs confirmation.",
        },
        {
          id: "uibe-trade-msc",
          name: "International Trade MSc",
          university: "University of International Business and Economics",
          city: "Beijing",
          province: "Beijing",
          degree: "master",
          subject: "Business",
          language: "english",
          intake: "Late Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-11-10",
          deadlineStatus: "late",
          tuition: 36000,
          scholarship: true,
          scholarshipType: "Merit waiver",
          langReq: "English proof flexible",
          hsk: "No HSK first",
          documents: "medium",
          documentCount: 5,
          source: "verified",
          verified: "Aug 5",
          readiness: "Late option",
          readinessType: "good",
          fit: "Useful late-intake business route with flexible English proof.",
        },
        {
          id: "nju-data-msc",
          name: "Data Science MSc",
          university: "Nanjing University",
          city: "Nanjing",
          province: "Jiangsu",
          degree: "master",
          subject: "Computer Science",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-10-30",
          deadlineStatus: "open",
          tuition: 38000,
          scholarship: true,
          scholarshipType: "University award",
          langReq: "IELTS 6.0",
          hsk: "No HSK first",
          documents: "medium",
          documentCount: 6,
          source: "verified",
          verified: "Jul 30",
          readiness: "Likely fit",
          readinessType: "good",
          fit: "Lower-cost city than Shanghai with English-taught data route.",
        },
        {
          id: "scu-medicine-mbbs",
          name: "Clinical Medicine MBBS",
          university: "Sichuan University",
          city: "Chengdu",
          province: "Sichuan",
          degree: "undergraduate",
          subject: "Medicine",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "6 years",
          deadline: "2026-09-25",
          deadlineStatus: "urgent",
          tuition: 45000,
          scholarship: false,
          scholarshipType: "No scholarship listed",
          langReq: "IELTS or interview",
          hsk: "HSK after study",
          documents: "heavy",
          documentCount: 8,
          source: "stale",
          verified: "May 12",
          readiness: "Deadline rescue",
          readinessType: "risk",
          fit: "Medicine route needs careful document and deadline review.",
        },
        {
          id: "xjtu-mech-phd",
          name: "Mechanical Engineering PhD",
          university: "Xi'an Jiaotong University",
          city: "Xi'an",
          province: "Shaanxi",
          degree: "phd",
          subject: "Engineering",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "4 years",
          deadline: "2026-12-01",
          deadlineStatus: "open",
          tuition: 34000,
          scholarship: true,
          scholarshipType: "CSC possible",
          langReq: "IELTS 6.0",
          hsk: "No HSK first",
          documents: "heavy",
          documentCount: 7,
          source: "verified",
          verified: "Aug 2",
          readiness: "Funding route",
          readinessType: "good",
          fit: "Affordable engineering PhD route with scholarship signal.",
        },
        {
          id: "whu-ir-ba",
          name: "International Relations BA",
          university: "Wuhan University",
          city: "Wuhan",
          province: "Hubei",
          degree: "undergraduate",
          subject: "International Relations",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "4 years",
          deadline: "2026-11-05",
          deadlineStatus: "open",
          tuition: 28000,
          scholarship: true,
          scholarshipType: "Provincial award",
          langReq: "English proof flexible",
          hsk: "No HSK first",
          documents: "medium",
          documentCount: 5,
          source: "pending",
          verified: "Pending",
          readiness: "Needs review",
          readinessType: "warn",
          fit: "Lower tuition and English route, but source needs confirmation.",
        },
        {
          id: "sysu-business-msc",
          name: "Business Analytics MSc",
          university: "Sun Yat-sen University",
          city: "Guangzhou",
          province: "Guangdong",
          degree: "master",
          subject: "Business",
          language: "bilingual",
          intake: "Spring 2027",
          term: "spring",
          duration: "2 years",
          deadline: "2026-12-15",
          deadlineStatus: "open",
          tuition: 41000,
          scholarship: true,
          scholarshipType: "Partial award",
          langReq: "English + Chinese interview",
          hsk: "HSK helpful",
          documents: "medium",
          documentCount: 6,
          source: "verified",
          verified: "Jul 25",
          readiness: "Language review",
          readinessType: "warn",
          fit: "Good southern China option if bilingual study is acceptable.",
        },
        {
          id: "hust-biomed-msc",
          name: "Biomedical Engineering MSc",
          university: "Huazhong University of Science and Technology",
          city: "Wuhan",
          province: "Hubei",
          degree: "master",
          subject: "Engineering",
          language: "english",
          intake: "Late Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-11-18",
          deadlineStatus: "late",
          tuition: 33000,
          scholarship: true,
          scholarshipType: "University award",
          langReq: "IELTS 6.0",
          hsk: "No HSK first",
          documents: "light",
          documentCount: 4,
          source: "verified",
          verified: "Aug 6",
          readiness: "Light documents",
          readinessType: "good",
          fit: "Late intake with lower tuition and lighter document burden.",
        },
      ];

      const state = {
        page: 1,
        pageSize: 12,
        view: "list",
        saved: new Set(["zju-cs-msc"]),
        compared: new Set(["zju-cs-msc", "uibe-trade-msc"]),
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
          langReq: "",
          documents: "",
          source: "",
        },
      };

      const routeParams = new URLSearchParams(window.location.search);
      const focusedProgram = routeParams.get("program");
      const focusedUniversity = routeParams.get("university");
      const initialProgram = focusedProgram ? programs.find((program) => program.id === focusedProgram) : null;
      const initialQuery = routeParams.get("q") || focusedUniversity || initialProgram?.name || "";
      if (initialQuery) state.filters.q = initialQuery;
      ["degree", "subject", "language", "city", "intake", "deadline", "tuition", "langReq", "documents", "source"].forEach((key) => {
        if (routeParams.get(key)) state.filters[key] = routeParams.get(key);
      });
      if (routeParams.get("scholarship") === "true") state.filters.scholarship = true;

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
          label: "China fit",
          fields: [
            ["city", "City", [["", "Any city"], ["Beijing", "Beijing"], ["Shanghai", "Shanghai"], ["Hangzhou", "Hangzhou"], ["Shenzhen", "Shenzhen"], ["Chengdu", "Chengdu"], ["Nanjing", "Nanjing"], ["Wuhan", "Wuhan"], ["Xi'an", "Xi'an"], ["Guangzhou", "Guangzhou"]]],
            ["tuition", "Tuition", [["", "Any tuition"], ["under-25", "Under RMB 25k"], ["25-40", "RMB 25k-40k"], ["40-60", "RMB 40k-60k"], ["60-plus", "RMB 60k+"]]],
          ],
        },
        {
          label: "Application timing",
          fields: [
            ["intake", "Intake", [["", "Any intake"], ["fall", "Fall 2026"], ["spring", "Spring 2027"], ["late", "Late intake"]]],
            ["deadline", "Deadline", [["", "Any open status"], ["open", "Open"], ["closes-soon", "Closes soon"], ["urgent", "Urgent"], ["late", "Late intake"]]],
          ],
        },
        {
          label: "Requirements",
          fields: [
            ["langReq", "Language requirement", [["", "Any requirement"], ["no-hsk", "No HSK first"], ["hsk", "HSK required"], ["ielts", "IELTS / TOEFL required"], ["flexible", "English proof flexible"]]],
            ["documents", "Document effort", [["", "Any effort"], ["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"]]],
            ["source", "Source status", [["", "Any source"], ["verified", "Verified"], ["stale", "Needs recheck"], ["pending", "Pending source"]]],
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
        return `RMB ${value.toLocaleString("en-US")}`;
      }

      function formatShortDate(value) {
        return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
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

      function deadlineBadge(program) {
        if (program.deadlineStatus === "urgent") return ["danger", `Urgent: ${formatShortDate(program.deadline)}`];
        if (program.deadlineStatus === "closes-soon") return ["warning", `Closes ${formatShortDate(program.deadline)}`];
        if (program.deadlineStatus === "late") return ["success", `Late intake until ${formatShortDate(program.deadline)}`];
        return ["", `Open until ${formatShortDate(program.deadline)}`];
      }

      function sourceText(program) {
        if (program.source === "verified") return `Verified ${program.verified}`;
        if (program.source === "stale") return `Needs recheck ${program.verified}`;
        return "Source pending";
      }

      function programImage(program) {
        const images = {
          "Zhejiang University": "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
          "Fudan University": "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
          "Tongji University": "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80",
          "Beijing Language and Culture University": "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=80",
          "Harbin Institute of Technology Shenzhen": "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
          "University of International Business and Economics": "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=80",
          "Nanjing University": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80",
          "Sichuan University": "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=900&q=80",
          "Xi'an Jiaotong University": "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=80",
          "Wuhan University": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
          "Sun Yat-sen University": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
          "Huazhong University of Science and Technology": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80",
        };
        return images[program.university] || "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=900&q=80";
      }

      function tuitionMatch(program, value) {
        if (!value) return true;
        if (value === "under-25") return program.tuition < 25000;
        if (value === "25-40") return program.tuition >= 25000 && program.tuition <= 40000;
        if (value === "40-60") return program.tuition > 40000 && program.tuition <= 60000;
        return program.tuition > 60000;
      }

      function langReqMatch(program, value) {
        if (!value) return true;
        const combined = `${program.langReq} ${program.hsk}`.toLowerCase();
        if (value === "no-hsk") return combined.includes("no hsk");
        if (value === "hsk") return combined.includes("hsk required");
        if (value === "ielts") return combined.includes("ielts") || combined.includes("toefl");
        if (value === "flexible") return combined.includes("flexible");
        return true;
      }

      function matches(program) {
        const f = state.filters;
        const q = f.q.trim().toLowerCase();
        const haystack = [
          program.name,
          program.university,
          program.city,
          program.province,
          program.degree,
          program.subject,
          program.language,
          program.intake,
          program.scholarshipType,
          program.langReq,
          program.hsk,
        ].join(" ").toLowerCase();
        return (
          (!q || haystack.includes(q)) &&
          (!f.degree || program.degree === f.degree) &&
          (!f.subject || program.subject === f.subject) &&
          (!f.language || program.language === f.language) &&
          (!f.city || program.city === f.city) &&
          (!f.intake || (f.intake === "late" ? program.deadlineStatus === "late" : program.term === f.intake)) &&
          (!f.deadline || program.deadlineStatus === f.deadline) &&
          tuitionMatch(program, f.tuition) &&
          (!f.scholarship || program.scholarship) &&
          langReqMatch(program, f.langReq) &&
          (!f.documents || program.documents === f.documents) &&
          (!f.source || program.source === f.source)
        );
      }

      function sortedPrograms(items) {
        const mode = sortSelect.value;
        return [...items].sort((a, b) => {
          if (mode === "deadline") return new Date(a.deadline) - new Date(b.deadline);
          if (mode === "tuition") return a.tuition - b.tuition;
          if (mode === "scholarship") return Number(b.scholarship) - Number(a.scholarship);
          if (mode === "verified") return Number(b.source === "verified") - Number(a.source === "verified");
          if (mode === "documents") return a.documentCount - b.documentCount;
          return Number(b.source === "verified") - Number(a.source === "verified");
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
          langReq: "",
          documents: "",
          source: "",
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
        if (f.langReq) entries.push(["langReq", document.querySelector(`[data-filter-key="langReq"] option[value="${f.langReq}"]`)?.textContent || f.langReq]);
        if (f.documents) entries.push(["documents", labelDocuments(f.documents)]);
        if (f.source) entries.push(["source", document.querySelector(`[data-filter-key="source"] option[value="${f.source}"]`)?.textContent || f.source]);
        return entries;
      }

      function renderActiveChips() {
        activeChips.innerHTML = activeFilterEntries().map(([key, label]) => `
          <span class="active-chip">${label}<button type="button" aria-label="Remove ${label}" data-remove-filter="${key}">x</button></span>
        `).join("");
      }

      function renderRow(program, index = 0) {
        const [badgeClassName, badgeLabel] = deadlineBadge(program);
        const isSaved = state.saved.has(program.id);
        const isCompared = state.compared.has(program.id);
        const programHref = `programs.html?program=${encodeURIComponent(program.id)}`;
        const universityHref = `universities.html?q=${encodeURIComponent(program.university)}`;
        return `
          <article class="program-row result-enter" style="--enter-index: ${index}" data-program-id="${program.id}">
            <div class="program-art">
              <a href="${programHref}" aria-label="Open ${program.name}">
                <img alt="${program.university} campus context" src="${programImage(program)}" />
              </a>
              <div class="row-top">
                <span class="badge ${badgeClassName}">${badgeLabel}</span>
                <button class="save-button ${isSaved ? "saved" : ""}" type="button" data-save="${program.id}" aria-label="${isSaved ? "Saved" : "Save"} ${program.name}">${iconHeart}</button>
              </div>
            </div>
            <div class="program-main">
              <h2><a href="${programHref}">${program.name}</a></h2>
              <div class="meta"><a href="${universityHref}">${program.university}</a> · ${program.city}, ${program.province} · ${labelDegree(program.degree)} · ${labelLanguage(program.language)}</div>
              <div class="facts">
                <div class="fact"><strong>${program.intake}</strong><span>intake</span></div>
                <div class="fact"><strong>${formatMoney(program.tuition)}</strong><span>tuition / year</span></div>
              </div>
              <div class="signals">
                <span class="signal ${program.scholarship ? "good" : ""}">${program.scholarship ? "Scholarship signal" : "No award listed"}</span>
                <span class="signal ${program.hsk.includes("No HSK") ? "good" : "warn"}">${program.hsk}</span>
                <span class="signal ${program.readinessType}">${program.readiness}</span>
              </div>
              <p class="fit-line">${program.fit}</p>
            </div>
            <div class="row-actions">
              <button class="secondary" type="button" data-compare="${program.id}">${isCompared ? "Compared" : "Compare"}</button>
              <a class="details-link" href="${programHref}">View program</a>
            </div>
          </article>
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
          ? "Filtered by China-study fit, requirements, and source status."
          : "Open programs with deadline, source, and document signals.";
        programList.className = `program-list ${state.view === "compact" ? "compact" : ""}`;
        programList.innerHTML = visible.map(renderRow).join("");
        window.CUAC?.reveal?.(programList);
        emptyState.classList.toggle("visible", results.length === 0);
        pagination.innerHTML = results.length > state.pageSize
          ? Array.from({ length: totalPages }, (_, index) => `<button class="${state.page === index + 1 ? "active" : ""}" type="button" data-page="${index + 1}">${index + 1}</button>`).join("")
          : "";
      }

      function renderShortlist() {
        const saved = programs.filter((program) => state.saved.has(program.id));
        const compared = programs.filter((program) => state.compared.has(program.id));
        shortlistCard.innerHTML = `
          <div class="shortlist-head">
            <h2>Shortlist</h2>
            <button class="ghost" type="button" data-clear-compare>Clear compare</button>
          </div>
          <p class="rail-note">Save programs first, then compare deadline, tuition, documents, and source freshness.</p>
          <div class="rail-stats">
            <div class="rail-stat"><strong>${saved.length}</strong><span>saved</span></div>
            <div class="rail-stat"><strong>${compared.length}</strong><span>compared</span></div>
          </div>
          <div class="compare-items">
            ${compared.length ? compared.map((program) => `
              <div class="compare-item">
                <strong>${program.name}</strong>
                <span>${program.university}</span>
                <span>${formatMoney(program.tuition)} · ${program.documentCount} docs · ${formatShortDate(program.deadline)}</span>
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
        const universityHref = `universities.html?q=${encodeURIComponent(initialProgram.university)}`;
        programFocus.classList.add("visible");
        programFocus.innerHTML = `
          <div class="focus-image">
            <img alt="${initialProgram.university} campus context" src="${programImage(initialProgram)}" />
          </div>
          <div class="focus-main">
            <span class="badge ${badgeClassName}">${badgeLabel}</span>
            <h2>${initialProgram.name}</h2>
            <div class="focus-meta">
              <span><a href="${universityHref}">${initialProgram.university}</a></span>
              <span>${initialProgram.city}, ${initialProgram.province}</span>
              <span>${labelDegree(initialProgram.degree)}</span>
              <span>${labelLanguage(initialProgram.language)}</span>
            </div>
            <p>${initialProgram.fit}</p>
            <div class="focus-actions">
              <a class="details-link" href="${universityHref}">View university</a>
              <a class="secondary" href="programs.html">Back to all programs</a>
            </div>
          </div>
          <div class="focus-panel">
            <strong>Application snapshot</strong>
            <div class="focus-facts">
              <span>${initialProgram.intake}</span>
              <span>${formatMoney(initialProgram.tuition)} / year</span>
              <span>${initialProgram.scholarship ? initialProgram.scholarshipType : "No listed award"}</span>
              <span>${initialProgram.documentCount} ${initialProgram.documents} docs</span>
              <span>${initialProgram.langReq}</span>
              <span>${sourceText(initialProgram)}</span>
            </div>
          </div>
        `;
      }

      function renderSummary() {
        const open = programs.filter((program) => program.deadlineStatus !== "closed").length;
        const scholarship = programs.filter((program) => program.scholarship).length;
        const urgent = programs.filter((program) => ["urgent", "closes-soon", "late"].includes(program.deadlineStatus)).length;
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

      function showAgentProgramNotice(message) {
        let notice = document.querySelector("[data-program-agent-notice]");
        if (!notice) {
          notice = document.createElement("div");
          notice.className = "program-agent-notice";
          notice.dataset.programAgentNotice = "";
          document.querySelector(".result-bar")?.appendChild(notice);
        }
        notice.textContent = message;
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
          showAgentProgramNotice("Agent saved three demo routes to the shortlist.");
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
          window.location.href = "application.html";
          return true;
        }
        return false;
      }

      renderFilters(document.querySelector("#desktopFilters"));
      renderFilters(document.querySelector("#mobileFilters"), { showHeader: false });
      render();

      document.addEventListener("change", (event) => {
        const control = event.target.closest("[data-filter-key]");
        if (!control) return;
        const key = control.dataset.filterKey;
        setFilter(key, control.type === "checkbox" ? control.checked : control.value);
      });

      document.addEventListener("click", (event) => {
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
          const id = save.dataset.save;
          state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
          render();
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

        const page = event.target.closest("[data-page]");
        if (page) {
          state.page = Number(page.dataset.page);
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
        if (event.key === "Escape") setDrawer(false);
      });

