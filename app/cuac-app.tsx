"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ApplicationChoice,
  type ApplicationBlocker,
  type ApplicationPacket,
  type ApplicationSectionKey,
  type DeadlineStatus,
  type DocumentStatus,
  type Program,
  type SectionStatus,
  cities,
  cityFor,
  formatMoney,
  initialDocuments,
  initialMessages,
  initialPacket,
  labelDegree,
  labelLanguage,
  programs,
  profile,
  requirementFor,
  scholarshipsFor,
  universityFor,
} from "./data";

type View = "home" | "programs" | "program-detail" | "hub" | "application";

type AppState = {
  savedProgramIds: string[];
  compareProgramIds: string[];
  choices: ApplicationChoice[];
  documents: typeof initialDocuments;
  packet: ApplicationPacket;
  messages: typeof initialMessages;
  activeSection: ApplicationSectionKey;
  toast?: string;
  stateVersion: number;
  updatedAt: string;
};

type Filters = {
  q: string;
  degreeLevel: string;
  teachingLanguage: string;
  cityId: string;
  scholarshipAvailable: boolean;
  deadlineStatus: string;
  documentBurden: string;
  lateIntakeAvailable: boolean;
};

const STORAGE_KEY = "cuac_frontend_state_v1";

const initialState: AppState = {
  savedProgramIds: ["tongji-civil-msc"],
  compareProgramIds: [],
  choices: [],
  documents: initialDocuments,
  packet: initialPacket,
  messages: initialMessages,
  activeSection: "documents",
  stateVersion: 1,
  updatedAt: new Date().toISOString(),
};

const defaultFilters: Filters = {
  q: "",
  degreeLevel: "",
  teachingLanguage: "",
  cityId: "",
  scholarshipAvailable: false,
  deadlineStatus: "",
  documentBurden: "",
  lateIntakeAvailable: false,
};

const sections: Array<{ key: ApplicationSectionKey; label: string }> = [
  { key: "personal", label: "Personal" },
  { key: "passport", label: "Passport" },
  { key: "education", label: "Education" },
  { key: "language_tests", label: "Language tests" },
  { key: "choices", label: "Choices" },
  { key: "documents", label: "Documents" },
  { key: "study_plan", label: "Study plan" },
  { key: "recommendation", label: "Recommendation" },
  { key: "scholarship", label: "Scholarship" },
  { key: "review", label: "Review" },
];

function readStoredState(): AppState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw) };
  } catch {
    return initialState;
  }
}

function getViewFromPath(pathname: string): { view: View; programId?: string } {
  if (pathname.startsWith("/hub/applications")) return { view: "application" };
  if (pathname === "/hub") return { view: "hub" };
  if (pathname.startsWith("/programs/")) {
    return { view: "program-detail", programId: pathname.split("/").filter(Boolean)[1] };
  }
  if (pathname === "/programs") return { view: "programs" };
  return { view: "home" };
}

function buildFiltersFromSearch(search: string): Filters {
  const params = new URLSearchParams(search);
  return {
    ...defaultFilters,
    q: params.get("q") ?? "",
    degreeLevel: params.get("degreeLevel") ?? "",
    teachingLanguage: params.get("teachingLanguage") ?? "",
    cityId: params.get("cityId") ?? "",
    scholarshipAvailable: params.get("scholarshipAvailable") === "true",
    deadlineStatus: params.get("deadlineStatus") ?? "",
    documentBurden: params.get("documentBurden") ?? "",
    lateIntakeAvailable: params.get("lateIntakeAvailable") === "true",
  };
}

function filtersToSearch(filters: Filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      if (value) params.set(key, "true");
      return;
    }
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function isDocumentMissing(status: DocumentStatus) {
  return status === "missing" || status === "rejected" || status === "expired";
}

function getChoiceBlockers(program: Program, state: AppState) {
  const missing = program.documentRequirementIds
    .map((id) => state.documents.find((doc) => doc.requirementId === id))
    .filter((doc) => !doc || isDocumentMissing(doc.status));
  const blockers: ApplicationBlocker[] = missing.slice(0, 3).map((doc, index) => {
    const requirement = requirementFor(doc?.requirementId ?? program.documentRequirementIds[index]);
    return {
      id: `${program.id}-${requirement.id}`,
      type: "document" as const,
      label: `${requirement.label} missing`,
      actionLabel: "Prepare document",
      targetRoute: "/hub/applications/packet-2026?section=documents",
      severity: "hard" as const,
    };
  });
  if (program.deadlineStatus === "closed") {
    blockers.unshift({
      id: `${program.id}-closed`,
      type: "deadline",
      label: "Application deadline is closed",
      actionLabel: "Find late alternatives",
      targetRoute: "/programs?lateIntakeAvailable=true",
      severity: "hard",
    });
  }
  return blockers;
}

function getReadiness(program: Program, state: AppState) {
  if (program.deadlineStatus === "closed") return "blocked";
  const blockers = getChoiceBlockers(program, state).length;
  if (blockers === 0 && program.sourceStatus === "verified") return "strong_match";
  if (blockers <= 1) return "likely_eligible";
  return "needs_review";
}

function readinessLabel(value: string) {
  const labels: Record<string, string> = {
    strong_match: "Strong match",
    likely_eligible: "Likely eligible",
    needs_review: "Needs review",
    blocked: "Blocked",
  };
  return labels[value] ?? "Needs review";
}

function badgeClass(status: DeadlineStatus | string) {
  if (status === "urgent" || status === "closed") return "badge danger";
  if (status === "closes_soon") return "badge warning";
  if (status === "late_intake") return "badge success";
  return "badge";
}

