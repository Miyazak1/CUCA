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
if (!chromePath) throw new Error("Chrome was not found. Set CHROME_PATH to run ops admin click QA.");

const root = path.resolve(process.env.CUAC_QA_ROOT || path.resolve(__dirname, "..", "public"));
const port = Number(process.env.CUAC_OPS_CLICK_QA_PORT || 9850 + (process.pid % 400));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pageUrl(file) {
  return `file:///${path.join(root, file).replaceAll("\\", "/")}`;
}

function waitForProcessExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", resolve);
  });
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

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
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

async function navigate(cdp, file) {
  await cdp.send("Page.navigate", { url: pageUrl(file) });
  await waitFor(cdp, "document.readyState !== 'loading'", `${file} DOM ready`, 10000);
  await sleep(350);
}

async function clickSelector(cdp, selector) {
  const point = await evaluate(cdp, `
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing selector: ${selector}');
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) throw new Error('Selector is not visible: ${selector}');
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function installRuntimeErrorTrap(cdp) {
  await evaluate(cdp, `
    (() => {
      window.__cuacRuntimeErrors = [];
      if (window.__cuacRuntimeErrorTrapInstalled) return;
      window.__cuacRuntimeErrorTrapInstalled = true;
      window.addEventListener('error', (event) => {
        window.__cuacRuntimeErrors.push(event.message || 'runtime error');
      });
      window.addEventListener('unhandledrejection', (event) => {
        window.__cuacRuntimeErrors.push(event.reason?.message || String(event.reason || 'unhandled rejection'));
      });
    })()
  `);
}

async function assertOpsAdminUsable(cdp, label, expectedSection = "", expectedNested = "") {
  const snapshot = await evaluate(cdp, `
    (() => {
      const root = document.querySelector('[data-detail-root]');
      const activeSections = [...document.querySelectorAll('[data-ops-section]:not([hidden])')].map((item) => item.dataset.opsSection || '');
      const activePanel = document.querySelector('[data-ops-section]:not([hidden])');
      const section = activePanel?.dataset.opsSection || '';
      const nestedSelectors = {
        school: '[data-ops-school-view-panel]:not([hidden])',
        content: '[data-ops-content-view-panel]:not([hidden])',
        students: '[data-ops-student-detail-panel]:not([hidden])',
        access: '[data-ops-access-view-panel]:not([hidden])',
        queue: '[data-ops-queue-view-panel]:not([hidden])',
      };
      const nestedAttr = {
        school: 'opsSchoolViewPanel',
        content: 'opsContentViewPanel',
        students: 'opsStudentDetailPanel',
        access: 'opsAccessViewPanel',
        queue: 'opsQueueViewPanel',
      };
      const nestedSelector = nestedSelectors[section] || '';
      const activeNested = nestedSelector ? document.querySelector(nestedSelector) : null;
      const visibleNestedPanels = nestedSelector ? [...document.querySelectorAll(nestedSelector)].length : null;
      const activeTextLength = activePanel?.textContent?.trim().length || 0;
      const errors = window.__cuacRuntimeErrors || [];
      return {
        hash: location.hash,
        hasRoot: Boolean(root),
        activeSections,
        section,
        expectedSection: ${JSON.stringify(expectedSection)},
        activeTextLength,
        rootTextLength: root?.textContent?.trim().length || 0,
        hasErrorState: Boolean(root?.querySelector('.ops-error-state')),
        visibleNestedPanels,
        activeNested: activeNested && nestedAttr[section] ? activeNested.dataset[nestedAttr[section]] || '' : '',
        errors,
      };
    })()
  `);

  const wrongSection = expectedSection && snapshot.section !== expectedSection;
  const nestedMissing = snapshot.visibleNestedPanels !== null && snapshot.visibleNestedPanels < 1;
  const wrongNested = expectedNested && snapshot.activeNested !== expectedNested;
  if (
    !snapshot.hasRoot
    || snapshot.activeSections.length !== 1
    || wrongSection
    || wrongNested
    || snapshot.hasErrorState
    || snapshot.activeTextLength < 180
    || nestedMissing
    || snapshot.errors.length
  ) {
    throw new Error(`${label} blank after click: ${JSON.stringify(snapshot)}`);
  }
  console.log(`ok ${label}: ${snapshot.hash || '#overview'} / ${snapshot.section} / ${snapshot.activeTextLength} chars`);
}

async function setOpsAuth(cdp) {
  await navigate(cdp, "home-v3.html?motion=off");
  await evaluate(cdp, `
    (() => {
      localStorage.clear();
      localStorage.setItem('cuacAuthDemoState', JSON.stringify({
        authState: 'signed-in',
        selectedSurface: 'cuac_internal',
        role: 'cuac_ops',
        surface: 'cuac-internal',
        accessGrantStatus: 'approved-preview',
        accessGrantType: 'cuac_staff_access_grant',
        accessGrantSource: 'team_invite_preview',
        accessGrantScope: 'CUAC Ops',
        userName: 'CUAC Ops',
        userInitial: 'C'
      }));
    })()
  `);
}

async function clickAndAssert(cdp, selector, label, expectedSection, expectedNested = "") {
  await clickSelector(cdp, selector);
  await assertOpsAdminUsable(cdp, `${label} immediate`, expectedSection, expectedNested);
  await sleep(80);
  await assertOpsAdminUsable(cdp, `${label} settled`, expectedSection, expectedNested);
  await sleep(420);
  await assertOpsAdminUsable(cdp, label, expectedSection, expectedNested);
}

async function assertSchoolEditorTab(cdp, expectedTab, label) {
  const snapshot = await evaluate(cdp, `
    (() => ({
      hash: location.hash,
      activeTab: document.querySelector('[data-ops-school-tab].active')?.dataset.opsSchoolTab || '',
      editorTextLength: document.querySelector('[data-ops-school-editor]')?.textContent?.trim().length || 0,
      errors: window.__cuacRuntimeErrors || []
    }))()
  `);
  if (snapshot.activeTab !== expectedTab || snapshot.editorTextLength < 600 || snapshot.errors.length) {
    throw new Error(`${label} did not render school editor tab: ${JSON.stringify(snapshot)}`);
  }
  console.log(`ok ${label}: ${snapshot.hash} / ${snapshot.activeTab} / ${snapshot.editorTextLength} chars`);
}

async function assertOpsAdminVisiblyUsable(cdp, label, expectedSection = "", expectedNested = "") {
  await assertOpsAdminUsable(cdp, label, expectedSection, expectedNested);
  const snapshot = await evaluate(cdp, `
    (() => {
      const activePanel = document.querySelector('[data-ops-section]:not([hidden])');
      const nested = document.querySelector('[data-ops-school-view-panel]:not([hidden])');
      const activeStyle = activePanel ? getComputedStyle(activePanel) : null;
      const nestedStyle = nested ? getComputedStyle(nested) : null;
      const activeRect = activePanel?.getBoundingClientRect();
      return {
        hash: location.hash,
        section: activePanel?.dataset.opsSection || '',
        nested: nested?.dataset.opsSchoolViewPanel || '',
        activeOpacity: activeStyle ? Number(activeStyle.opacity) : 0,
        nestedOpacity: nestedStyle ? Number(nestedStyle.opacity) : 1,
        activeVisibleClass: activePanel?.classList.contains('visible') || false,
        activeRect: activeRect ? { width: activeRect.width, height: activeRect.height } : null,
        rootTextLength: document.querySelector('[data-detail-root]')?.innerText?.trim().length || 0
      };
    })()
  `);
  const wrongSection = expectedSection && snapshot.section !== expectedSection;
  const wrongNested = expectedNested && snapshot.nested !== expectedNested;
  if (
    wrongSection
    || wrongNested
    || snapshot.activeOpacity < 0.85
    || snapshot.nestedOpacity < 0.85
    || !snapshot.activeVisibleClass
    || !snapshot.activeRect
    || snapshot.activeRect.width < 200
    || snapshot.activeRect.height < 80
  ) {
    throw new Error(`${label} rendered but not visibly usable: ${JSON.stringify(snapshot)}`);
  }
  console.log(`ok ${label} visible: ${snapshot.hash} / opacity ${snapshot.activeOpacity}`);
}

async function setHashAndAssert(cdp, hash, label, expectedSection, expectedNested = "") {
  await evaluate(cdp, `location.hash = ${JSON.stringify(hash)}`);
  await sleep(80);
  await assertOpsAdminUsable(cdp, `${label} settled`, expectedSection, expectedNested);
  await sleep(420);
  await assertOpsAdminUsable(cdp, label, expectedSection, expectedNested);
}

async function assertOpsSchoolLayoutMatrix(cdp) {
  const routes = [
    ["#school/catalog", "catalog"],
    ["#school/edit/overview", "edit"],
    ["#school/edit/admissions", "edit"],
    ["#school/edit/programs", "edit"],
    ["#school/preview", "preview"],
    ["#school/model", "model"],
  ];
  const viewports = [
    ["desktop", 1440, 950, false],
    ["mobile", 390, 844, true],
  ];
  for (const [viewportLabel, width, height, mobile] of viewports) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    for (const [hash, expectedView] of routes) {
      await navigate(cdp, `ops-admin.html?motion=off${hash}`);
      await installRuntimeErrorTrap(cdp);
      await sleep(500);
      const snapshot = await evaluate(cdp, `
        (() => {
          const activePanel = document.querySelector('[data-ops-section]:not([hidden])');
          const schoolPanel = document.querySelector('[data-ops-school-view-panel]:not([hidden])');
          const editor = document.querySelector('[data-ops-school-editor]');
          const root = document.querySelector('[data-detail-root]');
          const viewportWidth = document.documentElement.clientWidth;
          const overflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
          const offenders = [...document.body.querySelectorAll('*')]
            .map((element) => ({ element, rect: element.getBoundingClientRect(), style: getComputedStyle(element) }))
            .filter(({ rect, style }) => (
              rect.width > 0
              && rect.height > 0
              && style.position !== 'fixed'
              && style.overflowX !== 'auto'
              && style.overflowX !== 'scroll'
              && rect.right > viewportWidth + 1
            ))
            .slice(0, 5)
            .map(({ element, rect }) => ({
              tag: element.tagName,
              className: String(element.className || ''),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }));
          return {
            hash: location.hash,
            section: activePanel?.dataset.opsSection || '',
            schoolView: schoolPanel?.dataset.opsSchoolViewPanel || '',
            editorTextLength: editor?.textContent?.trim().length || 0,
            panelTextLength: schoolPanel?.textContent?.trim().length || 0,
            rootTextLength: root?.textContent?.trim().length || 0,
            overflow,
            offenders,
            errors: window.__cuacRuntimeErrors || [],
          };
        })()
      `);
      if (
        snapshot.section !== "school"
        || snapshot.schoolView !== expectedView
        || snapshot.panelTextLength < 420
        || snapshot.rootTextLength < 1200
        || snapshot.overflow > 1
        || snapshot.errors.length
      ) {
        throw new Error(`school layout failed ${viewportLabel} ${hash}: ${JSON.stringify(snapshot)}`);
      }
      console.log(`ok school layout ${viewportLabel} ${hash}: overflow ${snapshot.overflow} / ${snapshot.schoolView} / ${snapshot.panelTextLength} chars`);
    }
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

async function assertOpsContentLayoutMatrix(cdp) {
  const routes = [
    ["#content/cities/catalog", "cities", "catalog"],
    ["#content/cities/edit", "cities", "edit"],
    ["#content/cities/preview", "cities", "preview"],
    ["#content/cities/model", "cities", "model"],
    ["#content/scholarships/catalog", "scholarships", "catalog"],
    ["#content/scholarships/edit", "scholarships", "edit"],
    ["#content/scholarships/preview", "scholarships", "preview"],
    ["#content/scholarships/model", "scholarships", "model"],
    ["#content/timeline/catalog", "timeline", "catalog"],
    ["#content/timeline/edit", "timeline", "edit"],
    ["#content/timeline/preview", "timeline", "preview"],
    ["#content/timeline/model", "timeline", "model"],
  ];
  const viewports = [
    ["desktop", 1440, 950, false],
    ["mobile", 390, 844, true],
  ];
  for (const [viewportLabel, width, height, mobile] of viewports) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    for (const [hash, expectedType, expectedView] of routes) {
      await navigate(cdp, `ops-admin.html?motion=off${hash}`);
      await installRuntimeErrorTrap(cdp);
      await sleep(500);
      const snapshot = await evaluate(cdp, `
        (() => {
          const expectedContentType = ${JSON.stringify(expectedType)};
          const expectedContentView = ${JSON.stringify(expectedView)};
          const activePanel = document.querySelector('[data-ops-section]:not([hidden])');
          const contentPanel = document.querySelector('[data-ops-content-view-panel]:not([hidden])');
          const activeType = document.querySelector('[data-ops-content-tab].active')?.dataset.opsContentTab || '';
          const root = document.querySelector('[data-detail-root]');
          const viewportWidth = document.documentElement.clientWidth;
          const overflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
          const offenders = [...document.body.querySelectorAll('*')]
            .map((element) => ({ element, rect: element.getBoundingClientRect(), style: getComputedStyle(element) }))
            .filter(({ rect, style }) => (
              rect.width > 0
              && rect.height > 0
              && style.position !== 'fixed'
              && style.overflowX !== 'auto'
              && style.overflowX !== 'scroll'
              && rect.right > viewportWidth + 1
            ))
            .slice(0, 5)
            .map(({ element, rect }) => ({
              tag: element.tagName,
              className: String(element.className || ''),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }));
          return {
            hash: location.hash,
            section: activePanel?.dataset.opsSection || '',
            activeType,
            contentView: contentPanel?.dataset.opsContentViewPanel || '',
            visibleEditorPanels: [...document.querySelectorAll('[data-ops-content-view-panel]:not([hidden]) [data-ops-content-editor-panel]')]
              .filter((panel) => !panel.hidden && panel.getBoundingClientRect().height > 0)
              .length,
            previewCanvasCount: [...document.querySelectorAll('[data-ops-content-view-panel]:not([hidden]) .ops-content-preview-canvas')]
              .filter((panel) => panel.getBoundingClientRect().height > 0)
              .length,
            previewHeroCount: contentPanel?.querySelectorAll('.ops-content-preview-hero').length || 0,
            previewFeatureCount: contentPanel?.querySelectorAll('.ops-content-preview-feature').length || 0,
            previewMetricCount: contentPanel?.querySelectorAll('.ops-content-preview-metric-row article').length || 0,
            previewCheckCount: contentPanel?.querySelectorAll('.ops-content-preview-checks .ops-content-preview-check-list article').length || 0,
            cityPreviewRawTokenCount: expectedContentType === 'cities' && expectedContentView === 'preview'
              ? [...contentPanel.querySelectorAll('.ops-content-preview-step-list span, .ops-preview-tag-row span')]
                .map((node) => node.textContent.trim().replace(/^\d+\s*/, '').toLowerCase())
                .filter((text) => ['tech', 'calmer pace', 'medium cost', 'tech city', 'good first city', 'east china'].includes(text))
                .length
              : 0,
            scholarshipPreviewRawTokenCount: expectedContentType === 'scholarships' && expectedContentView === 'preview'
              ? [...contentPanel.querySelectorAll('.ops-content-preview-feature strong, .ops-content-preview-step-list span, .ops-preview-tag-row span, .ops-content-preview-check-list small')]
                .map((node) => node.textContent.trim().replace(/^\d+\s*/, '').toLowerCase())
                .filter((text) => ['multiple universities', 'confirm by scholarship notice', 'tuition', 'stipend', 'accommodation', 'insurance', 'government', 'master / phd', 'scholarship record', 'full or broad funding route'].includes(text))
                .length
              : 0,
            panelTextLength: contentPanel?.textContent?.trim().length || 0,
            rootTextLength: root?.textContent?.trim().length || 0,
            overflow,
            offenders,
            errors: window.__cuacRuntimeErrors || [],
          };
        })()
      `);
      if (
        snapshot.section !== "content"
        || snapshot.activeType !== expectedType
        || snapshot.contentView !== expectedView
        || snapshot.panelTextLength < 360
        || snapshot.rootTextLength < 1100
        || (expectedView === "edit" && snapshot.visibleEditorPanels !== 1)
        || (expectedView === "preview" && (
          snapshot.previewCanvasCount !== 1
          || snapshot.previewHeroCount < 1
          || snapshot.previewFeatureCount < 2
          || snapshot.previewMetricCount < 3
          || snapshot.previewCheckCount < 3
        ))
        || snapshot.cityPreviewRawTokenCount > 0
        || snapshot.scholarshipPreviewRawTokenCount > 0
        || snapshot.overflow > 1
        || snapshot.errors.length
      ) {
        throw new Error(`content layout failed ${viewportLabel} ${hash}: ${JSON.stringify(snapshot)}`);
      }
      console.log(`ok content layout ${viewportLabel} ${hash}: overflow ${snapshot.overflow} / ${snapshot.activeType}/${snapshot.contentView} / ${snapshot.panelTextLength} chars`);
    }
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

async function assertOpsStudentLayoutMatrix(cdp) {
  const routes = [
    ["#students/overview", "overview"],
    ["#students/handoff", "handoff"],
    ["#students/account", "account"],
    ["#students/timeline", "timeline"],
    ["#students/edit", "edit"],
  ];
  const viewports = [
    ["desktop", 1440, 950, false],
    ["mobile", 390, 844, true],
  ];
  for (const [viewportLabel, width, height, mobile] of viewports) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    for (const [hash, expectedTab] of routes) {
      await navigate(cdp, `ops-admin.html?motion=off${hash}`);
      await installRuntimeErrorTrap(cdp);
      await sleep(500);
      const snapshot = await evaluate(cdp, `
        (() => {
          const activePanel = document.querySelector('[data-ops-section]:not([hidden])');
          const detailPanel = document.querySelector('[data-ops-student-detail-panel]:not([hidden])');
          const root = document.querySelector('[data-detail-root]');
          const viewportWidth = document.documentElement.clientWidth;
          const overflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
          const offenders = [...document.body.querySelectorAll('*')]
            .map((element) => ({ element, rect: element.getBoundingClientRect(), style: getComputedStyle(element) }))
            .filter(({ rect, style }) => (
              rect.width > 0
              && rect.height > 0
              && style.position !== 'fixed'
              && style.overflowX !== 'auto'
              && style.overflowX !== 'scroll'
              && rect.right > viewportWidth + 1
            ))
            .slice(0, 5)
            .map(({ element, rect }) => ({
              tag: element.tagName,
              className: String(element.className || ''),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }));
          return {
            hash: location.hash,
            section: activePanel?.dataset.opsSection || '',
            studentTab: detailPanel?.dataset.opsStudentDetailPanel || '',
            portfolioMetricCount: document.querySelectorAll('[data-ops-section="students"] .ops-student-portfolio-metrics article').length,
            portfolioChartCount: document.querySelectorAll('[data-ops-section="students"] .ops-student-portfolio-charts .ops-chart-panel').length,
            stageFlowCount: document.querySelectorAll('[data-ops-section="students"] .ops-student-stage-flow article').length,
            portfolioText: document.querySelector('[data-ops-section="students"] .ops-student-portfolio-dashboard')?.textContent || '',
            searchPlaceholder: document.querySelector('[data-ops-student-search]')?.getAttribute('placeholder') || '',
            cardReasonCount: document.querySelectorAll('[data-ops-section="students"] .ops-student-card-reason').length,
            cardPrimaryCount: document.querySelectorAll('[data-ops-section="students"] .ops-student-card-actions .primary-action').length,
            workbenchColumns: getComputedStyle(document.querySelector('[data-ops-section="students"] .ops-student-workbench') || document.body).gridTemplateColumns,
            gateCount: detailPanel?.querySelectorAll('.ops-student-gate-board article').length || 0,
            readinessCount: detailPanel?.querySelectorAll('.ops-student-readiness-grid article').length || 0,
            handoffSummaryCount: detailPanel?.querySelectorAll('.ops-student-handoff-summary span').length || 0,
            choiceFlowCount: detailPanel?.querySelectorAll('.ops-student-choice-flow').length || 0,
            choiceStepCount: detailPanel?.querySelectorAll('.ops-student-choice-steps span').length || 0,
            accountControlCount: detailPanel?.querySelectorAll('.ops-student-account-control article').length || 0,
            accountFactCount: detailPanel?.querySelectorAll('.ops-account-grid article').length || 0,
            timelineBriefCount: detailPanel?.querySelectorAll('.ops-student-timeline-brief article').length || 0,
            timelineActorCount: detailPanel?.querySelectorAll('.ops-student-timeline-actors article').length || 0,
            timelineImpactCount: detailPanel?.querySelectorAll('.ops-student-timeline-impact article').length || 0,
            timelineCount: detailPanel?.querySelectorAll('.ops-change-log article').length || 0,
            editImpactCount: detailPanel?.querySelectorAll('.ops-student-edit-impact article').length || 0,
            editorFieldCount: detailPanel?.querySelectorAll('[data-ops-student-field]').length || 0,
            detailTextLength: detailPanel?.textContent?.trim().length || 0,
            rootTextLength: root?.textContent?.trim().length || 0,
            overflow,
            offenders,
            errors: window.__cuacRuntimeErrors || [],
          };
        })()
      `);
      if (
        snapshot.section !== "students"
        || snapshot.studentTab !== expectedTab
        || snapshot.detailTextLength < 500
        || snapshot.rootTextLength < 2500
        || snapshot.portfolioMetricCount < 6
        || snapshot.portfolioChartCount < 6
        || snapshot.stageFlowCount < 6
        || !snapshot.portfolioText.includes("注册学生")
        || !snapshot.portfolioText.includes("学校已处理")
        || !snapshot.searchPlaceholder.includes("HSK")
        || !snapshot.searchPlaceholder.includes("CSCA")
        || snapshot.cardReasonCount < 1
        || snapshot.cardPrimaryCount < 1
        || (!mobile && snapshot.workbenchColumns.split(" ").length < 2)
        || (expectedTab === "overview" && (snapshot.gateCount < 4 || snapshot.readinessCount < 4))
        || (expectedTab === "handoff" && (snapshot.handoffSummaryCount < 4 || snapshot.choiceFlowCount < 1 || snapshot.choiceStepCount < 4))
        || (expectedTab === "account" && (snapshot.accountControlCount < 4 || snapshot.accountFactCount < 4))
        || (expectedTab === "timeline" && (snapshot.timelineBriefCount < 3 || snapshot.timelineActorCount < 3 || snapshot.timelineImpactCount < 4 || snapshot.timelineCount < 1))
        || (expectedTab === "edit" && (snapshot.editImpactCount < 3 || snapshot.editorFieldCount < 24))
        || snapshot.overflow > 1
        || snapshot.errors.length
      ) {
        throw new Error(`student layout failed ${viewportLabel} ${hash}: ${JSON.stringify(snapshot)}`);
      }
      console.log(`ok student layout ${viewportLabel} ${hash}: overflow ${snapshot.overflow} / ${snapshot.studentTab} / ${snapshot.detailTextLength} chars`);
    }
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

async function assertOpsGovernanceLayoutMatrix(cdp) {
  const routes = [
    ["#access/accounts", "access", "accounts"],
    ["#access/invites", "access", "invites"],
    ["#access/agent", "access", "agent"],
    ["#access/boundary", "access", "boundary"],
    ["#queue/work", "queue", "work"],
    ["#queue/audit", "queue", "audit"],
    ["#queue/support", "queue", "support"],
    ["#queue/agent", "queue", "agent"],
  ];
  const viewports = [
    ["desktop", 1440, 950, false],
    ["mobile", 390, 844, true],
  ];
  for (const [viewportLabel, width, height, mobile] of viewports) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    for (const [hash, expectedSection, expectedView] of routes) {
      await navigate(cdp, `ops-admin.html?motion=off${hash}`);
      await installRuntimeErrorTrap(cdp);
      await sleep(500);
      const snapshot = await evaluate(cdp, `
        (() => {
          const activePanel = document.querySelector('[data-ops-section]:not([hidden])');
          const accessPanel = document.querySelector('[data-ops-access-view-panel]:not([hidden])');
          const queuePanel = document.querySelector('[data-ops-queue-view-panel]:not([hidden])');
          const root = document.querySelector('[data-detail-root]');
          const viewportWidth = document.documentElement.clientWidth;
          const overflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
          return {
            hash: location.hash,
            section: activePanel?.dataset.opsSection || '',
            accessView: accessPanel?.dataset.opsAccessViewPanel || '',
            queueView: queuePanel?.dataset.opsQueueViewPanel || '',
            accessMetricCount: document.querySelectorAll('[data-ops-section="access"] .ops-access-portfolio-metrics article').length,
            accessChartCount: document.querySelectorAll('[data-ops-section="access"] .ops-access-portfolio-charts .ops-chart-panel').length,
            accessFlowCount: document.querySelectorAll('[data-ops-section="access"] .ops-access-grant-flow article').length,
            accessPrimaryCount: document.querySelectorAll('[data-ops-section="access"] .ops-access-card-actions .primary-action').length,
            accessDecisionCount: document.querySelectorAll('[data-ops-section="access"] .ops-access-decision').length,
            accessRiskQueueCount: document.querySelectorAll('[data-ops-section="access"] .ops-access-risk-queue article').length,
            accessDetailGateCount: document.querySelectorAll('[data-ops-section="access"] .ops-access-detail-gates article').length,
            accessInviteFlowCount: document.querySelectorAll('[data-ops-section="access"] .ops-access-process-flow article').length,
            accessAgentBoundaryCount: document.querySelectorAll('[data-ops-section="access"] .ops-access-agent-boundary article').length,
            accessRoleMatrixCount: document.querySelectorAll('[data-ops-section="access"] .ops-access-role-matrix article').length,
            accessText: document.querySelector('[data-ops-section="access"] .ops-access-portfolio-dashboard')?.textContent || '',
            queueMetricCount: document.querySelectorAll('[data-ops-section="queue"] .ops-queue-portfolio-metrics article').length,
            queueChartCount: document.querySelectorAll('[data-ops-section="queue"] .ops-queue-portfolio-charts .ops-chart-panel').length,
            queueDecisionCount: document.querySelectorAll('[data-ops-section="queue"] .ops-queue-decision').length,
            queueRunbookCount: document.querySelectorAll('[data-ops-section="queue"] .ops-queue-runbook label').length,
            auditWorkbenchCount: document.querySelectorAll('[data-ops-section="queue"] .ops-audit-workbench').length,
            supportGuardrailCount: document.querySelectorAll('[data-ops-section="queue"] .ops-support-guardrail article').length,
            agentHealthCount: document.querySelectorAll('[data-ops-section="queue"] .ops-agent-health-decision').length,
            agentFailureCount: document.querySelectorAll('[data-ops-section="queue"] .ops-agent-failure-grid article').length,
            queueText: document.querySelector('[data-ops-section="queue"] .ops-queue-portfolio-dashboard')?.textContent || '',
            rootTextLength: root?.textContent?.trim().length || 0,
            overflow,
            errors: window.__cuacRuntimeErrors || [],
          };
        })()
      `);
      const activeView = expectedSection === "access" ? snapshot.accessView : snapshot.queueView;
      const metricCount = expectedSection === "access" ? snapshot.accessMetricCount : snapshot.queueMetricCount;
      const chartCount = expectedSection === "access" ? snapshot.accessChartCount : snapshot.queueChartCount;
      const dashboardText = expectedSection === "access" ? snapshot.accessText : snapshot.queueText;
      const requiredText = expectedSection === "access" ? ["权限治理总览", "Agent 复核"] : ["风险调度总览", "学校可见影响"];
      if (
        snapshot.section !== expectedSection
        || activeView !== expectedView
        || metricCount < 4
        || chartCount < 5
        || (expectedSection === "access" && snapshot.accessFlowCount < 6)
        || (expectedSection === "access" && snapshot.accessPrimaryCount < 1)
        || (hash === "#access/accounts" && snapshot.accessDecisionCount < 1)
        || (expectedSection === "access" && snapshot.accessRiskQueueCount < 1)
        || (hash === "#access/accounts" && snapshot.accessDetailGateCount < 5)
        || (hash === "#access/invites" && snapshot.accessInviteFlowCount < 5)
        || (hash === "#access/agent" && snapshot.accessAgentBoundaryCount < 4)
        || (hash === "#access/boundary" && snapshot.accessRoleMatrixCount < 4)
        || (hash === "#queue/work" && snapshot.queueDecisionCount < 1)
        || (hash === "#queue/work" && snapshot.queueRunbookCount < 3)
        || (hash === "#queue/audit" && snapshot.auditWorkbenchCount < 1)
        || (hash === "#queue/support" && snapshot.supportGuardrailCount < 3)
        || (hash === "#queue/agent" && snapshot.agentHealthCount < 1)
        || (hash === "#queue/agent" && snapshot.agentFailureCount < 4)
        || !requiredText.every((item) => dashboardText.includes(item))
        || snapshot.rootTextLength < 2500
        || snapshot.overflow > 1
        || snapshot.errors.length
      ) {
        throw new Error(`governance layout failed ${viewportLabel} ${hash}: ${JSON.stringify(snapshot)}`);
      }
      console.log(`ok governance layout ${viewportLabel} ${hash}: overflow ${snapshot.overflow} / ${activeView} / ${metricCount} metrics`);
    }
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

async function withBrowser(fn) {
  const userDataDir = path.join(os.tmpdir(), `cuac-ops-click-qa-${process.pid}-${Date.now()}`);
  const browser = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--allow-file-access-from-files",
      "--force-device-scale-factor=1",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
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
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

(async () => {
  await withBrowser(async (cdp) => {
    await setOpsAuth(cdp);
    await navigate(cdp, "ops-admin.html#overview");
    await installRuntimeErrorTrap(cdp);
    await waitFor(cdp, "Boolean(document.querySelector('[data-ops-tab]'))", "ops admin tabs without motion override");
    await sleep(700);
    await assertOpsAdminVisiblyUsable(cdp, "initial no-motion overview", "overview");
    await evaluate(cdp, "scrollTo(0, document.body.scrollHeight)");
    await sleep(120);
    await evaluate(cdp, "location.hash = '#school/edit/admissions'");
    await sleep(700);
    await assertOpsAdminVisiblyUsable(cdp, "no-motion hash school admissions", "school", "edit");
    await assertSchoolEditorTab(cdp, "admissions", "no-motion direct school admissions tab");
    await evaluate(cdp, "location.hash = '#school/catalog'");
    await sleep(700);
    await assertOpsAdminVisiblyUsable(cdp, "no-motion hash school catalog", "school", "catalog");
    await assertOpsSchoolLayoutMatrix(cdp);
    await assertOpsContentLayoutMatrix(cdp);
    await assertOpsStudentLayoutMatrix(cdp);
    await assertOpsGovernanceLayoutMatrix(cdp);

    await navigate(cdp, "ops-admin.html?motion=off#overview");
    await installRuntimeErrorTrap(cdp);
    await waitFor(cdp, "Boolean(document.querySelector('[data-ops-tab]'))", "ops admin tabs");
    await assertOpsAdminUsable(cdp, "initial load", "overview");

    await navigate(cdp, "ops-admin.html?motion=off#school/edit/admissions");
    await installRuntimeErrorTrap(cdp);
    await waitFor(cdp, "Boolean(document.querySelector('[data-ops-tab]'))", "direct school admissions route tabs");
    await assertOpsAdminUsable(cdp, "direct school admissions hash", "school", "edit");
    await assertSchoolEditorTab(cdp, "admissions", "direct school admissions tab");
    await setHashAndAssert(cdp, "#school/catalog/admissions", "school catalog hash fallback", "school", "catalog");

    for (const [section, selector] of [
      ["school", '[data-ops-tab="school"]'],
      ["content", '[data-ops-tab="content"]'],
      ["students", '[data-ops-tab="students"]'],
      ["access", '[data-ops-tab="access"]'],
      ["queue", '[data-ops-tab="queue"]'],
      ["overview", '[data-ops-tab="overview"]'],
    ]) {
      await clickAndAssert(cdp, selector, `top tab ${section}`, section);
    }

    await clickAndAssert(cdp, '[data-ops-tab="school"]', "school top tab before subviews", "school");
    for (const view of ["preview", "model", "edit", "catalog"]) {
      await clickAndAssert(cdp, `[data-ops-school-view="${view}"]`, `school ${view}`, "school", view);
    }
    await clickAndAssert(cdp, '[data-ops-school-view="edit"]', "school edit before editor tabs", "school");
    for (const tab of ["basic", "admissions", "costs", "contact", "programs", "scholarships", "source", "logs", "overview"]) {
      await clickAndAssert(cdp, `[data-ops-school-tab="${tab}"]`, `school editor ${tab}`, "school", "edit");
    }

    await clickAndAssert(cdp, '[data-ops-tab="content"]', "content top tab before subviews", "content");
    for (const type of ["cities", "scholarships", "timeline"]) {
      await clickAndAssert(cdp, `[data-ops-content-tab="${type}"]`, `content type ${type}`, "content");
      for (const view of ["edit", "preview", "model", "catalog"]) {
        await clickAndAssert(cdp, `[data-ops-content-view="${view}"]`, `content ${type} ${view}`, "content", view);
      }
    }

    await clickAndAssert(cdp, '[data-ops-tab="students"]', "students top tab before detail tabs", "students");
    for (const tab of ["handoff", "account", "timeline", "edit", "overview"]) {
      await clickAndAssert(cdp, `[data-ops-student-detail-tab="${tab}"]`, `student detail ${tab}`, "students", tab);
    }

    await clickAndAssert(cdp, '[data-ops-tab="access"]', "access top tab before subviews", "access");
    for (const view of ["invites", "agent", "boundary", "accounts"]) {
      await clickAndAssert(cdp, `[data-ops-access-view="${view}"]`, `access ${view}`, "access", view);
    }

    await clickAndAssert(cdp, '[data-ops-tab="queue"]', "queue top tab before subviews", "queue");
    for (const view of ["audit", "support", "agent", "work"]) {
      await clickAndAssert(cdp, `[data-ops-queue-view="${view}"]`, `queue ${view}`, "queue", view);
    }
  });
  console.log("CUAC ops admin click QA passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
