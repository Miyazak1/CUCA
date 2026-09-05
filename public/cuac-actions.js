(function () {
  const actions = [
    {
      actionKey: "navigation.open_page",
      uiActions: ["open-page"],
      surface: "shared",
      allowedSurfaces: ["public-student", "authenticated-student", "school-staff", "cuac-internal", "account"],
      allowedRoutes: [],
      allowedRoles: ["visitor", "visitor_or_student", "student", "school_staff", "school_owner_or_staff", "school_owner", "cuac_ops"],
      riskLevel: "low",
      confirmationRequired: false,
      auditEvent: "agent.navigation.open_page",
    },
    {
      actionKey: "catalog.apply_filters",
      uiActions: ["apply-smart-filters"],
      surface: "discovery",
      allowedSurfaces: ["public-student"],
      allowedRoutes: ["programs.html", "universities.html", "scholarships.html", "cities.html", "guides.html"],
      allowedRoles: ["visitor", "visitor_or_student", "student"],
      riskLevel: "low",
      confirmationRequired: false,
      auditEvent: "agent.catalog.apply_filters",
    },
    {
      actionKey: "catalog.compare_routes",
      uiActions: ["compare-routes"],
      surface: "discovery",
      allowedSurfaces: ["public-student", "authenticated-student"],
      allowedRoutes: ["programs.html", "universities.html", "cities.html", "favourites.html", "hub.html", "application.html"],
      allowedRoles: ["visitor", "visitor_or_student", "student"],
      riskLevel: "low",
      confirmationRequired: false,
      auditEvent: "agent.catalog.compare_routes",
    },
    {
      actionKey: "catalog.compare_funding",
      uiActions: ["compare-funding"],
      surface: "discovery",
      allowedSurfaces: ["public-student", "authenticated-student"],
      allowedRoutes: ["scholarships.html", "guides.html", "application.html"],
      allowedRoles: ["visitor", "visitor_or_student", "student"],
      riskLevel: "low",
      confirmationRequired: false,
      auditEvent: "agent.catalog.compare_funding",
    },
    {
      actionKey: "catalog.save_item",
      uiActions: ["save-program-shortlist"],
      surface: "discovery",
      allowedSurfaces: ["authenticated-student"],
      allowedRoutes: ["hub.html", "favourites.html", "programs.html"],
      allowedRoles: ["student"],
      riskLevel: "medium",
      confirmationRequired: false,
      auditEvent: "agent.catalog.save_item",
    },
    {
      actionKey: "guide.save_checklist",
      uiActions: ["save-checklist"],
      surface: "guide",
      allowedSurfaces: ["public-student", "authenticated-student"],
      allowedRoutes: ["guides.html", "guide-detail.html", "hub.html", "application.html", "favourites.html", "scholarships.html"],
      allowedRoles: ["visitor_or_student", "student"],
      riskLevel: "medium",
      confirmationRequired: false,
      auditEvent: "agent.guide.save_checklist",
    },
    {
      actionKey: "city.save_cost_estimate",
      uiActions: ["save-cost-estimate"],
      surface: "city",
      allowedSurfaces: ["public-student", "authenticated-student"],
      allowedRoutes: ["cities.html", "city-detail.html"],
      allowedRoles: ["visitor_or_student", "student"],
      riskLevel: "medium",
      confirmationRequired: false,
      auditEvent: "agent.city.save_cost_estimate",
    },
    {
      actionKey: "application.open_add_choice",
      uiActions: ["open-choice-modal"],
      surface: "application",
      allowedSurfaces: ["public-student", "authenticated-student"],
      allowedRoutes: ["programs.html", "universities.html", "scholarships.html", "hub.html", "application.html"],
      allowedRoles: ["visitor_or_student", "student"],
      riskLevel: "low",
      confirmationRequired: false,
      auditEvent: "agent.application.open_add_choice",
    },
    {
      actionKey: "application.add_choice",
      uiActions: ["prefill-choice"],
      surface: "application",
      allowedSurfaces: ["authenticated-student"],
      allowedRoutes: ["application.html"],
      allowedRoles: ["student"],
      riskLevel: "medium",
      confirmationRequired: false,
      auditEvent: "agent.application.add_choice",
    },
    {
      actionKey: "application.confirm_choice_order",
      uiActions: ["confirm-choice-order"],
      surface: "application",
      allowedSurfaces: ["authenticated-student"],
      allowedRoutes: ["hub.html", "application.html"],
      allowedRoles: ["student"],
      riskLevel: "medium",
      confirmationRequired: false,
      auditEvent: "agent.application.confirm_choice_order",
    },
    {
      actionKey: "application.preview_fee",
      uiActions: ["review-fee"],
      surface: "application",
      allowedSurfaces: ["authenticated-student"],
      allowedRoutes: ["application.html"],
      allowedRoles: ["student"],
      riskLevel: "low",
      confirmationRequired: false,
      auditEvent: "agent.application.preview_fee",
    },
    {
      actionKey: "application.submit",
      uiActions: ["submit-application"],
      surface: "application",
      allowedSurfaces: ["authenticated-student"],
      allowedRoutes: ["application.html"],
      allowedRoles: ["student"],
      riskLevel: "high",
      confirmationRequired: true,
      auditEvent: "agent.application.submit",
    },
    {
      actionKey: "school.record.mark_contacted",
      uiActions: ["school-mark-contacted"],
      surface: "school_portal",
      allowedSurfaces: ["school-staff"],
      allowedRoutes: ["school-portal.html"],
      allowedRoles: ["school_staff", "school_owner_or_staff", "school_owner"],
      riskLevel: "medium",
      confirmationRequired: false,
      auditEvent: "agent.school.record.mark_contacted",
    },
    {
      actionKey: "school.records.bulk_contact",
      uiActions: ["school-bulk-contact"],
      surface: "school_portal",
      allowedSurfaces: ["school-staff"],
      allowedRoutes: ["school-portal.html"],
      allowedRoles: ["school_staff", "school_owner_or_staff", "school_owner"],
      riskLevel: "high",
      confirmationRequired: true,
      auditEvent: "agent.school.records.bulk_contact",
    },
    {
      actionKey: "school.records.export_csv",
      uiActions: ["school-export-csv"],
      surface: "school_portal",
      allowedSurfaces: ["school-staff"],
      allowedRoutes: ["school-portal.html"],
      allowedRoles: ["school_staff", "school_owner_or_staff", "school_owner"],
      riskLevel: "high",
      confirmationRequired: true,
      auditEvent: "agent.school.records.export_csv",
    },
    {
      actionKey: "school.template.copy_request",
      uiActions: ["school-copy-request-template"],
      surface: "school_portal",
      allowedSurfaces: ["school-staff"],
      allowedRoutes: ["school-portal.html", "school-settings.html"],
      allowedRoles: ["school_staff", "school_owner_or_staff", "school_owner"],
      riskLevel: "medium",
      confirmationRequired: false,
      auditEvent: "agent.school.template.copy_request",
    },
    {
      actionKey: "ops.review_agent_audit",
      uiActions: ["ops-review-agent-audit"],
      surface: "ops",
      allowedSurfaces: ["cuac-internal"],
      allowedRoutes: ["ops-admin.html"],
      allowedRoles: ["cuac_ops"],
      riskLevel: "high",
      confirmationRequired: true,
      auditEvent: "agent.ops.review_agent_audit",
    },
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeRoute(route) {
    return String(route || "").replace(/^\.\//, "").split(/[?#]/)[0];
  }

  function currentRouteName() {
    return normalizeRoute(window.location?.pathname?.split("/").pop() || "home-v3.html");
  }

  function currentRouteContract(route = currentRouteName()) {
    return window.CuacDataClient?.getRouteContract?.(normalizeRoute(route)) || null;
  }

  function getAction(actionKey) {
    const action = actions.find((item) => item.actionKey === actionKey) || null;
    return action ? clone(action) : null;
  }

  function getActionByUiAction(uiAction) {
    const action = actions.find((item) => item.uiActions.includes(uiAction)) || null;
    return action ? clone(action) : null;
  }

  function resolveAction({ actionKey, uiAction } = {}) {
    return (uiAction && getActionByUiAction(uiAction)) || (actionKey && getAction(actionKey)) || null;
  }

  function isSurfaceAllowed(action, surface, route) {
    if (action.surface === "shared") return true;
    const routeName = normalizeRoute(route);
    if (routeName && action.allowedRoutes.length > 0) return action.allowedRoutes.includes(routeName);
    return !surface || action.surface === surface || action.allowedSurfaces.includes(surface);
  }

  const signedInRequiredUiActions = new Set([
    "save-program-shortlist",
    "save-checklist",
    "save-cost-estimate",
    "open-choice-modal",
    "prefill-choice",
    "confirm-choice-order",
    "review-fee",
    "submit-application",
    "school-mark-contacted",
    "school-bulk-contact",
    "school-export-csv",
    "school-copy-request-template",
    "ops-review-agent-audit",
  ]);

  function requiresSignedIn(action) {
    return (
      action.allowedSurfaces.includes("authenticated-student") ||
      action.allowedSurfaces.includes("school-staff") ||
      action.allowedSurfaces.includes("cuac-internal") ||
      action.uiActions.some((uiAction) => signedInRequiredUiActions.has(uiAction))
    );
  }

  function resolveAuthState(authState, surface, role) {
    if (authState) return authState;
    if (surface === "public-student" || role === "visitor" || role === "visitor_or_student") return "signed-out";
    return "signed-in";
  }

  function canRunAction({ actionKey, uiAction, surface, role, route, authState } = {}) {
    const action = resolveAction({ actionKey, uiAction });
    if (!action) return { allowed: false, reason: "unknown-action" };
    const routeContract = currentRouteContract(route);
    const resolvedRoute = normalizeRoute(route || routeContract?.route || currentRouteName());
    const resolvedSurface = surface || routeContract?.surface;
    const resolvedRole = role || routeContract?.role;
    const resolvedAuthState = resolveAuthState(authState, resolvedSurface, resolvedRole);
    if (!isSurfaceAllowed(action, resolvedSurface, resolvedRoute)) return { allowed: false, reason: "surface-not-allowed", action };
    if (requiresSignedIn(action) && resolvedAuthState !== "signed-in") return { allowed: false, reason: "sign-in-required", action };
    if (resolvedRole && !action.allowedRoles.includes(resolvedRole)) return { allowed: false, reason: "role-not-allowed", action };
    return { allowed: true, reason: "allowed", action };
  }

  function listActions({ surface, role, route } = {}) {
    const routeContract = route ? currentRouteContract(route) : null;
    const resolvedSurface = surface || routeContract?.surface;
    const resolvedRole = role || routeContract?.role;
    return clone(actions.filter((action) => isSurfaceAllowed(action, resolvedSurface, route) && (!resolvedRole || action.allowedRoles.includes(resolvedRole))));
  }

  window.CuacActionRegistry = {
    actions: clone(actions),
    listActions,
    getAction,
    getActionByUiAction,
    resolveAction,
    canRunAction,
  };
})();