function sourceLabel(status: string, date?: string) {
  if (status === "verified") return `Verified${date ? ` ${date}` : ""}`;
  if (status === "stale") return "Needs recheck";
  return "Source pending";
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function nextAction(state: AppState) {
  if (state.choices.length === 0) {
    return {
      label: "Add a program to choices",
      body: "Start with one realistic program, then compare deadlines and document effort.",
      action: "Search programs",
      href: "/programs",
    };
  }
  const missingDocuments = selectedMissingDocuments(state);
  if (missingDocuments.length > 0) {
    return {
      label: "Prepare required documents",
      body: `${missingDocuments.length} required document${missingDocuments.length > 1 ? "s are" : " is"} still missing for your choices.`,
      action: "Open documents",
      href: "/hub/applications/packet-2026?section=documents",
    };
  }
  if (!state.packet.adviserReviewRequested) {
    return {
      label: "Request adviser review",
      body: "Your packet is close enough for a counsellor-style readiness review.",
      action: "Review packet",
      href: "/hub/applications/packet-2026?section=review",
    };
  }
  return {
    label: "Wait for adviser feedback",
    body: "Your application packet is marked ready for adviser review.",
    action: "Open application",
    href: "/hub/applications/packet-2026",
  };
}

function selectedMissingDocuments(state: AppState) {
  const selectedProgramIds = new Set(state.choices.map((choice) => choice.programId));
  const requirementIds = new Set(
    programs
      .filter((program) => selectedProgramIds.has(program.id))
      .flatMap((program) => program.documentRequirementIds),
  );
  return state.documents.filter(
    (doc) => requirementIds.has(doc.requirementId) && isDocumentMissing(doc.status),
  );
}

function initialFilterFromView(initialView: View) {
  if (typeof window !== "undefined") return buildFiltersFromSearch(window.location.search);
  if (initialView === "programs") return { ...defaultFilters, q: "English-taught computer science master" };
  return defaultFilters;
}

export function CuacApp({
  initialView = "home",
  initialProgramId,
}: {
  initialView?: View;
  initialProgramId?: string;
}) {
  const [state, setState] = useState<AppState>(initialState);
  const [route, setRoute] = useState<{ view: View; programId?: string }>(() => ({
    view: initialView,
    programId: initialProgramId,
  }));
  const [filters, setFilters] = useState(() => initialFilterFromView(initialView));
  const [isSearchPending, setSearchPending] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"filters" | "compare" | "adviser" | "sections" | null>(null);
  const [savingStatus, setSavingStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = readStoredState();
      setState(stored);
      const current = getViewFromPath(window.location.pathname);
      setRoute(current);
      setFilters(buildFiltersFromSearch(window.location.search));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  useEffect(() => {
    const onPop = () => {
      setRoute(getViewFromPath(window.location.pathname));
      setFilters(buildFiltersFromSearch(window.location.search));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSearchPending(true));
    const handle = window.setTimeout(() => setSearchPending(false), 260);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(handle);
    };
  }, [filters]);

  function patchState(patch: Partial<AppState>) {
    setState((current) => ({
      ...current,
      ...patch,
      stateVersion: current.stateVersion + 1,
      updatedAt: new Date().toISOString(),
    }));
  }

  function showToast(message: string) {
    patchState({ toast: message });
    window.setTimeout(() => {
      setState((current) => ({ ...current, toast: undefined }));
    }, 1800);
  }

  function navigate(href: string) {
    const url = new URL(href, window.location.origin);
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
    setRoute(getViewFromPath(url.pathname));
    setFilters(buildFiltersFromSearch(url.search));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    const href = `/programs${filtersToSearch(next)}`;
    window.history.replaceState({}, "", href);
    setRoute({ view: "programs", programId: undefined });
  }

  function toggleSave(programId: string) {
    const exists = state.savedProgramIds.includes(programId);
    patchState({
      savedProgramIds: exists
        ? state.savedProgramIds.filter((id) => id !== programId)
        : [...state.savedProgramIds, programId],
    });
    showToast(exists ? "Removed from saved programs" : "Program saved");
  }

  function toggleCompare(programId: string) {
    const exists = state.compareProgramIds.includes(programId);
    if (exists) {
      patchState({ compareProgramIds: state.compareProgramIds.filter((id) => id !== programId) });
      return;
    }
    if (state.compareProgramIds.length >= 3) {
      showToast("Compare is limited to 3 programs");
      return;
    }
    patchState({ compareProgramIds: [...state.compareProgramIds, programId] });
  }

  function addChoice(programId: string) {
    if (state.choices.some((choice) => choice.programId === programId)) {
      navigate("/hub");
      return;
    }
    const program = programs.find((item) => item.id === programId);
    if (!program || program.deadlineStatus === "closed") {
      showToast("This program is closed. Try late alternatives.");
      return;
    }
    const choice: ApplicationChoice = {
      id: `choice-${programId}`,
      programId,
      addedAt: new Date().toISOString(),
      status: getChoiceBlockers(program, state).length ? "documents_missing" : "draft",
      blockers: getChoiceBlockers(program, state),
    };
    patchState({
      choices: [...state.choices, choice],
      packet: {
        ...state.packet,
        choiceIds: [...state.packet.choiceIds, choice.id],
        status: "documents_missing",
        sectionStatuses: {
          ...state.packet.sectionStatuses,
          choices: "ready",
          documents: "needs_attention",
        },
      },
    });
    showToast("Added to application choices");
  }

  function markMessageRead(id: string) {
    patchState({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, read: true } : message,
      ),
    });
  }

  function uploadDocument(documentId: string) {
    const current = state.documents.find((doc) => doc.id === documentId);
    if (!current || current.status === "uploading") return;
    patchState({
      documents: state.documents.map((doc) =>
        doc.id === documentId ? { ...doc, status: "uploading" } : doc,
      ),
    });
    window.setTimeout(() => {
      setState((latest) => {
        const documents = latest.documents.map((doc) =>
          doc.id === documentId
            ? {
                ...doc,
                status: "uploaded" as const,
                fileName: `${requirementFor(doc.requirementId).type}-preview.pdf`,
                uploadedAt: new Date().toISOString(),
              }
            : doc,
        );
        return {
          ...latest,
          documents,
          toast: "Document uploaded",
          stateVersion: latest.stateVersion + 1,
          updatedAt: new Date().toISOString(),
        };
      });
    }, 900);
  }

  function markSectionReady(section: ApplicationSectionKey) {
    setSavingStatus("saving");
    window.setTimeout(() => {
      setSavingStatus("saved");
      patchState({
        activeSection: section,
        packet: {
          ...state.packet,
          sectionStatuses: {
            ...state.packet.sectionStatuses,
            [section]: "ready",
          },
        },
      });
      showToast(`${sections.find((item) => item.key === section)?.label} marked ready`);
    }, 420);
  }

  function requestReview() {
    const missing = selectedMissingDocuments(state);
    if (missing.length > 0) {
      showToast("Resolve hard blockers before adviser review");
      return;
    }
    patchState({
      packet: {
        ...state.packet,
        status: "ready_for_review",
        adviserReviewRequested: true,
        sectionStatuses: Object.fromEntries(
          Object.entries(state.packet.sectionStatuses).map(([key, value]) => [
            key,
            value === "ready" ? "submitted" : value,
          ]),
        ) as ApplicationPacket["sectionStatuses"],
      },
      messages: [
        {
          id: `msg-review-${Date.now()}`,
          type: "adviser",
          title: "Ready for adviser review",
          body: "Your application packet is queued for adviser review.",
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...state.messages,
      ],
    });
    showToast("Application packet ready for adviser review");
    navigate("/hub");
  }

  const filteredPrograms = useMemo(() => {
    const q = filters.q.toLowerCase().trim();
    return programs.filter((program) => {
      const university = universityFor(program);
      const city = cityFor(program);
      if (
        q &&
        ![
          program.name,
          program.subjectArea,
          university.name,
          city.name,
          labelDegree(program.degreeLevel),
          labelLanguage(program.teachingLanguage),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      if (filters.degreeLevel && program.degreeLevel !== filters.degreeLevel) return false;
      if (filters.teachingLanguage && program.teachingLanguage !== filters.teachingLanguage) return false;
      if (filters.cityId && program.cityId !== filters.cityId) return false;
      if (filters.scholarshipAvailable && !program.scholarshipAvailable) return false;
      if (filters.deadlineStatus && program.deadlineStatus !== filters.deadlineStatus) return false;
      if (filters.documentBurden && program.documentBurden !== filters.documentBurden) return false;
      if (filters.lateIntakeAvailable && !program.lateIntakeAvailable) return false;
      return true;
    });
  }, [filters]);

  const activeProgram =
    programs.find((item) => item.id === route.programId) ?? programs.find((item) => item.id === "zju-cs-msc")!;
  const action = nextAction(state);
  const deadlineCount = programs.filter((program) =>
    ["urgent", "closes_soon"].includes(program.deadlineStatus)
  ).length;

  return (
    <div className="cuac-shell">
      <header className="top-nav">
        <button className="brand" onClick={() => navigate("/")}>
          <span className="brand-mark">CU</span>
          <span>CUAC</span>
        </button>
        <nav aria-label="Primary navigation">
          <button onClick={() => navigate("/programs")}>Find Programs</button>
          <button onClick={() => navigate("/programs?scholarshipAvailable=true")}>Scholarships</button>
          <button onClick={() => navigate("/programs?lateIntakeAvailable=true")}>Late Intake</button>
        </nav>
        <button className="mobile-menu" onClick={() => setMobilePanel("filters")}>Menu</button>
      </header>

      <button className="deadline-strip" onClick={() => navigate("/programs?deadlineStatus=closes_soon")}>
        <strong>Fall 2026 cycle</strong>
        <span>{deadlineCount} deadlines need attention. Review documents before intake windows move.</span>
      </button>

      {route.view === "home" && (
        <HomeView
          onSearch={(q) => navigate(`/programs${filtersToSearch({ ...defaultFilters, q })}`)}
          onQuickFilter={(patch) => navigate(`/programs${filtersToSearch({ ...defaultFilters, ...patch })}`)}
          onNavigate={navigate}
          action={action}
        />
      )}

      {route.view === "programs" && (
        <ProgramsView
          state={state}
          filters={filters}
          filteredPrograms={filteredPrograms}
          isPending={isSearchPending}
          onFilter={updateFilters}
          onNavigate={navigate}
          onSave={toggleSave}
          onCompare={toggleCompare}
          onAddChoice={addChoice}
          onOpenFilters={() => setMobilePanel("filters")}
          onOpenCompare={() => setMobilePanel("compare")}
        />
      )}

      {route.view === "program-detail" && (
        <ProgramDetailView
          state={state}
          program={activeProgram}
          onNavigate={navigate}
          onSave={toggleSave}
          onCompare={toggleCompare}
          onAddChoice={addChoice}
        />
      )}

      {route.view === "hub" && (
        <HubView
          state={state}
          onNavigate={navigate}
          onRead={markMessageRead}
          onOpenAdviser={() => setMobilePanel("adviser")}
        />
      )}

      {route.view === "application" && (
        <ApplicationView
          state={state}
          savingStatus={savingStatus}
          onNavigate={navigate}
          onSection={(section) => patchState({ activeSection: section })}
          onUpload={uploadDocument}
          onMarkReady={markSectionReady}
          onRequestReview={requestReview}
          onOpenSections={() => setMobilePanel("sections")}
        />
      )}

      {state.toast && (
        <div className="toast" role="status" aria-live="polite">
          {state.toast}
        </div>
      )}

      {mobilePanel && (
        <Panel title={panelTitle(mobilePanel)} onClose={() => setMobilePanel(null)}>
          {mobilePanel === "filters" && (
            <FilterFields filters={filters} onFilter={updateFilters} compact />
          )}
          {mobilePanel === "compare" && (
            <CompareContent
              ids={state.compareProgramIds}
              state={state}
              onNavigate={navigate}
              onCompare={toggleCompare}
              onAddChoice={addChoice}
            />
          )}
          {mobilePanel === "adviser" && <AdviserPanel />}
          {mobilePanel === "sections" && (
            <SectionList
              state={state}
              onSection={(section) => {
                patchState({ activeSection: section });
                setMobilePanel(null);
              }}
            />
          )}
        </Panel>
      )}
    </div>
  );
}

function panelTitle(panel: string) {
  if (panel === "filters") return "Filters";
  if (panel === "compare") return "Compare programs";
  if (panel === "adviser") return "Adviser access";
  return "Application sections";
}

function HomeView({
  action,
  onSearch,
  onQuickFilter,
  onNavigate,
}: {
  action: ReturnType<typeof nextAction>;
  onSearch: (q: string) => void;
  onQuickFilter: (patch: Partial<Filters>) => void;
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState("English-taught computer science master");
  const featured = programs.slice(0, 3);
  const closeSoonCount = programs.filter((program) => ["urgent", "closes_soon"].includes(program.deadlineStatus)).length;
  const scholarshipCount = programs.filter((program) => program.scholarshipAvailable).length;
  return (
    <main>
      <section className="home-hero">
        <div className="hero-left">
          <div className="hero-copy">
            <p className="eyebrow">For students applying to China</p>
            <h1>Plan your China university application without guessing.</h1>
            <p>
              Match programs, compare funding, check deadline risk, and prepare a
              review-ready application packet in one focused workspace.
            </p>
          </div>
          <form
            className="hero-search"
            onSubmit={(event) => {
              event.preventDefault();
              if (!query.trim()) return;
              onSearch(query);
            }}
          >
            <label htmlFor="home-search">What do you want to study?</label>
            <div>
              <input
                id="home-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Computer science, business, MBBS..."
              />
              <button type="submit">Search programs</button>
            </div>
          </form>
          <div className="quick-filters" aria-label="Quick filters">
            <button onClick={() => onQuickFilter({ degreeLevel: "undergraduate" })}>Undergraduate</button>
            <button onClick={() => onQuickFilter({ degreeLevel: "master" })}>Master</button>
            <button onClick={() => onQuickFilter({ teachingLanguage: "english" })}>English-taught</button>
            <button onClick={() => onQuickFilter({ scholarshipAvailable: true })}>Scholarship</button>
            <button onClick={() => onQuickFilter({ lateIntakeAvailable: true })}>Late intake</button>
          </div>
          <button className="next-action hero-action" onClick={() => onNavigate(action.href)}>
            <span>Continue in Hub</span>
            <strong>{action.label}</strong>
            <small>{action.body}</small>
          </button>
        </div>
        <aside className="hero-dashboard" aria-label="Application preview">
          <div className="dashboard-top">
            <span>Application radar</span>
            <strong>Fall 2026 plan</strong>
          </div>
          <div className="radar-card primary-radar">
            <div>
              <span>Next deadline</span>
              <strong>Oct 15</strong>
            </div>
            <p>Zhejiang University · Computer Science MSc</p>
          </div>
          <div className="dashboard-metrics">
            <div>
              <strong>{closeSoonCount}</strong>
              <span>close soon</span>
            </div>
            <div>
              <strong>{scholarshipCount}</strong>
              <span>with funding</span>
            </div>
            <div>
              <strong>68%</strong>
              <span>profile ready</span>
            </div>
          </div>
          <div className="radar-list">
            <div><span className="dot ok" /> Passport accepted</div>
            <div><span className="dot warn" /> IELTS certificate missing</div>
            <div><span className="dot danger" /> Transcript translation needed</div>
          </div>
        </aside>
      </section>

      <section className="home-section-head">
        <p className="eyebrow">Start from what matters</p>
        <h2>Programs, funding, cities, and documents in one scan.</h2>
      </section>

      <section className="home-grid featured-grid">
        <ContentBand title="Open programs" action="View all" onAction={() => onNavigate("/programs")}>
          {featured.map((program) => (
            <MiniProgram key={program.id} program={program} onNavigate={onNavigate} />
          ))}
        </ContentBand>
        <ContentBand
          title="Scholarship openings"
          action="Scholarship filter"
          onAction={() => onNavigate("/programs?scholarshipAvailable=true")}
        >
          {programs
            .filter((program) => program.scholarshipAvailable)
            .slice(0, 3)
            .map((program) => (
              <MiniProgram key={program.id} program={program} onNavigate={onNavigate} />
            ))}
        </ContentBand>
        <ContentBand title="China city fit" action="Explore cities" onAction={() => onNavigate("/programs")}>
          {cities.slice(0, 3).map((city) => (
            <article className="mini-card city-mini" key={city.id}>
              <div>
                <strong>{city.name}</strong>
                <span>{city.province}</span>
              </div>
              <b>{formatMoney(city.monthlyCostRmb)}</b>
              <p>{city.studentLifeSummary}</p>
            </article>
          ))}
        </ContentBand>
      </section>

      <section className="process-band">
        {["Search", "Prepare", "Review", "Track"].map((step, index) => (
          <article key={step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
            <p>{processText(step)}</p>
          </article>
        ))}
      </section>

      <section className="trust-band">
        <div>
          <p className="eyebrow">Source-aware by design</p>
          <h2>Every major decision keeps its evidence nearby.</h2>
        </div>
        <p>
          Requirements, deadlines, scholarships, and readiness hints show source status so students
          know when to act and when to verify.
        </p>
      </section>
    </main>
  );
}

function processText(step: string) {
  const copy: Record<string, string> = {
    Search: "Find programs by fit, language, scholarship, and deadline.",
    Prepare: "See exactly which profile fields and documents are missing.",
    Review: "Ask an adviser to review the packet before submission.",
    Track: "Follow status changes, deadline risk, and next actions.",
  };
  return copy[step];
}

function ProgramsView({
  state,
  filters,
  filteredPrograms,
  isPending,
  onFilter,
  onNavigate,
  onSave,
  onCompare,
  onAddChoice,
  onOpenFilters,
  onOpenCompare,
}: {
  state: AppState;
  filters: Filters;
  filteredPrograms: Program[];
  isPending: boolean;
  onFilter: (patch: Partial<Filters>) => void;
  onNavigate: (href: string) => void;
  onSave: (programId: string) => void;
  onCompare: (programId: string) => void;
  onAddChoice: (programId: string) => void;
  onOpenFilters: () => void;
  onOpenCompare: () => void;
}) {
  return (
    <main className="workbench">
      <section className="search-header">
        <div>
          <p className="eyebrow">Program Search</p>
          <h1>Compare programs by deadline, documents, and fit</h1>
        </div>
        <label className="search-box">
          <span>Search</span>
          <input
            value={filters.q}
            onChange={(event) => onFilter({ q: event.target.value })}
            placeholder="Computer science, business, English-taught..."
          />
        </label>
        <button className="filter-mobile" onClick={onOpenFilters}>Filters</button>
      </section>

      <div className="workbench-grid">
        <aside className="filter-rail">
          <FilterFields filters={filters} onFilter={onFilter} />
        </aside>
        <section className="results-pane">
          <div className="results-head">
            <div>
              <strong>{isPending ? "Updating results" : `${filteredPrograms.length} programs`}</strong>
              <span>{activeFilterSummary(filters) || "Open programs with source-aware details"}</span>
            </div>
            <button
              className="quiet"
              onClick={() =>
                onFilter({
                  documentBurden: "",
                  scholarshipAvailable: false,
                  deadlineStatus: "",
                  cityId: "",
                })
              }
            >
              Relax filters
            </button>
          </div>
          <ActiveChips filters={filters} onFilter={onFilter} />
          {filteredPrograms.length === 0 ? (
            <section className="empty-state">
              <strong>No matching programs yet</strong>
              <p>Try removing document burden, scholarship, deadline, or city filters.</p>
              <button onClick={() => onFilter(defaultFilters)}>Clear all</button>
            </section>
          ) : (
            <div className="program-list">
              {filteredPrograms.map((program) => (
                <ProgramRow
                  key={program.id}
                  state={state}
                  program={program}
                  onNavigate={onNavigate}
                  onSave={onSave}
                  onCompare={onCompare}
                  onAddChoice={onAddChoice}
                />
              ))}
            </div>
          )}
        </section>
        <aside className="compare-rail">
          <CompareContent
            ids={state.compareProgramIds}
            state={state}
            onNavigate={onNavigate}
            onCompare={onCompare}
            onAddChoice={onAddChoice}
          />
        </aside>
      </div>
      {state.compareProgramIds.length > 0 && (
        <button className="mobile-compare" onClick={onOpenCompare}>
          Compare {state.compareProgramIds.length} program{state.compareProgramIds.length > 1 ? "s" : ""}
        </button>
      )}
    </main>
  );
}

function FilterFields({
  filters,
  onFilter,
  compact,
}: {
  filters: Filters;
  onFilter: (patch: Partial<Filters>) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "filters compact" : "filters"}>
      <label>
        <span>Degree level</span>
        <select value={filters.degreeLevel} onChange={(event) => onFilter({ degreeLevel: event.target.value })}>
          <option value="">All levels</option>
          <option value="undergraduate">Undergraduate</option>
          <option value="master">Master</option>
          <option value="phd">PhD</option>
          <option value="non_degree">Non-degree</option>
        </select>
      </label>
      <label>
        <span>Teaching language</span>
        <select
          value={filters.teachingLanguage}
          onChange={(event) => onFilter({ teachingLanguage: event.target.value })}
        >
          <option value="">Any language</option>
          <option value="english">English-taught</option>
          <option value="chinese">Chinese-taught</option>
          <option value="bilingual">Bilingual</option>
        </select>
      </label>
      <label>
        <span>City</span>
        <select value={filters.cityId} onChange={(event) => onFilter({ cityId: event.target.value })}>
          <option value="">Any city</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Deadline</span>
        <select
          value={filters.deadlineStatus}
          onChange={(event) => onFilter({ deadlineStatus: event.target.value })}
        >
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="closes_soon">Closes soon</option>
          <option value="urgent">Urgent</option>
          <option value="late_intake">Late intake</option>
        </select>
      </label>
      <label>
        <span>Document burden</span>
        <select
          value={filters.documentBurden}
          onChange={(event) => onFilter({ documentBurden: event.target.value })}
        >
          <option value="">Any burden</option>
          <option value="light">Light</option>
          <option value="medium">Medium</option>
          <option value="heavy">Heavy</option>
        </select>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={filters.scholarshipAvailable}
          onChange={(event) => onFilter({ scholarshipAvailable: event.target.checked })}
        />
        <span>Scholarship available</span>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={filters.lateIntakeAvailable}
          onChange={(event) => onFilter({ lateIntakeAvailable: event.target.checked })}
        />
        <span>Late intake</span>
      </label>
    </div>
  );
}

function ActiveChips({ filters, onFilter }: { filters: Filters; onFilter: (patch: Partial<Filters>) => void }) {
  const chips = [
    filters.q && { label: `Search: ${filters.q}`, patch: { q: "" } },
    filters.degreeLevel && { label: labelDegree(filters.degreeLevel as never), patch: { degreeLevel: "" } },
    filters.teachingLanguage && {
      label: labelLanguage(filters.teachingLanguage as never),
      patch: { teachingLanguage: "" },
    },
    filters.cityId && {
      label: cities.find((city) => city.id === filters.cityId)?.name ?? filters.cityId,
      patch: { cityId: "" },
    },
    filters.scholarshipAvailable && { label: "Scholarship", patch: { scholarshipAvailable: false } },
    filters.lateIntakeAvailable && { label: "Late intake", patch: { lateIntakeAvailable: false } },
  ].filter(Boolean) as Array<{ label: string; patch: Partial<Filters> }>;
  if (!chips.length) return null;
  return (
    <div className="chip-row">
      {chips.map((chip) => (
        <button key={chip.label} onClick={() => onFilter(chip.patch)}>
          {chip.label}
          <span>Remove</span>
        </button>
      ))}
    </div>
  );
}

function activeFilterSummary(filters: Filters) {
  return [
    filters.degreeLevel && labelDegree(filters.degreeLevel as never),
    filters.teachingLanguage && labelLanguage(filters.teachingLanguage as never),
    filters.scholarshipAvailable && "Scholarship available",
    filters.deadlineStatus && statusLabel(filters.deadlineStatus),
    filters.lateIntakeAvailable && "Late intake",
  ]
    .filter(Boolean)
    .join(" / ");
}

function ProgramRow({
  state,
  program,
  onNavigate,
  onSave,
  onCompare,
  onAddChoice,
}: {
  state: AppState;
  program: Program;
  onNavigate: (href: string) => void;
  onSave: (programId: string) => void;
  onCompare: (programId: string) => void;
  onAddChoice: (programId: string) => void;
}) {
  const university = universityFor(program);
  const city = cityFor(program);
  const readiness = getReadiness(program, state);
  const isInChoices = state.choices.some((choice) => choice.programId === program.id);
  const isSaved = state.savedProgramIds.includes(program.id);
  const isCompared = state.compareProgramIds.includes(program.id);
  return (
    <div
      className="program-row"
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(`/programs/${program.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onNavigate(`/programs/${program.id}`);
        }
      }}
    >
      <div className="row-main">
        <div className="row-title">
          <span className={badgeClass(program.deadlineStatus)}>{deadlineText(program)}</span>
          <h2>{program.name}</h2>
          <p>{university.name} · {city.name} · {labelDegree(program.degreeLevel)} · {labelLanguage(program.teachingLanguage)}</p>
        </div>
        <div className="row-facts">
          <span>{program.intake}</span>
          <span>{formatMoney(program.tuitionRmb)}/{program.tuitionPeriod}</span>
          <span>{program.scholarshipAvailable ? "Scholarship available" : "No scholarship listed"}</span>
          <span>{program.documentRequirementIds.length} documents</span>
        </div>
        <div className="row-chips">
          {program.englishRequirement && <span>{program.englishRequirement}</span>}
          {program.hskRequirement && <span>{program.hskRequirement}</span>}
          <span>{readinessLabel(readiness)}</span>
          <span className={program.sourceStatus === "verified" ? "source-ok" : "source-warn"}>
            {sourceLabel(program.sourceStatus, program.lastVerifiedAt)}
          </span>
        </div>
      </div>
      <div className="row-actions">
        <button onClick={(event) => { event.stopPropagation(); onSave(program.id); }}>
          {isSaved ? "Saved" : "Save"}
        </button>
        <button onClick={(event) => { event.stopPropagation(); onCompare(program.id); }}>
          {isCompared ? "Compared" : "Compare"}
        </button>
        <button
          className="primary"
          disabled={program.deadlineStatus === "closed"}
          onClick={(event) => { event.stopPropagation(); onAddChoice(program.id); }}
        >
          {isInChoices ? "In choices" : program.deadlineStatus === "closed" ? "Closed" : "Add to choices"}
        </button>
      </div>
    </div>
  );
}

function deadlineText(program: Program) {
  if (program.deadlineStatus === "late_intake") return `Late intake until ${formatShortDate(program.deadlineDate)}`;
  if (program.deadlineStatus === "closed") return "Closed";
  if (program.deadlineStatus === "urgent") return `Urgent: ${formatShortDate(program.deadlineDate)}`;
  if (program.deadlineStatus === "closes_soon") return `Closes ${formatShortDate(program.deadlineDate)}`;
  return `Open until ${formatShortDate(program.deadlineDate)}`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function ProgramDetailView({
  state,
  program,
  onNavigate,
  onSave,
  onCompare,
  onAddChoice,
}: {
  state: AppState;
  program: Program;
  onNavigate: (href: string) => void;
  onSave: (programId: string) => void;
  onCompare: (programId: string) => void;
  onAddChoice: (programId: string) => void;
}) {
  const university = universityFor(program);
  const city = cityFor(program);
  const requirements = program.documentRequirementIds.map(requirementFor);
  const blockers = getChoiceBlockers(program, state);
  const readiness = getReadiness(program, state);
  const isInChoices = state.choices.some((choice) => choice.programId === program.id);
  return (
    <main className="detail-page">
      <button className="back-button" onClick={() => onNavigate("/programs")}>Back to results</button>
      <section className="detail-grid">
        <div className="detail-main">
          <div className="detail-header">
            <span className={badgeClass(program.deadlineStatus)}>{deadlineText(program)}</span>
            <h1>{program.name}</h1>
            <p>{university.name} · {city.name}, {city.province}</p>
            <div className="key-facts">
              <span>{labelDegree(program.degreeLevel)}</span>
              <span>{labelLanguage(program.teachingLanguage)}</span>
              <span>{program.intake}</span>
              <span>{formatMoney(program.tuitionRmb)}/{program.tuitionPeriod}</span>
            </div>
          </div>

          <InfoSection title="Eligibility">
            <p>{program.summary}</p>
            <div className="row-chips">
              {program.fitTags.map((tag) => <span key={tag}>{tag}</span>)}
              {program.englishRequirement && <span>{program.englishRequirement}</span>}
              {program.hskRequirement && <span>{program.hskRequirement}</span>}
            </div>
          </InfoSection>

          <InfoSection title="Required documents">
            <div className="document-list">
              {requirements.map((requirement) => {
                const doc = state.documents.find((item) => item.requirementId === requirement.id);
                return (
                  <article key={requirement.id}>
                    <div>
                      <strong>{requirement.label}</strong>
                      <p>{requirement.description}</p>
                    </div>
                    <button onClick={() => onNavigate("/hub/applications/packet-2026?section=documents")}>
                      {doc && !isDocumentMissing(doc.status) ? statusLabel(doc.status) : "Prepare"}
                    </button>
                  </article>
                );
              })}
            </div>
          </InfoSection>

          <InfoSection title="Tuition and scholarships">
            <p>{formatMoney(program.tuitionRmb)} per {program.tuitionPeriod}. Scholarship matches are shown from verified and public sources.</p>
            <div className="mini-grid">
              {scholarshipsFor(program).map((scholarship) => (
                <article className="mini-card" key={scholarship.id}>
                  <strong>{scholarship.name}</strong>
                  <span>{scholarship.amountText}</span>
                  <p>{scholarship.deadlineDate ? deadlineText({ ...program, deadlineDate: scholarship.deadlineDate, deadlineStatus: scholarship.deadlineStatus ?? "open" }) : "Deadline by provider source"}</p>
                </article>
              ))}
            </div>
          </InfoSection>

          <InfoSection title="Source and verification">
            <p>{sourceLabel(program.sourceStatus, program.lastVerifiedAt)}. CUAC does not guarantee admission and does not replace official university portals.</p>
            {program.sourceUrl && <a href={program.sourceUrl} target="_blank" rel="noreferrer">Open source page</a>}
          </InfoSection>
        </div>

        <aside className="readiness-panel">
          <p className="eyebrow">Readiness</p>
          <strong>{readinessLabel(readiness)}</strong>
          <p>Based on your preview profile and this program&apos;s listed requirements.</p>
          <div className="meter" aria-label={`Readiness ${readinessLabel(readiness)}`}>
            <span style={{ width: readiness === "strong_match" ? "92%" : readiness === "likely_eligible" ? "74%" : readiness === "blocked" ? "18%" : "52%" }} />
          </div>
          {blockers.length > 0 ? (
            <div className="blocker-list">
              {blockers.map((blocker) => (
                <button key={blocker.id} onClick={() => onNavigate(blocker.targetRoute)}>
                  <span>{blocker.label}</span>
                  <strong>{blocker.actionLabel}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="ready-copy">No hard blockers from current preview data.</p>
          )}
          <div className="panel-actions">
            <button onClick={() => onSave(program.id)}>{state.savedProgramIds.includes(program.id) ? "Saved" : "Save"}</button>
            <button onClick={() => onCompare(program.id)}>{state.compareProgramIds.includes(program.id) ? "Compared" : "Compare"}</button>
            <button className="primary" onClick={() => isInChoices ? onNavigate("/hub/applications/packet-2026") : onAddChoice(program.id)}>
              {isInChoices ? "Open application" : "Add to choices"}
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function HubView({
  state,
  onNavigate,
  onRead,
  onOpenAdviser,
}: {
  state: AppState;
  onNavigate: (href: string) => void;
  onRead: (id: string) => void;
  onOpenAdviser: () => void;
}) {
  const missing = selectedMissingDocuments(state);
  const choicePrograms = state.choices.map((choice) => programs.find((program) => program.id === choice.programId)!);
  return (
    <main className="hub-page">
      <section className="hub-header">
        <div>
          <p className="eyebrow">Student Hub</p>
          <h1>{profile.displayName}&apos;s application workspace</h1>
          <p>Preview profile active. Your real account and documents will connect later through the data client.</p>
        </div>
        <button className="next-action" onClick={() => onNavigate("/hub/applications/packet-2026")}>
          <span>Application center</span>
          <strong>Enter application center</strong>
          <small>Manage choices, documents, review, and submission in one place.</small>
        </button>
      </section>

      <section className="hub-grid">
        <article className="meter-card">
          <span>Profile readiness</span>
          <strong>{profile.profileCompleteness}%</strong>
          <div className="meter"><span style={{ width: `${profile.profileCompleteness}%` }} /></div>
        </article>
        <article className="meter-card">
          <span>Application status</span>
          <strong>{statusLabel(state.packet.status)}</strong>
          <p>{state.packet.adviserReviewRequested ? "Ready for adviser review" : "Build your packet step by step"}</p>
        </article>
      </section>

      <section className="content-grid">
        <ContentBand title="Active choices" action="Search more" onAction={() => onNavigate("/programs")}>
          {choicePrograms.length ? choicePrograms.map((program) => (
            <MiniProgram key={program.id} program={program} onNavigate={() => onNavigate("/hub/applications/packet-2026")} />
          )) : <EmptyMini label="No choices yet" action="Add a program" onAction={() => onNavigate("/programs")} />}
        </ContentBand>

        <ContentBand title="Missing documents" action="Search programs" onAction={() => onNavigate("/programs")}>
          {missing.length ? missing.map((doc) => {
            const requirement = requirementFor(doc.requirementId);
            return (
              <article className="mini-card warning-card" key={doc.id}>
                <strong>{requirement.label}</strong>
                <span>{statusLabel(doc.status)}</span>
                <p>{requirement.description}</p>
              </article>
            );
          }) : <EmptyMini label="No hard document blockers" action="Search programs" onAction={() => onNavigate("/programs")} />}
        </ContentBand>

        <ContentBand title="Upcoming deadlines" action="Late intake" onAction={() => onNavigate("/programs?lateIntakeAvailable=true")}>
          {programs.filter((program) => ["urgent", "closes_soon", "late_intake"].includes(program.deadlineStatus)).slice(0, 3).map((program) => (
            <MiniProgram key={program.id} program={program} onNavigate={onNavigate} />
          ))}
        </ContentBand>

        <ContentBand title="Messages" action="Adviser access" onAction={onOpenAdviser}>
          {state.messages.slice(0, 4).map((message) => (
            <article className={message.read ? "mini-card read" : "mini-card"} key={message.id}>
              <strong>{message.title}</strong>
              <p>{message.body}</p>
              {!message.read && <button onClick={() => onRead(message.id)}>Mark read</button>}
            </article>
          ))}
        </ContentBand>
      </section>
    </main>
  );
}

function ApplicationView({
  state,
  savingStatus,
  onNavigate,
  onSection,
  onUpload,
  onMarkReady,
  onRequestReview,
  onOpenSections,
}: {
  state: AppState;
  savingStatus: "saved" | "dirty" | "saving" | "error";
  onNavigate: (href: string) => void;
  onSection: (section: ApplicationSectionKey) => void;
  onUpload: (documentId: string) => void;
  onMarkReady: (section: ApplicationSectionKey) => void;
  onRequestReview: () => void;
  onOpenSections: () => void;
}) {
  const missing = selectedMissingDocuments(state);
  return (
    <main className="application-page">
      <section className="application-header">
        <div>
          <p className="eyebrow">Application Builder</p>
          <h1>Prepare a reviewable application packet</h1>
          <p>{state.choices.length} choice{state.choices.length === 1 ? "" : "s"} selected · Autosave: {savingStatus === "saving" ? "Saving" : "Saved"}</p>
        </div>
        <button className="filter-mobile" onClick={onOpenSections}>Sections</button>
      </section>

      <section className="builder-grid">
        <aside className="section-rail">
          <SectionList state={state} onSection={onSection} />
        </aside>
        <section className="section-panel">
          <p className="eyebrow">{sections.find((item) => item.key === state.activeSection)?.label}</p>
          {state.activeSection === "documents" ? (
            <DocumentSection state={state} onUpload={onUpload} />
          ) : state.activeSection === "choices" ? (
            <ChoiceSection state={state} onNavigate={onNavigate} />
          ) : state.activeSection === "review" ? (
            <ReviewSection missing={missing} state={state} onRequestReview={onRequestReview} />
          ) : (
            <GenericSection section={state.activeSection} status={state.packet.sectionStatuses[state.activeSection]} />
          )}
          {state.activeSection !== "review" && (
            <button className="primary section-ready" onClick={() => onMarkReady(state.activeSection)}>
              Mark section ready
            </button>
          )}
        </section>
        <aside className="context-panel">
          <strong>Context</strong>
          <p>Hard blockers prevent adviser review. Warnings stay visible but do not stop review.</p>
          <div className="blocker-list">
            {missing.slice(0, 4).map((doc) => (
              <button key={doc.id} onClick={() => onSection("documents")}>
                <span>{requirementFor(doc.requirementId).label}</span>
                <strong>Prepare</strong>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function SectionList({ state, onSection }: { state: AppState; onSection: (section: ApplicationSectionKey) => void }) {
  return (
    <div className="section-list">
      {sections.map((section) => (
        <button
          key={section.key}
          className={state.activeSection === section.key ? "selected" : ""}
          onClick={() => onSection(section.key)}
        >
          <span>{section.label}</span>
          <small>{statusLabel(state.packet.sectionStatuses[section.key])}</small>
        </button>
      ))}
    </div>
  );
}

function DocumentSection({ state, onUpload }: { state: AppState; onUpload: (documentId: string) => void }) {
  return (
    <div className="document-list large">
      {state.documents.map((doc) => {
        const requirement = requirementFor(doc.requirementId);
        return (
          <article key={doc.id}>
            <div>
              <strong>{requirement.label}</strong>
              <p>{requirement.description}</p>
              {doc.reviewNote && <small>{doc.reviewNote}</small>}
            </div>
            <div className="doc-action">
              <span className={`doc-status ${doc.status}`}>{statusLabel(doc.status)}</span>
              <button disabled={doc.status === "uploading" || doc.status === "locked"} onClick={() => onUpload(doc.id)}>
                {doc.status === "missing" || doc.status === "rejected" || doc.status === "expired" ? "Upload" : "Replace"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ChoiceSection({ state, onNavigate }: { state: AppState; onNavigate: (href: string) => void }) {
  return (
    <div className="mini-grid">
      {state.choices.map((choice) => {
        const program = programs.find((item) => item.id === choice.programId)!;
        return <MiniProgram key={choice.id} program={program} onNavigate={onNavigate} />;
      })}
      {!state.choices.length && <EmptyMini label="No program choices yet" action="Search programs" onAction={() => onNavigate("/programs")} />}
    </div>
  );
}

function ReviewSection({
  state,
  missing,
  onRequestReview,
}: {
  state: AppState;
  missing: typeof initialDocuments;
  onRequestReview: () => void;
}) {
  const blocked = missing.length > 0;
  return (
    <div className="review-panel">
      <h2>{blocked ? "Resolve blockers before adviser review" : "Ready for adviser review"}</h2>
      <p>
        {blocked
          ? `${missing.length} required document${missing.length > 1 ? "s are" : " is"} still missing.`
          : "Your preview packet has no hard blockers from the current frontend data."}
      </p>
      <div className="review-summary">
        <span>{state.choices.length} choices</span>
        <span>{missing.length} hard blockers</span>
        <span>{state.packet.adviserReviewRequested ? "Review requested" : "Review not requested"}</span>
      </div>
      <button className="primary" disabled={blocked || state.packet.adviserReviewRequested} onClick={onRequestReview}>
        {state.packet.adviserReviewRequested ? "Ready for adviser review" : "Request adviser review"}
      </button>
    </div>
  );
}

function GenericSection({ section, status }: { section: string; status: SectionStatus }) {
  return (
    <div className="generic-section">
      <h2>{statusLabel(section)}</h2>
      <p>
        This section uses production UI states now and will connect to real fields through the
        same data client later.
      </p>
      <div className="mock-fields">
        <label>
          <span>Required detail</span>
          <input defaultValue={status === "ready" ? "Preview information saved" : ""} placeholder="Enter information" />
        </label>
        <label>
          <span>Notes</span>
          <textarea placeholder="Add anything the adviser should review" />
        </label>
      </div>
    </div>
  );
}

function CompareContent({
  ids,
  state,
  onNavigate,
  onCompare,
  onAddChoice,
}: {
  ids: string[];
  state: AppState;
  onNavigate: (href: string) => void;
  onCompare: (programId: string) => void;
  onAddChoice: (programId: string) => void;
}) {
  if (!ids.length) {
    return (
      <section className="compare-box">
        <strong>Compare programs</strong>
        <p>Add up to 3 programs to compare deadline, tuition, documents, and readiness.</p>
      </section>
    );
  }
  return (
    <section className="compare-box">
      <strong>{ids.length < 2 ? "Add one more to compare" : "Compare ready"}</strong>
      {ids.map((id) => {
        const program = programs.find((item) => item.id === id)!;
        return (
          <article key={id}>
            <button className="linklike" onClick={() => onNavigate(`/programs/${id}`)}>{program.name}</button>
            <span>{formatMoney(program.tuitionRmb)} · {program.documentRequirementIds.length} docs</span>
            <button onClick={() => onCompare(id)}>Remove</button>
          </article>
        );
      })}
      <button className="primary" disabled={ids.length < 2} onClick={() => ids[0] && onAddChoice(ids[0])}>Add best fit to choices</button>
      {state.compareProgramIds.length >= 3 && <p className="hint">Compare limit reached.</p>}
    </section>
  );
}

function AdviserPanel() {
  const scopes = [
    ["Profile read", true, false],
    ["Shortlist read", true, false],
    ["Document filenames read", true, false],
    ["Document view", false, false],
    ["Application edit", false, true],
    ["Application submit", false, true],
  ] as const;
  return (
    <div className="adviser-panel">
      <p><strong>Preview Adviser</strong> · CUAC Counselling Desk</p>
      <p>Expires 31 Dec 2026. Permissions are specific and revocable.</p>
      {scopes.map(([label, enabled, highRisk]) => (
        <label className="permission-row" key={label}>
          <span>
            <strong>{label}</strong>
            {highRisk && <small>High-risk permission</small>}
          </span>
          <input type="checkbox" defaultChecked={enabled} />
        </label>
      ))}
      <button className="danger-button">Revoke access</button>
    </div>
  );
}

function ContentBand({
  title,
  action,
  children,
  onAction,
}: {
  title: string;
  action: string;
  children: React.ReactNode;
  onAction: () => void;
}) {
  return (
    <section className="content-band">
      <div className="band-head">
        <h2>{title}</h2>
        <button onClick={onAction}>{action}</button>
      </div>
      <div className="band-body">{children}</div>
    </section>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="info-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function MiniProgram({ program, onNavigate }: { program: Program; onNavigate: (href: string) => void }) {
  const university = universityFor(program);
  return (
    <article className="mini-card">
      <span className={badgeClass(program.deadlineStatus)}>{deadlineText(program)}</span>
      <strong>{program.name}</strong>
      <span>{university.name}</span>
      <p>{labelLanguage(program.teachingLanguage)} · {formatMoney(program.tuitionRmb)}</p>
      <button onClick={() => onNavigate(`/programs/${program.id}`)}>Open details</button>
    </article>
  );
}

function EmptyMini({ label, action, onAction }: { label: string; action: string; onAction: () => void }) {
  return (
    <article className="mini-card empty-mini">
      <strong>{label}</strong>
      <p>Start with one concrete action.</p>
      <button onClick={onAction}>{action}</button>
    </article>
  );
}

function Panel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="panel-backdrop"
      role="button"
      tabIndex={-1}
      aria-label="Close panel"
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <section className="side-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-head">
          <h2>{title}</h2>
          <button onClick={onClose}>Close</button>
        </div>
        {children}
      </section>
    </div>
  );
}
