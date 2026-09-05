const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!chromePath) {
  throw new Error("Chrome was not found. Set CHROME_PATH to run layout QA.");
}

const root = path.resolve(process.env.CUAC_QA_ROOT || path.resolve(__dirname, "..", "public"));
const port = Number(process.env.CUAC_LAYOUT_QA_PORT || 9600 + (process.pid % 500));

const viewports = [
  { name: "desktop", width: 1440, height: 1000, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForProcessExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    child.once("exit", resolve);
  });
}

function pageUrl(file) {
  return `file:///${path.join(root, file).replaceAll("\\", "/")}`;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;

    ws.onopen = () => {
      resolve({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            id += 1;
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          ws.close();
        },
      });
    };
    ws.onerror = reject;
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const handler = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) handler.rej(new Error(message.error.message || JSON.stringify(message.error)));
      else handler.res(message.result);
    };
  });
}

async function getPageTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {
      // Chrome is still starting.
    }
    await sleep(250);
  }
  throw new Error(`Chrome page target not ready on ${port}`);
}

async function evaluate(cdp, expression, options = {}) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    ...options,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, label, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(cdp, expression)) return;
    await sleep(120);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function setViewport(cdp, viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await cdp.send("Emulation.setVisibleSize", {
    width: viewport.width,
    height: viewport.height,
  });
}

async function navigate(cdp, file) {
  await cdp.send("Page.navigate", { url: pageUrl(file) });
  await waitFor(cdp, "document.readyState !== 'loading'", `${file} DOM ready`, 10000);
  await sleep(350);
}

async function setStudentAuthPreview(cdp) {
  await setRoleAuthPreview(cdp, {
    selectedSurface: "student",
    role: "student",
    surface: "authenticated-student",
    userName: "Maya",
    userInitial: "M",
  });
}

async function setRoleAuthPreview(cdp, profile) {
  await navigate(cdp, "home-v3.html?motion=off");
  await evaluate(
    cdp,
    `localStorage.setItem('cuacAuthDemoState', JSON.stringify({
      authState: 'signed-in',
      selectedSurface: ${JSON.stringify(profile.selectedSurface)},
      role: ${JSON.stringify(profile.role)},
      surface: ${JSON.stringify(profile.surface)},
      accessGrantStatus: ${JSON.stringify(profile.accessGrantStatus || "active-preview")},
      accessGrantType: ${JSON.stringify(profile.accessGrantType || "student_profile")},
      accessGrantSource: ${JSON.stringify(profile.accessGrantSource || "self_registration")},
      accessGrantScope: ${JSON.stringify(profile.accessGrantScope || "")},
      userName: ${JSON.stringify(profile.userName)},
      userInitial: ${JSON.stringify(profile.userInitial)},
      source: 'layout-qa',
      savedAt: new Date().toISOString()
    }))`
  );
}

