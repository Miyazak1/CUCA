const params = new URLSearchParams(window.location.search);
      void params;
      const plannerInputs = Array.from(document.querySelectorAll(".hero [data-site-search-input]"));
      const plannerFeedback = document.querySelector("[data-planner-feedback]");

      function syncPlannerValue(value) {
        plannerInputs.forEach((input) => {
          if (input.value !== value) {
            input.value = value;
          }
        });
      }

      plannerInputs.forEach((input) => {
        input.addEventListener("input", (event) => syncPlannerValue(event.target.value));
      });

      document.querySelectorAll("[data-search-chip]").forEach((chip) => {
        chip.addEventListener("click", () => {
          document.querySelectorAll("[data-search-chip]").forEach((item) => item.classList.remove("active"));
          chip.classList.add("active");
          const addition = chip.dataset.searchChip;
          syncPlannerValue(addition);
          plannerInputs[0]?.dispatchEvent(new Event("input", { bubbles: true }));
          if (plannerFeedback) plannerFeedback.textContent = window.CUACI18n?.t("home.feedback.search") || "Press Enter or Search to view matching published catalog results.";
          plannerInputs[0]?.focus();
        });
      });

      document.querySelector("[data-site-search-form]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = plannerInputs[0]?.value.trim() || "";
        if (!query) {
          if (plannerFeedback) plannerFeedback.textContent = window.CUACI18n?.t("home.feedback.empty") || "Enter a program, university, scholarship, or city.";
          plannerInputs[0]?.focus();
          return;
        }
        const params = new URLSearchParams({ q: query });
        if (window.CUACI18n?.locale && window.CUACI18n.locale !== "en") params.set("lang", window.CUACI18n.locale);
        window.location.href = `search.html?${params}`;
      });

      document.querySelector("[data-create-list]")?.addEventListener("click", () => {
        if (!window.CUAC?.requireStudentSignedIn?.("Create your student list", {
          requiredRole: "student",
          returnUrl: window.location.href,
          resumeAction: {
            type: "click-selector",
            selector: "[data-create-list]",
          },
        })) {
          return;
        }
        window.location.href = "onboarding-api.html";
      });

      const homeIcons = {
        program: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/></svg>',
        school: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M6 12H4a2 2 0 0 0-2 2v8"/><path d="M18 9h2a2 2 0 0 1 2 2v11"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg>',
        funding: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2.2-3.7L12 7Z"/><path d="M12 7h4.5a2.5 2.5 0 1 0-2.2-3.7L12 7Z"/></svg>',
        calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',
        city: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
        language: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>',
        documents: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
        english: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22V8"/><path d="m5 12 7-7 7 7"/><path d="M5 22h14"/></svg>',
        cost: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H15a3.5 3.5 0 0 1 0 7H6"/></svg>',
        readiness: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>',
        intake: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
      };

      const schoolImageFallbacks = [
        "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
        "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=700&q=80",
        "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=700&q=80",
        "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=700&q=80",
      ];

      function escapeHomeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]);
      }

      function setHomeHTML(selector, html) {
        const target = document.querySelector(selector);
        if (target && html) target.innerHTML = html;
      }

      function formatCatalogDate(value, fallback) {
        const date = value ? new Date(value) : null;
        if (!date || !Number.isFinite(date.valueOf())) return fallback || "Date not published";
        return new Intl.DateTimeFormat(window.CUACI18n?.locale || "en", { year: "numeric", month: "short", day: "numeric" }).format(date);
      }

      function renderHomeCategories(categories) {
        setHomeHTML("[data-home-categories]", categories.map((category) => `
          <a class="cat" href="${escapeHomeHTML(category.href || "#")}">
            <span class="category-icon">${homeIcons[category.icon] || homeIcons.program}</span>
            <strong>${escapeHomeHTML(category.title)}</strong><span>${escapeHomeHTML(category.value)}</span>
          </a>
        `).join(""));
      }

      function renderCurrentIntakes(programs) {
        if (!programs.length) return;
        setHomeHTML("[data-home-open-intakes]", programs.map((program) => {
          const term = [program.latestIntakeTerm, program.latestIntakeYear].filter(Boolean).join(" ");
          const context = [program.university, program.citySlug, term].filter(Boolean).join(" · ");
          const deadline = formatCatalogDate(program.latestIntakeDeadlineDate || program.deadlineDate, program.deadlineLabel);
          return `
          <div class="program">
            <div><strong>${escapeHomeHTML(program.nameEn || program.name)}</strong><span>${escapeHomeHTML(context || "Published program route")}</span></div>
            <span class="pill">${escapeHomeHTML(deadline)}</span>
          </div>`;
        }).join(""));
      }

      function renderCitySnapshot(cities) {
        if (!cities.length) return;
        setHomeHTML("[data-home-city-snapshot]", cities.map((city) => `
          <div class="city"><div><strong>${escapeHomeHTML(city.nameEn || city.name)}</strong><span>${escapeHomeHTML(city.monthlyCost || "Cost not published")}</span></div></div>
        `).join(""));
      }

      function renderSchools(schools) {
        if (!schools.length) return;
        setHomeHTML("[data-home-schools]", schools.map((school, index) => `
          <a class="provider-card" href="university-detail.html?university=${encodeURIComponent(school.id)}">
            <div class="provider-image"><img alt="${escapeHomeHTML(school.nameEn)} campus" src="${escapeHomeHTML(schoolImageFallbacks[index % schoolImageFallbacks.length])}" /></div>
            <span class="heart">♡</span>
            <div class="provider-copy"><strong>${escapeHomeHTML(school.nameEn)}</strong><span>${escapeHomeHTML([school.city, school.regionLabel, Number.isFinite(school.programCount) ? `${school.programCount} published programs` : ""].filter(Boolean).join(" · "))}</span></div>
          </a>
        `).join(""));
      }

      async function renderHomeSummary() {
        const api = window.CuacCatalogList;
        if (!api || (window.CUACI18n && window.CUACI18n.locale !== "en")) return;
        try {
          const [programPage, schoolPage, scholarshipPage, cityPage] = await Promise.all([
            api.loadPage("programs", { limit: 6, deadline: "open", sort: "deadline" }),
            api.loadPage("schools", { limit: 4 }),
            api.loadPage("scholarships", { limit: 1 }),
            api.loadPage("cities", { limit: 3 }),
          ]);
          const currentPrograms = programPage.records.filter((program) => ["open", "upcoming"].includes(program.intakeAvailability));
          renderHomeCategories([
            { title: "Programs", value: `${programPage.total} current routes`, href: "programs.html?deadline=open", icon: "program" },
            { title: "Universities", value: `${schoolPage.total} published`, href: "universities.html", icon: "school" },
            { title: "Scholarships", value: `${scholarshipPage.total} funding routes`, href: "scholarships.html", icon: "funding" },
            { title: "Intakes", value: "Full dates", href: "programs.html?deadline=open", icon: "calendar" },
            { title: "Cities & cost", value: `${cityPage.total} city guides`, href: "cities.html", icon: "city" },
            { title: "English-taught", value: "Language filters", href: "programs.html?language=english", icon: "language" },
            { title: "Documents", value: "Application guide", href: "guides.html#documents", icon: "documents" },
          ]);
          renderCurrentIntakes(currentPrograms.slice(0, 3));
          renderCitySnapshot(cityPage.records);
          renderSchools(schoolPage.records);
        } catch (error) {
          console.warn("Current homepage catalog summary is unavailable.", error);
        }
      }

      void renderHomeSummary();

