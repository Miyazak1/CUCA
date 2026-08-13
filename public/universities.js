const universities = [
        {
          name: "Zhejiang University",
          city: "Hangzhou",
          province: "Zhejiang",
          subjects: ["Engineering", "Computer Science", "Medicine"],
          tags: ["English routes", "Verified", "Fall 2026"],
          note: "Research city with strong engineering, medicine, and computer science routes.",
          programs: 26,
          tuition: "RMB 32k",
          routes: 14,
          cost: 3600,
          scholarship: true,
          verified: true,
          image: "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
        },
        {
          name: "Tsinghua University",
          city: "Beijing",
          province: "Beijing",
          subjects: ["Engineering", "Computer Science"],
          tags: ["Scholarship", "Verified", "Fall 2026"],
          note: "Highly selective engineering and technology university with scholarship signals.",
          programs: 18,
          tuition: "RMB 40k",
          routes: 9,
          cost: 4800,
          scholarship: true,
          verified: true,
          image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Fudan University",
          city: "Shanghai",
          province: "Shanghai",
          subjects: ["Business", "Medicine", "Economics"],
          tags: ["English routes", "Scholarship", "Verified"],
          note: "Strong business, medicine, and sciences routes in a fast-moving city.",
          programs: 22,
          tuition: "RMB 45k",
          routes: 11,
          cost: 5200,
          scholarship: true,
          verified: true,
          image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Tongji University",
          city: "Shanghai",
          province: "Shanghai",
          subjects: ["Engineering", "Architecture", "Design"],
          tags: ["English routes", "Fall 2026"],
          note: "Architecture and engineering strengths with several international program routes.",
          programs: 19,
          tuition: "RMB 39k",
          routes: 8,
          cost: 5200,
          scholarship: false,
          verified: false,
          image: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Nanjing University",
          city: "Nanjing",
          province: "Jiangsu",
          subjects: ["Computer Science", "Business", "International Relations"],
          tags: ["Verified", "Affordable", "Scholarship"],
          note: "Balanced academic reputation with lower living cost than Shanghai.",
          programs: 16,
          tuition: "RMB 30k",
          routes: 7,
          cost: 3900,
          scholarship: true,
          verified: true,
          image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Wuhan University",
          city: "Wuhan",
          province: "Hubei",
          subjects: ["Medicine", "Engineering", "Chinese Language"],
          tags: ["Affordable", "Fall 2026"],
          note: "Large campus setting with medicine and engineering options in a lower-cost city.",
          programs: 20,
          tuition: "RMB 28k",
          routes: 6,
          cost: 3300,
          scholarship: false,
          verified: false,
          image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Xi'an Jiaotong University",
          city: "Xi'an",
          province: "Shaanxi",
          subjects: ["Engineering", "Computer Science", "Medicine"],
          tags: ["Affordable", "Scholarship", "Verified"],
          note: "Strong engineering and research profile with affordable city living.",
          programs: 17,
          tuition: "RMB 29k",
          routes: 8,
          cost: 3000,
          scholarship: true,
          verified: true,
          image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Sun Yat-sen University",
          city: "Guangzhou",
          province: "Guangdong",
          subjects: ["Medicine", "Business", "Economics"],
          tags: ["English routes", "Scholarship"],
          note: "Southern China route with medicine, business, and economics options.",
          programs: 21,
          tuition: "RMB 34k",
          routes: 10,
          cost: 4300,
          scholarship: true,
          verified: false,
          image: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Harbin Institute of Technology",
          city: "Harbin",
          province: "Heilongjiang",
          subjects: ["Engineering", "Computer Science"],
          tags: ["Scholarship", "Verified", "Affordable"],
          note: "Engineering-focused university with strong scholarship and research signals.",
          programs: 15,
          tuition: "RMB 26k",
          routes: 5,
          cost: 2800,
          scholarship: true,
          verified: true,
          image: "https://images.unsplash.com/photo-1519452575417-564c1401ecc0?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Shanghai Jiao Tong University",
          city: "Shanghai",
          province: "Shanghai",
          subjects: ["Engineering", "Medicine", "Business"],
          tags: ["English routes", "Verified"],
          note: "Selective Shanghai university with engineering, medicine, and business strengths.",
          programs: 24,
          tuition: "RMB 46k",
          routes: 12,
          cost: 5200,
          scholarship: false,
          verified: true,
          image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Sichuan University",
          city: "Chengdu",
          province: "Sichuan",
          subjects: ["Medicine", "Engineering", "Chinese Language"],
          tags: ["Affordable", "Fall 2026"],
          note: "Chengdu option with medicine and engineering routes in a relaxed city.",
          programs: 19,
          tuition: "RMB 27k",
          routes: 6,
          cost: 3200,
          scholarship: false,
          verified: false,
          image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Beijing Language and Culture University",
          city: "Beijing",
          province: "Beijing",
          subjects: ["Chinese Language", "International Relations"],
          tags: ["Verified", "Fall 2026"],
          note: "Focused language and China studies route for students building Chinese skills.",
          programs: 12,
          tuition: "RMB 24k",
          routes: 4,
          cost: 4800,
          scholarship: false,
          verified: true,
          image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=80",
        },
      ];

      const state = {
        query: "",
        filters: new Set(),
        saved: new Set(),
        sort: "relevance",
        view: "grid",
        page: 1,
        perPage: 8,
      };

      const routeParams = new URLSearchParams(window.location.search);
      state.query = routeParams.get("q") || "";
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

      function matchesQuery(item) {
        const query = state.query.trim().toLowerCase();
        if (!query) return true;
        return [item.name, item.city, item.province, item.note, ...item.subjects, ...item.tags]
          .join(" ")
          .toLowerCase()
          .includes(query);
      }

      function matchesFilters(item) {
        return [...state.filters].every((filter) => {
          if (filter === "Scholarship") return item.scholarship;
          if (filter === "Verified") return item.verified;
          if (filter === "Affordable") return item.cost <= 3900;
          return item.tags.includes(filter) || item.subjects.includes(filter);
        });
      }

      function sorted(items) {
        const list = [...items];
        if (state.sort === "cityCost") list.sort((a, b) => a.cost - b.cost);
        if (state.sort === "scholarship") list.sort((a, b) => Number(b.scholarship) - Number(a.scholarship));
        if (state.sort === "routes") list.sort((a, b) => b.routes - a.routes);
        if (state.sort === "verified") list.sort((a, b) => Number(b.verified) - Number(a.verified));
        return list;
      }

      function getResults() {
        return sorted(universities.filter((item) => matchesQuery(item) && matchesFilters(item)));
      }

      function card(item, index = 0) {
        const saved = state.saved.has(item.name);
        const status = item.verified ? "Verified" : "Needs check";
        const signals = [status, ...item.tags.filter((tag) => tag !== "Verified").slice(0, 3)];
        return `
          <article class="university-card result-enter" style="--enter-index: ${index}" data-name="${item.name}">
            <div class="card-image">
              <span class="badge">${status}</span>
              <button class="save ${saved ? "saved" : ""}" type="button" data-save="${item.name}" aria-label="Save ${item.name}">${saved ? "♥" : "♡"}</button>
              <img alt="${item.name} campus or city context" src="${item.image}" />
            </div>
            <div class="card-body">
              <h2>${item.name}</h2>
              <div class="location">${item.city}, ${item.province}</div>
              <div class="signals">${signals.map((signal) => `<span class="signal">${signal}</span>`).join("")}</div>
              <p class="note">${item.note}</p>
              <div class="facts">
                <div class="mini-fact"><strong>${item.programs}</strong><span>programs</span></div>
                <div class="mini-fact"><strong>${item.tuition}</strong><span>tuition from</span></div>
                <div class="mini-fact"><strong>${item.routes}</strong><span>routes</span></div>
              </div>
              <div class="card-actions">
                <a href="programs.html?university=${encodeURIComponent(item.name)}">View programs</a>
                <button type="button">Compare</button>
              </div>
            </div>
          </article>
        `;
      }

      function renderActiveFilters() {
        const filters = [...state.filters];
        activeFilters.innerHTML = filters
          .map((filter) => `<span class="active-pill">${filter}<button type="button" data-remove="${filter}" aria-label="Remove ${filter}">x</button></span>`)
          .join("");
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
        resultContext.textContent = state.query || state.filters.size
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
      }

      function showUniversityAgentNotice(message) {
        let notice = document.querySelector("[data-university-agent-notice]");
        if (!notice) {
          notice = document.createElement("div");
          notice.className = "university-agent-notice";
          notice.dataset.universityAgentNotice = "";
          document.querySelector(".result-copy")?.appendChild(notice);
        }
        notice.textContent = message;
        notice.classList.add("visible");
      }

      function captureUniversityState() {
        return {
          query: state.query,
          filters: Array.from(state.filters),
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
          state.filters = new Set(["Verified", "English routes", "Affordable"]);
          state.sort = "cityCost";
          state.page = 1;
          render();
          showUniversityAgentNotice("Agent filtered for verified, English-route, lower-cost universities.");
          document.querySelector(".results")?.scrollIntoView({ behavior: "smooth", block: "start" });
          detail.setUndo?.(before);
          return true;
        }
        if (action === "save-program-shortlist" || action === "compare-routes") {
          ["Zhejiang University", "Nanjing University", "Fudan University"].forEach((name) => state.saved.add(name));
          state.view = "grid";
          render();
          showUniversityAgentNotice("Agent saved three universities for route comparison.");
          detail.setUndo?.(before);
          return true;
        }
        if (action === "open-choice-modal") {
          window.location.href = "application.html";
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
        state.filters.delete(value);
        state.page = 1;
        render();
      });

      resultsGrid.addEventListener("click", (event) => {
        const name = event.target.dataset.save;
        if (!name) return;
        if (state.saved.has(name)) state.saved.delete(name);
        else state.saved.add(name);
        render();
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

      render();