async function clickSelector(cdp, selector) {
  const point = await evaluate(cdp, `
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing selector: ${selector}');
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function assertNoHorizontalOverflow(cdp, label) {
  const overflow = await evaluate(cdp, `
    (() => {
      const root = document.documentElement;
      const body = document.body;
      return Math.max(root.scrollWidth, body?.scrollWidth || 0) - root.clientWidth;
    })()
  `);
  if (overflow > 4) {
    throw new Error(`${label} horizontal overflow: ${overflow}px`);
  }
}

async function assertOpsAdminNotBlank(cdp, label) {
  const state = await evaluate(cdp, `
    (() => {
      const root = document.querySelector('[data-detail-root]');
      const activePanel = document.querySelector('[data-ops-section]:not([hidden])');
      const textLength = activePanel?.textContent?.trim().length || 0;
      return {
        hasRoot: Boolean(root),
        hasActivePanel: Boolean(activePanel),
        section: activePanel?.dataset.opsSection || '',
        textLength,
        hasErrorState: Boolean(root?.querySelector('.ops-error-state')),
        hasWorkSurface: Boolean(activePanel?.querySelector('.ops-management-surface, .ops-module-list, .ops-overview-section, .ops-student-workbench, .ops-queue-workspace, .ops-access-workbench')),
        hash: location.hash
      };
    })()
  `);
  if (!state.hasRoot || !state.hasActivePanel || state.hasErrorState || !state.hasWorkSurface || state.textLength < 120) {
    throw new Error(`${label} rendered blank or recovery state: ${JSON.stringify(state)}`);
  }
}

async function assertElementInViewport(cdp, selector, label, { vertical = false } = {}) {
  const rect = await evaluate(cdp, `
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing selector: ${selector}');
      document.documentElement.style.scrollBehavior = 'auto';
      document.body.style.scrollBehavior = 'auto';
      element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      };
    })()
  `);
  const horizontallyVisible = rect.left >= -1 && rect.right <= rect.innerWidth + 1 && rect.width <= rect.innerWidth + 1;
  const verticallyVisible = !vertical || (rect.top >= -1 && rect.bottom <= rect.innerHeight + 1 && rect.height <= rect.innerHeight + 1);
  if (!horizontallyVisible || !verticallyVisible) {
    throw new Error(`${label} is outside viewport: ${JSON.stringify(rect)}`);
  }
}

async function assertClickableCenter(cdp, selector, label) {
  const state = await evaluate(cdp, `
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing selector: ${selector}');
      document.documentElement.style.scrollBehavior = 'auto';
      document.body.style.scrollBehavior = 'auto';
      element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      const rect = element.getBoundingClientRect();
      const x = Math.min(Math.max(rect.left + rect.width / 2, 1), window.innerWidth - 1);
      const y = Math.min(Math.max(rect.top + rect.height / 2, 1), window.innerHeight - 1);
      const hit = document.elementFromPoint(x, y);
      return {
        hit: Boolean(hit),
        clickable: Boolean(hit && (hit === element || element.contains(hit) || hit.closest(${JSON.stringify(selector)}))),
        hitTag: hit?.tagName || '',
        hitClass: hit?.className || '',
        rect: {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        },
        x,
        y,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight
      };
    })()
  `);
  if (!state.clickable) {
    throw new Error(`${label} center is covered: ${JSON.stringify(state)}`);
  }
}

async function runStep(label, fn) {
  process.stdout.write(`- ${label}... `);
  await fn();
  process.stdout.write("ok\n");
}

async function withBrowser(fn) {
  const runUserDataDir = path.join(os.tmpdir(), `cuac-layout-qa-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1000)}`);
  const browser = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--allow-file-access-from-files",
      "--force-device-scale-factor=1",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${runUserDataDir}`,
      "--window-size=1440,1000",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let cdp;
  try {
    const page = await getPageTarget();
    cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await fn(cdp);
  } finally {
    cdp?.close?.();
    browser.kill();
    await waitForProcessExit(browser);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        fs.rmSync(runUserDataDir, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 2) {
          console.warn(`Warning: could not remove Chrome QA profile ${runUserDataDir}: ${error.message}`);
          break;
        }
        await sleep(250);
      }
    }
  }
}

async function exerciseViewport(cdp, viewport) {
  await setViewport(cdp, viewport);

  await runStep(`${viewport.name}: application add-choice modal layout stays usable`, async () => {
    await setStudentAuthPreview(cdp);
    await navigate(cdp, "application.html#add-choice");
    await waitFor(cdp, "document.querySelector('[data-choice-modal]')?.classList.contains('open')", "choice modal");
    await assertNoHorizontalOverflow(cdp, "Add choice modal");
    await assertElementInViewport(cdp, ".choice-modal.open .choice-dialog", "Add choice dialog", { vertical: true });
    await assertClickableCenter(cdp, ".choice-dialog .primary-action", "Add choice primary action");
  });

  await runStep(`${viewport.name}: auth continuation page layout stays usable`, async () => {
    await navigate(cdp, "programs.html?motion=off");
    await evaluate(cdp, "localStorage.clear()");
    await navigate(cdp, "programs.html?motion=off");
    await waitFor(cdp, "document.querySelectorAll('[data-save]').length > 0", "save buttons");
    await clickSelector(cdp, "[data-save]");
    await waitFor(cdp, "location.href.includes('auth.html')", "auth continuation page");
    await assertNoHorizontalOverflow(cdp, "Auth continuation page");
    await assertElementInViewport(cdp, ".auth-card", "Auth card");
    await assertClickableCenter(cdp, "[data-auth-panel=\"signin\"] .primary", "Auth continuation submit action");
  });

  await runStep(`${viewport.name}: auth recovery page layout stays usable`, async () => {
    await navigate(cdp, "auth.html#reset");
    await waitFor(cdp, "document.querySelector('[data-auth-panel=\"reset\"]')?.classList.contains('active')", "Auth reset panel");
    await assertNoHorizontalOverflow(cdp, "Auth reset page");
    await assertElementInViewport(cdp, ".auth-card", "Auth card");
    await assertClickableCenter(cdp, "[data-auth-panel=\"reset\"] .primary", "Reset submit action");
  });

  await runStep(`${viewport.name}: catalog card entry points stay usable`, async () => {
    await navigate(cdp, "programs.html?motion=off");
    await waitFor(cdp, "document.querySelectorAll('#programList .program-row').length > 0", "Program cards");
    await assertNoHorizontalOverflow(cdp, "Programs card grid");
    await assertElementInViewport(cdp, "#programList [data-program-card]", "Program card entry");
    await assertElementInViewport(cdp, "#programList .program-card-open", "Program card open affordance");
    await assertClickableCenter(cdp, "#programList .program-action-secondary", "Program compare action");
    await assertClickableCenter(cdp, "#programList [data-program-card]", "Program whole-card detail entry");
    await waitFor(cdp, "!document.querySelector('#programList .program-action-main')", "Program cards use whole-card entry");

    await navigate(cdp, "universities.html?motion=off");
    await waitFor(cdp, "document.querySelectorAll('#resultsGrid .university-card').length > 0", "University cards");
    await assertNoHorizontalOverflow(cdp, "University card grid");
    await assertElementInViewport(cdp, "#resultsGrid [data-university-card]", "University card entry");
    await assertElementInViewport(cdp, "#resultsGrid .university-card-open", "University open affordance");
    await assertClickableCenter(cdp, "#resultsGrid [data-university-card]", "University whole-card detail entry");
    await waitFor(cdp, "!document.querySelector('#resultsGrid .university-action-main, #resultsGrid .university-action-secondary')", "University cards use whole-card entry");

    await navigate(cdp, "scholarships.html?motion=off");
    await waitFor(cdp, "document.querySelectorAll('#scholarshipGrid .scholarship-card').length > 0", "Scholarship cards");
    await waitFor(
      cdp,
      "document.querySelector('#scholarshipGrid .scholarship-readiness')?.textContent.includes('Eligibility') && document.querySelector('#scholarshipGrid .scholarship-readiness')?.textContent.includes('Materials') && document.querySelector('#scholarshipGrid .scholarship-readiness')?.textContent.includes('Next step')",
      "Scholarship readiness summary",
    );
    await assertNoHorizontalOverflow(cdp, "Scholarship card grid");
    await assertElementInViewport(cdp, "#scholarshipGrid [data-scholarship-card]", "Scholarship card entry");
    await assertElementInViewport(cdp, "#scholarshipGrid .scholarship-card-open", "Scholarship card open affordance");
    await assertClickableCenter(cdp, "#scholarshipGrid [data-scholarship-card]", "Scholarship whole-card detail entry");
    await waitFor(cdp, "!document.querySelector('#scholarshipGrid .scholarship-action-main')", "Scholarship cards use whole-card entry");

    await navigate(cdp, "cities.html?motion=off");
    await waitFor(cdp, "document.querySelectorAll('#cityGrid .city-card').length > 0", "City cards");
    await assertNoHorizontalOverflow(cdp, "City card grid");
    await assertElementInViewport(cdp, "#cityGrid [data-city-card]", "City card entry");
    await assertElementInViewport(cdp, "#cityGrid .city-card-open", "City card open affordance");
    await assertClickableCenter(cdp, "#cityGrid [data-city-card]", "City whole-card detail entry");
    await waitFor(cdp, "!document.querySelector('#cityGrid .city-action-main, #cityGrid .city-action-secondary')", "City cards use whole-card entry");
  });

  await runStep(`${viewport.name}: completion state pages stay usable`, async () => {
    await navigate(cdp, "program-detail.html?state=loading&motion=off");
    await waitFor(cdp, "Boolean(document.querySelector('[data-completion-state=\"loading\"]'))", "Completion loading state");
    await assertNoHorizontalOverflow(cdp, "Completion loading state");
    await assertElementInViewport(cdp, "[data-completion-state=\"loading\"]", "Completion loading panel");

    await navigate(cdp, "program-detail.html?state=empty&motion=off");
    await waitFor(cdp, "Boolean(document.querySelector('[data-completion-state=\"empty\"]'))", "Completion empty state");
    await assertNoHorizontalOverflow(cdp, "Completion empty state");
    await assertClickableCenter(cdp, "[data-completion-state=\"empty\"] .primary-action", "Completion empty primary action");

    await navigate(cdp, "program-detail.html?state=error&motion=off");
    await waitFor(cdp, "Boolean(document.querySelector('[data-completion-state=\"error\"]'))", "Completion error state");
    await assertNoHorizontalOverflow(cdp, "Completion error state");
    await assertClickableCenter(cdp, "[data-completion-state=\"error\"] .primary-action", "Completion error retry action");
  });

  await runStep(`${viewport.name}: catalog-backed detail pages stay usable`, async () => {
    await navigate(cdp, "program-detail.html?program=fudan-econ-ba&motion=off");
    await waitFor(cdp, "document.querySelector('.program-detail-hero h1')?.textContent.trim() === 'Economics BA'", "Dynamic program detail");
    await assertNoHorizontalOverflow(cdp, "Dynamic program detail");
    await assertElementInViewport(cdp, ".program-detail-hero", "Dynamic detail hero");
    await assertElementInViewport(cdp, ".program-glance-band", "Dynamic program glance");
    await assertClickableCenter(cdp, ".program-detail-hero .primary-action", "Dynamic detail primary action");
    await assertClickableCenter(cdp, ".program-side-action-grid .program-side-action.primary", "Dynamic program side add-choice action");
    await assertElementInViewport(cdp, ".action-panel", "Dynamic detail action panel", { vertical: true });

    await navigate(cdp, "city-detail.html?city=hangzhou&motion=off");
    await waitFor(cdp, "document.querySelector('.city-detail-hero h1')?.textContent.trim() === 'Study in Hangzhou' && document.body.textContent.includes('City information')", "Dynamic city detail");
    await assertNoHorizontalOverflow(cdp, "Dynamic city detail");
    await assertElementInViewport(cdp, ".city-detail-hero", "Dynamic city detail hero");
    await assertElementInViewport(cdp, ".city-quick-facts", "Dynamic city quick facts");
    await assertClickableCenter(cdp, ".city-detail-hero .primary-action", "Dynamic city detail primary action");
  });

  await runStep(`${viewport.name}: home shared discovery summary layout stays usable`, async () => {
    await navigate(cdp, "home-v3.html?motion=off");
    await waitFor(cdp, "document.querySelector('[data-home-schools]')?.textContent.includes('Zhejiang University')", "Home shared schools");
    await assertNoHorizontalOverflow(cdp, "Home shared discovery summary");
    await assertElementInViewport(cdp, "[data-home-categories]", "Home categories");
    await assertElementInViewport(cdp, "[data-home-question-routes]", "Home question routes", { vertical: true });
    await assertClickableCenter(cdp, "[data-home-categories] .cat", "Home category action");
  });

  await runStep(`${viewport.name}: hub application entry stays clear and usable`, async () => {
    await setStudentAuthPreview(cdp);
    await evaluate(cdp, "localStorage.removeItem('cuacApplicationDemoState')");
    await navigate(cdp, "hub.html?motion=off");
    await waitFor(cdp, "document.querySelector('[data-application-title]')?.textContent.includes('Start your application')", "Hub no-application entry");
    await assertNoHorizontalOverflow(cdp, "Hub no-application entry");
    await assertElementInViewport(cdp, ".application-current-card", "Hub start application card");
    await assertClickableCenter(cdp, ".application-top-action", "Hub start application action");
    await waitFor(cdp, "document.querySelector('.application-top-action')?.getAttribute('href') === 'application.html'", "Hub start action points to application center");

    await evaluate(cdp, `
      localStorage.setItem('cuacApplicationDemoState', JSON.stringify({
        choiceCount: 3,
        schoolCount: 3,
        paidSchools: 2,
        totalFee: 40,
        submittedToSchools: false
      }))
    `);
    await navigate(cdp, "hub.html?motion=off");
    await waitFor(cdp, "document.querySelector('[data-application-title]')?.textContent.includes('Ready to review')", "Hub existing application entry");
    await assertNoHorizontalOverflow(cdp, "Hub existing application entry");
    await assertElementInViewport(cdp, ".application-current-card", "Hub current application card");
    await assertElementInViewport(cdp, ".application-start-card", "Hub add school choice card");
    await assertClickableCenter(cdp, ".application-top-action", "Hub continue application action");
    await assertClickableCenter(cdp, ".application-start-card", "Hub add school choice action");
    await waitFor(cdp, "document.querySelector('.application-start-card')?.getAttribute('href') === 'application.html'", "Hub new choice points to application center");
  });

  await runStep(`${viewport.name}: favourites shared saved-items layout stays usable`, async () => {
    await setStudentAuthPreview(cdp);
    await navigate(cdp, "favourites.html?motion=off");
    await waitFor(cdp, "document.querySelector('[data-saved-grid]')?.textContent.includes('Computer Science MSc')", "Favourites shared saved items");
    await assertNoHorizontalOverflow(cdp, "Favourites");
    await assertElementInViewport(cdp, ".summary-band", "Favourites summary band");
    await assertElementInViewport(cdp, "[data-saved-grid]", "Favourites saved grid");
    await assertClickableCenter(cdp, "[data-saved-grid] [data-compare]", "Favourites compare action");
    await assertClickableCenter(cdp, "[data-saved-grid] [data-add-choice]", "Favourites add choice action");
  });

  await runStep(`${viewport.name}: notifications shared summary layout stays usable`, async () => {
    await setStudentAuthPreview(cdp);
    await navigate(cdp, "notifications.html?motion=off");
    await waitFor(cdp, "document.querySelector('[data-notification-list]')?.textContent.includes('Transcript translation still needs review')", "Notifications shared summary");
    await assertNoHorizontalOverflow(cdp, "Notifications");
    await assertElementInViewport(cdp, ".notice-pulse", "Notification summary pulse");
    await assertElementInViewport(cdp, "[data-priority-card]", "Notification priority card");
    await assertClickableCenter(cdp, "[data-mark-all-read]", "Mark all read action");
    await assertClickableCenter(cdp, "[data-quiet-pref=\"agent\"]", "Agent quiet setting");
  });

  await runStep(`${viewport.name}: preferences shared summary layout stays usable`, async () => {
    await setStudentAuthPreview(cdp);
    await navigate(cdp, "preferences.html#agent");
    await waitFor(cdp, "document.querySelector('[data-profile-chips]')?.textContent.includes('Computer Science')", "Preferences shared summary");
    await assertNoHorizontalOverflow(cdp, "Preferences");
    await assertElementInViewport(cdp, ".preference-shell", "Preference shell");
    await assertElementInViewport(cdp, "[data-agent-memory-panel]", "Agent memory panel");
    await assertClickableCenter(cdp, "[data-clear-agent-memory]", "Clear memory action");
    await assertClickableCenter(cdp, "[data-section=\"notifications\"]", "Notifications section tab");
  });

  await runStep(`${viewport.name}: school portal dashboard layout stays usable`, async () => {
    await setRoleAuthPreview(cdp, {
      selectedSurface: "school_staff",
      role: "school_staff",
      surface: "school-staff",
      accessGrantStatus: "approved-preview",
      accessGrantType: "school_staff_membership",
      accessGrantSource: "invite_code_preview",
      accessGrantScope: "Zhejiang University",
      userName: "Zhejiang University",
      userInitial: "Z",
    });
    await navigate(cdp, "school-portal.html?motion=off");
    await waitFor(cdp, "Boolean(document.querySelector('.teacher-ops'))", "teacher operations panel");
    await assertNoHorizontalOverflow(cdp, "School portal");
    await assertElementInViewport(cdp, ".teacher-ops", "Teacher operations panel");
    await assertClickableCenter(cdp, "[data-mark-contacted]", "Mark contacted action");
  });

  await runStep(`${viewport.name}: school settings layout stays usable`, async () => {
    await setRoleAuthPreview(cdp, {
      selectedSurface: "school_staff",
      role: "school_staff",
      surface: "school-staff",
      accessGrantStatus: "approved-preview",
      accessGrantType: "school_staff_membership",
      accessGrantSource: "invite_code_preview",
      accessGrantScope: "Zhejiang University",
      userName: "Zhejiang University",
      userInitial: "Z",
    });
    await navigate(cdp, "school-settings.html?motion=off");
    await waitFor(cdp, "Boolean(document.querySelector('[data-school-template]'))", "School settings template");
    await assertNoHorizontalOverflow(cdp, "School settings");
    await assertElementInViewport(cdp, "[data-school-template]", "School settings template editor");
    await assertClickableCenter(cdp, "[data-school-settings-save]", "School settings save action");
  });

  await runStep(`${viewport.name}: ops admin layout stays usable`, async () => {
    await setRoleAuthPreview(cdp, {
      selectedSurface: "cuac_internal",
      role: "cuac_ops",
      surface: "cuac-internal",
      accessGrantStatus: "approved-preview",
      accessGrantType: "cuac_staff_access_grant",
      accessGrantSource: "team_invite_preview",
      accessGrantScope: "CUAC Ops",
      userName: "CUAC Ops",
      userInitial: "C",
    });
    await navigate(cdp, "ops-admin.html?motion=off");
    await waitFor(cdp, "Boolean(document.querySelector('[data-ops-action=\"retry-routing\"]'))", "Ops retry action");
    await assertNoHorizontalOverflow(cdp, "Ops admin");
    await assertOpsAdminNotBlank(cdp, "Ops admin initial route");
    await assertElementInViewport(cdp, ".ops-tab-nav", "Ops tab navigation");
    await assertClickableCenter(cdp, "[data-ops-tab=\"school\"]", "Ops school tab");
    await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]').click()");
    await waitFor(cdp, "!document.querySelector('[data-ops-section=\"school\"]').hidden", "Ops school section");
    await assertOpsAdminNotBlank(cdp, "Ops school tab route");
    await assertElementInViewport(cdp, ".ops-school-management", "Ops school data management");
    await assertClickableCenter(cdp, "[data-ops-action=\"edit-school\"]", "Ops edit school action");
    for (const view of ["catalog", "edit", "preview", "model"]) {
      await evaluate(cdp, `document.querySelector('[data-ops-school-view="${view}"]')?.click()`);
      await waitFor(cdp, `document.querySelector('[data-ops-school-view="${view}"]')?.classList.contains('active') && !document.querySelector('[data-ops-school-view-panel="${view}"]')?.hidden`, `Ops school ${view} view`);
      await assertOpsAdminNotBlank(cdp, `Ops school ${view} view`);
      await assertNoHorizontalOverflow(cdp, `Ops school ${view} view`);
    }
    await evaluate(cdp, "document.querySelector('[data-ops-school-view=\"edit\"]')?.click()");
    await waitFor(cdp, "!document.querySelector('[data-ops-school-view-panel=\"edit\"]')?.hidden", "Ops school edit view before editor tabs");
    for (const tab of ["overview", "basic", "admissions", "costs", "contact", "programs", "scholarships", "source", "logs"]) {
      await evaluate(cdp, `document.querySelector('[data-ops-school-tab="${tab}"]')?.click()`);
      await waitFor(cdp, `document.querySelector('[data-ops-school-tab="${tab}"]')?.classList.contains('active')`, `Ops school ${tab} editor tab`);
      await assertOpsAdminNotBlank(cdp, `Ops school ${tab} editor route`);
    }
    await evaluate(cdp, "document.querySelector('[data-ops-tab=\"students\"]').click()");
    await waitFor(cdp, "!document.querySelector('[data-ops-section=\"students\"]').hidden", "Ops students section");
    await assertOpsAdminNotBlank(cdp, "Ops students tab route");
    await assertElementInViewport(cdp, ".ops-student-management", "Ops student management");
    for (const tab of ["overview", "handoff", "account", "timeline", "edit"]) {
      await evaluate(cdp, `document.querySelector('[data-ops-student-detail-tab="${tab}"]')?.click()`);
      await waitFor(cdp, `!document.querySelector('[data-ops-student-detail-panel="${tab}"]')?.hidden`, `Ops student ${tab} detail tab`);
      await assertOpsAdminNotBlank(cdp, `Ops student ${tab} detail route`);
    }
    for (const action of ["contacted", "resend", "payment", "refresh-agent"]) {
      await evaluate(cdp, `document.querySelector('[data-ops-student-action="${action}"]')?.click()`);
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-section=\"students\"]:not([hidden]) [data-ops-student-detail]'))", `Ops student ${action} action keeps detail`);
      await assertOpsAdminNotBlank(cdp, `Ops student ${action} action`);
    }
    await evaluate(cdp, "document.querySelector('[data-ops-student-action=\"disable-account\"]')?.click()");
    await waitFor(cdp, "Boolean(document.querySelector('[data-ops-student-action=\"restore-account\"]'))", "Ops student disable account swaps to restore");
    await assertOpsAdminNotBlank(cdp, "Ops student disable account action");
    await evaluate(cdp, "document.querySelector('[data-ops-student-action=\"restore-account\"]')?.click()");
    await waitFor(cdp, "Boolean(document.querySelector('[data-ops-student-action=\"disable-account\"]'))", "Ops student restore account swaps to disable");
    await assertOpsAdminNotBlank(cdp, "Ops student restore account action");
    await evaluate(cdp, "document.querySelector('[data-ops-student-save]')?.click()");
    await waitFor(cdp, "Boolean(document.querySelector('[data-ops-section=\"students\"]:not([hidden]) [data-ops-student-detail]'))", "Ops student save keeps detail");
    await assertOpsAdminNotBlank(cdp, "Ops student save action");
    await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
    await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden", "Ops content section");
    await assertElementInViewport(cdp, "[data-ops-content-command-center]", "Ops content command center");
    await evaluate(cdp, "document.querySelector('[data-ops-content-view=\"edit\"]')?.click()");
    await waitFor(cdp, "!document.querySelector('[data-ops-content-view-panel=\"edit\"]')?.hidden", "Ops content edit view");
    await assertElementInViewport(cdp, "[data-ops-content-editor-brief]", "Ops content editor brief", { vertical: true });
    for (const type of ["cities", "scholarships", "timeline"]) {
      await evaluate(cdp, `document.querySelector('[data-ops-content-tab="${type}"]')?.click()`);
      await waitFor(cdp, `document.querySelector('[data-ops-content-tab="${type}"]')?.classList.contains('active')`, `Ops content ${type} tab`);
      await assertOpsAdminNotBlank(cdp, `Ops content ${type} route`);
      await assertNoHorizontalOverflow(cdp, `Ops content ${type} route`);
      for (const view of ["catalog", "edit", "preview", "model"]) {
        await evaluate(cdp, `document.querySelector('[data-ops-content-view="${view}"]')?.click()`);
        await waitFor(cdp, `document.querySelector('[data-ops-content-view="${view}"]')?.classList.contains('active') && !document.querySelector('[data-ops-content-view-panel="${view}"]')?.hidden`, `Ops content ${type} ${view} view`);
        await assertOpsAdminNotBlank(cdp, `Ops content ${type} ${view} view`);
        await assertNoHorizontalOverflow(cdp, `Ops content ${type} ${view} view`);
      }
    }
    await evaluate(cdp, "document.querySelector('[data-ops-tab=\"access\"]').click()");
    await waitFor(cdp, "!document.querySelector('[data-ops-section=\"access\"]').hidden", "Ops access section");
    for (const view of ["accounts", "invites", "agent", "boundary"]) {
      await evaluate(cdp, `document.querySelector('[data-ops-access-view="${view}"]')?.click()`);
      await waitFor(cdp, `document.querySelector('[data-ops-access-view="${view}"]')?.classList.contains('active') && !document.querySelector('[data-ops-access-view-panel="${view}"]')?.hidden`, `Ops access ${view} view`);
      await assertOpsAdminNotBlank(cdp, `Ops access ${view} view`);
      await assertNoHorizontalOverflow(cdp, `Ops access ${view} view`);
    }
    for (const route of ["#overview", "#school/catalog/overview", "#school/edit/basic", "#school/edit/programs", "#school/preview/overview", "#school/model/logs", "#content/scholarships/catalog", "#content/scholarships/edit", "#content/scholarships/preview", "#content/scholarships/model", "#content/timeline/catalog", "#content/timeline/edit", "#content/timeline/preview", "#content/timeline/model", "#students/handoff", "#students/account", "#access/accounts", "#access/invites", "#access/agent", "#access/boundary", "#queue/work", "#queue/audit", "#queue/support", "#queue/agent"]) {
      await navigate(cdp, `ops-admin.html?motion=off${route}`);
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-section]:not([hidden])'))", `Ops hash route ${route}`);
      await assertOpsAdminNotBlank(cdp, `Ops hash route ${route}`);
      await assertNoHorizontalOverflow(cdp, `Ops hash route ${route}`);
    }
    await evaluate(cdp, "document.querySelector('[data-ops-tab=\"queue\"]').click()");
    await waitFor(cdp, "!document.querySelector('[data-ops-section=\"queue\"]').hidden", "Ops queue section");
    await evaluate(cdp, "document.querySelector('[data-ops-queue-view=\"work\"]')?.click()");
    await waitFor(cdp, "!document.querySelector('[data-ops-queue-view-panel=\"work\"]')?.hidden", "Ops queue work view before retry click");
    await assertOpsAdminNotBlank(cdp, "Ops queue tab route");
    await assertElementInViewport(cdp, ".ops-queue", "Ops admin queue");
    await assertClickableCenter(cdp, "[data-ops-action=\"retry-routing\"]", "Ops retry action");
    for (const view of ["audit", "support", "agent", "work"]) {
      await evaluate(cdp, `document.querySelector('[data-ops-queue-view="${view}"]')?.click()`);
      await waitFor(cdp, `document.querySelector('[data-ops-queue-view="${view}"]')?.classList.contains('active') && !document.querySelector('[data-ops-queue-view-panel="${view}"]')?.hidden`, `Ops queue ${view} view`);
      await assertOpsAdminNotBlank(cdp, `Ops queue ${view} view`);
      await assertNoHorizontalOverflow(cdp, `Ops queue ${view} view`);
    }
  });

  await runStep(`${viewport.name}: agent panel layout keeps composer usable`, async () => {
    await evaluate(cdp, "localStorage.clear()");
    await navigate(cdp, "programs.html?motion=off");
    await waitFor(cdp, "Boolean(document.querySelector('[data-cuac-agent-form]'))", "Agent form");
    await evaluate(cdp, `
      (() => {
        const input = document.querySelector('[data-cuac-agent-input]');
        const form = document.querySelector('[data-cuac-agent-form]');
        input.value = 'compare English taught CS programs';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        form.requestSubmit();
        return true;
      })()
    `);
    await waitFor(cdp, "document.querySelector('[data-cuac-agent-panel]')?.classList.contains('open')", "Agent panel");
    await waitFor(
      cdp,
      "(() => { const panel = document.querySelector('.cuac-agent-panel.open'); if (!panel) return false; const rect = panel.getBoundingClientRect(); return rect.right <= window.innerWidth + 1 && rect.left >= -1; })()",
      "Agent panel settled in viewport",
    );
    await assertNoHorizontalOverflow(cdp, "Agent panel");
    await assertElementInViewport(cdp, ".cuac-agent-panel.open", "Agent panel", { vertical: true });
    await assertClickableCenter(cdp, "[data-cuac-agent-input]", "Agent panel composer input");
  });
}

async function main() {
  await withBrowser(async (cdp) => {
    for (const viewport of viewports) {
      await exerciseViewport(cdp, viewport);
    }
  });

  console.log("CUAC layout browser QA passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
