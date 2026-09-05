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
  throw new Error("Chrome was not found. Set CHROME_PATH to run browser QA.");
}

const root = path.resolve(process.env.CUAC_QA_ROOT || path.resolve(__dirname, "..", "public"));
const port = Number(process.env.CUAC_QA_PORT || 9300 + (process.pid % 600));

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

async function waitFor(cdp, expression, label, timeout = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(cdp, expression)) return;
    await sleep(120);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function installRuntimeErrorTrap(cdp) {
  await evaluate(cdp, `
    (() => {
      window.__cuacRuntimeErrors = [];
      if (window.__cuacRuntimeErrorTrapInstalled) return;
      window.__cuacRuntimeErrorTrapInstalled = true;
      window.addEventListener('error', (event) => {
        const location = [event.filename, event.lineno, event.colno].filter(Boolean).join(':');
        const stack = event.error?.stack ? String(event.error.stack).split('\\n').slice(0, 3).join(' / ') : '';
        window.__cuacRuntimeErrors.push([event.message || 'runtime error', location, stack].filter(Boolean).join(' @ '));
      });
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const stack = reason?.stack ? String(reason.stack).split('\\n').slice(0, 3).join(' / ') : '';
        window.__cuacRuntimeErrors.push([reason?.message || String(reason || 'unhandled rejection'), stack].filter(Boolean).join(' @ '));
      });
    })()
  `);
}

async function assertNoRuntimeErrors(cdp, label) {
  const errors = await evaluate(cdp, "window.__cuacRuntimeErrors || []");
  if (errors.length) throw new Error(`${label}: ${errors.join(" | ")}`);
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
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function waitForAuthReady(cdp, label = "auth page ready") {
  await waitFor(
    cdp,
    "location.href.includes('auth.html') && document.readyState === 'complete' && Boolean(document.querySelector('[data-auth-role].active')) && Boolean(document.querySelector('[data-auth-panel=\"signin\"] .primary'))",
    label,
    10000,
  );
  await sleep(250);
}

async function submitAuthSignIn(cdp) {
  await waitForAuthReady(cdp);
  await evaluate(cdp, "document.querySelector('[data-auth-panel=\"signin\"] .primary').click()");
}

async function signInStudent(cdp) {
  await evaluate(cdp, `
    localStorage.setItem('cuacAuthDemoState', JSON.stringify({
      authState: 'signed-in',
      selectedSurface: 'student',
      role: 'student',
      surface: 'authenticated-student',
      accessGrantStatus: 'active-preview',
      accessGrantType: 'student_profile',
      accessGrantSource: 'self_registration',
      userName: 'Maya Chen',
      userInitial: 'M'
    }))
  `);
}

async function signInSchoolStaff(cdp) {
  await evaluate(cdp, `
    localStorage.setItem('cuacAuthDemoState', JSON.stringify({
      authState: 'signed-in',
      selectedSurface: 'school_staff',
      role: 'school_staff',
      surface: 'school-staff',
      accessGrantStatus: 'approved-preview',
      accessGrantType: 'school_staff_membership',
      accessGrantSource: 'invite_code_preview',
      accessGrantScope: 'Zhejiang University',
      userName: 'Zhejiang University',
      userInitial: 'Z'
    }))
  `);
}

async function signInCuacOps(cdp) {
  await evaluate(cdp, `
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
    }))
  `);
}

async function prepareApplicationForPayment(cdp) {
  await waitFor(cdp, "Boolean(document.querySelector('[data-confirm-choice]'))", "choice confirmation entry");
  await evaluate(cdp, "document.querySelector('[data-confirm-choice]').click()");
  await waitFor(cdp, "document.querySelector('.application-page')?.dataset.applicationStage === 'info'", "student info stage");
  await evaluate(cdp, "document.querySelector('[data-next-application-step=\"fee\"]').click()");
  await waitFor(
    cdp,
    "document.querySelector('.application-page')?.dataset.applicationStage === 'fee' && document.querySelector('[data-open-payment]')?.disabled === false",
    "fee review stage",
  );
}

async function runStep(label, fn) {
  process.stdout.write(`- ${label}... `);
  await fn();
  process.stdout.write("ok\n");
}

async function withBrowser(fn) {
  const runUserDataDir = path.join(os.tmpdir(), `cuac-core-flow-qa-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1000)}`);
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

async function main() {
  await withBrowser(async (cdp) => {
    await runStep("guest save redirects to auth page and continues after sign-in", async () => {
      await navigate(cdp, "programs.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await evaluate(cdp, "sessionStorage.clear()");
      await navigate(cdp, "programs.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-cuac-agent-form]'))", "guest Agent form");
      await evaluate(cdp, `
        (() => {
          const input = document.querySelector('[data-cuac-agent-input]');
          const form = document.querySelector('[data-cuac-agent-form]');
          input.value = 'Guest context should stay on this page session';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        })()
      `);
      await waitFor(
        cdp,
        "JSON.parse(sessionStorage.getItem('cuacGuestAgentPageContext') || '{}').entries?.[0]?.prompt === 'Guest context should stay on this page session' && JSON.parse(sessionStorage.getItem('cuacGuestAgentPageContext') || '{}').storage === 'session' && !localStorage.getItem('cuacStudentAgentMemory')",
        "guest Agent session-only memory",
      );
      await waitFor(cdp, "document.querySelectorAll('[data-save]').length > 2", "program save buttons");
      await evaluate(cdp, `
        (() => {
          const button = [...document.querySelectorAll('[data-save]')].find((item) => !item.classList.contains('saved'));
          if (!button) throw new Error('No unsaved program button found');
          localStorage.setItem('cuacQaSaveId', button.dataset.save);
          button.click();
          return true;
        })()
      `);
      await waitFor(cdp, "location.href.includes('auth.html')", "auth continuation page");
      await waitFor(cdp, "JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}').label === 'Save this program'", "saved continuation state");
      await submitAuthSignIn(cdp);
      try {
        await waitFor(
          cdp,
          "location.href.includes('programs.html') && Boolean(window.CUAC?.isSignedIn?.())",
          "returned signed-in state",
        );
      } catch (error) {
        const state = await evaluate(cdp, `
          (() => ({
            href: location.href,
            readyState: document.readyState,
            continuation: localStorage.getItem('cuacAuthContinuationDemoState'),
            auth: localStorage.getItem('cuacAuthDemoState'),
            submitText: document.querySelector('[data-auth-panel="signin"] .primary')?.textContent || '',
            hint: document.querySelector('[data-auth-panel="signin"] .form-hint')?.textContent || '',
          }))()
        `);
        throw new Error(`${error.message}. State: ${JSON.stringify(state)}`);
      }
      await waitFor(
        cdp,
        "document.querySelector(`[data-save=\"${localStorage.getItem('cuacQaSaveId')}\"]`)?.classList.contains('saved')",
        "continued save action",
      );
      await waitFor(cdp, "!localStorage.getItem('cuacAuthContinuationDemoState')", "save continuation consumed");
      const saveContinuationAudit = await evaluate(cdp, `
        (() => {
          const audit = JSON.parse(localStorage.getItem('cuacAuthContinuationAuditDemoState') || '{}');
          return audit.event === 'click-selector-resumed' && audit.continuationLabel === 'Save this program';
        })()
      `);
      if (!saveContinuationAudit) throw new Error("Save continuation was not consumed with an audit marker.");
      await waitFor(cdp, "Boolean(document.querySelector('[data-nav-saved-shortcut]'))", "signed-in saved shortcut");
      await navigate(cdp, "programs.html?motion=off");
      await waitFor(cdp, "Boolean(window.CUAC?.isSignedIn?.())", "persisted auth-page sign-in after reload");
      await waitFor(
        cdp,
        "document.querySelector('[data-agent-context-policy]')?.dataset.agentContextStorage === 'account'",
        "signed-in Agent account memory after reload",
      );
      await evaluate(cdp, `
        (() => {
          const input = document.querySelector('[data-cuac-agent-input]');
          const form = document.querySelector('[data-cuac-agent-form]');
          input.value = 'Signed-in context should persist until enrollment or manual clear';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        })()
      `);
      await waitFor(
        cdp,
        "JSON.parse(localStorage.getItem('cuacStudentAgentMemory') || '{}').entries?.[0]?.prompt === 'Signed-in context should persist until enrollment or manual clear' && JSON.parse(localStorage.getItem('cuacStudentAgentMemory') || '{}').storage === 'account' && JSON.parse(localStorage.getItem('cuacStudentAgentMemory') || '{}').retention === 'application-lifecycle'",
        "signed-in Agent account memory persisted",
      );
      await waitFor(cdp, "Boolean(document.querySelector('[data-nav-saved-shortcut]'))", "persisted signed-in saved shortcut");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("program results pagination changes pages and filters reset to first page", async () => {
      await navigate(cdp, "programs.html?motion=off");
      await waitFor(cdp, "document.querySelectorAll('[data-program-id]').length === 8", "first program page size");
      await waitFor(
        cdp,
        "document.querySelector('#programList .program-requirements')?.textContent.includes('CSCA') && document.querySelector('#programList .program-requirements')?.textContent.includes('Language proof') && document.querySelector('#programList .program-requirements')?.textContent.includes('Application note')",
        "program cards expose CSCAlite requirement summary",
      );
      await waitFor(cdp, "document.querySelector('#pagination')?.textContent.includes('Showing 1-8 of')", "program pagination summary");
      const firstPage = await evaluate(cdp, `
        (() => [...document.querySelectorAll('[data-program-id]')].map((row) => row.dataset.programId).join('|'))()
      `);
      await evaluate(cdp, "document.querySelector('[data-page=\"2\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-page=\"2\"]')?.getAttribute('aria-current') === 'page'", "second page active");
      await waitFor(cdp, "document.querySelector('#pagination')?.textContent.includes('Showing 9-')", "second page summary");
      const secondPage = await evaluate(cdp, `
        (() => [...document.querySelectorAll('[data-program-id]')].map((row) => row.dataset.programId).join('|'))()
      `);
      if (!firstPage || firstPage === secondPage) throw new Error("Program pagination did not change visible results.");

      await evaluate(cdp, `
        (() => {
          const input = document.querySelector('#searchInput');
          input.value = 'Hangzhou';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('#searchButton').click();
          return true;
        })()
      `);
      await waitFor(cdp, "document.querySelector('#activeChips')?.textContent.includes('Search: Hangzhou')", "search chip after pagination");
      const resetToFirstPage = await evaluate(cdp, `
        (() => {
          const rows = [...document.querySelectorAll('[data-program-id]')];
          const activePage = document.querySelector('#pagination [aria-current="page"]')?.dataset.page || '1';
          return activePage === '1'
            && rows.length > 0
            && rows.every((row) => row.textContent.includes('Hangzhou'))
            && !document.querySelector('#pagination')?.textContent.includes('Showing 9-');
        })()
      `);
      if (!resetToFirstPage) throw new Error("Program search did not reset pagination to the first filtered page.");
    });

    await runStep("program focus uses student-facing decision copy instead of source status", async () => {
      await navigate(cdp, "programs.html?motion=off&program=tongji-civil-msc");
      await waitFor(cdp, "document.querySelector('#programFocus')?.classList.contains('visible') && document.querySelector('#programFocus')?.textContent.includes('Civil Engineering MSc')", "program focus visible");
      const copyIsStudentFacing = await evaluate(cdp, `
        (() => {
          const text = document.querySelector('#programFocus')?.textContent || '';
          return text.includes('Review deadline and requirements before adding')
            && !text.includes('School application page: ready to review')
            && !text.includes('School application page: recheck before sending')
            && !text.includes('School application page: confirm before sending')
            && !text.includes('Verified source')
            && !text.includes('Needs source check')
            && !text.includes('Needs date check');
        })()
      `);
      if (!copyIsStudentFacing) throw new Error("Program focus exposed source-status copy instead of student decision copy.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("guest protected student link redirects to auth page and continues navigation", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await waitFor(
        cdp,
        "Boolean(window.CUAC?.requireSignedIn) && Boolean(document.querySelector('[data-cuac-agent-shell]')) && Boolean(document.querySelector('.nav-links a[href=\"hub.html\"]'))",
        "Hub link and initialized shared shell guard",
      );
      await clickSelector(cdp, ".nav-links a[href=\"hub.html\"]");
      try {
        await waitFor(cdp, "location.href.includes('auth.html')", "protected-link auth page");
      } catch (error) {
        const state = await evaluate(cdp, `
          (() => ({
            href: location.href,
            bodyAuthState: document.body.dataset.authState || '',
            isSignedIn: Boolean(window.CUAC?.isSignedIn?.()),
            hubLinkText: document.querySelector('.nav-links a[href="hub.html"]')?.textContent || '',
          }))()
        `);
        throw new Error(`${error.message}. State: ${JSON.stringify(state)}`);
      }
      await submitAuthSignIn(cdp);
      await waitFor(cdp, "location.href.includes('hub.html')", "continued Hub navigation");
      await waitFor(cdp, "Boolean(window.CUAC?.isSignedIn?.())", "Hub signed-in state");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("guest home create-list redirects to auth page and continues onboarding", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await navigate(cdp, "home-v3.html?motion=off");
      await waitFor(cdp, "Boolean(window.CUAC?.requireStudentSignedIn) && Boolean(document.querySelector('[data-create-list]'))", "create-list guard");
      await clickSelector(cdp, "[data-create-list]");
      await waitFor(cdp, "location.href.includes('auth.html')", "create-list auth page");
      await waitFor(
        cdp,
        "JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}').resumeAction?.selector === '[data-create-list]'",
        "create-list continuation state",
      );
      await submitAuthSignIn(cdp);
      await waitFor(cdp, "location.href.includes('onboarding.html') && Boolean(window.CUAC?.isSignedIn?.())", "continued onboarding after create list");
      await waitFor(cdp, "!localStorage.getItem('cuacAuthContinuationDemoState')", "create-list continuation consumed");
      await evaluate(cdp, `
        (() => {
          const pick = (selector, text) => {
            const button = [...document.querySelectorAll(selector)].find((item) => item.textContent.trim() === text);
            if (!button) throw new Error('Missing onboarding option: ' + text);
            button.click();
          };
          document.querySelector('[data-field="nationality"]').value = 'Malaysia';
          document.querySelector('[data-field="currentCountry"]').value = 'Malaysia';
          document.querySelector('[data-field="stage"]').value = 'Undergraduate graduate';
          pick('[data-chip-group="level"] button', 'Master');
          pick('[data-chip-group="subject"] button', 'Business');
          document.querySelector('[data-field="intake"]').value = 'Spring 2027';
          document.querySelector('[data-field="language"]').value = 'English-taught';
          document.querySelector('[data-check="language"]').checked = false;
          document.querySelector('[data-check="translation"]').checked = false;
        })()
      `);
      for (let step = 0; step < 7; step += 1) {
        await evaluate(cdp, "document.querySelector('[data-onboarding-form]').requestSubmit()");
        await sleep(80);
      }
      await waitFor(cdp, "location.href.includes('hub.html')", "onboarding saved and entered Hub");
      const onboardingCarried = await evaluate(cdp, `
        (() => {
          const preview = JSON.parse(localStorage.getItem('cuacOnboardingPreview') || '{}');
          const checks = document.querySelector('.route-checks')?.textContent || '';
          return preview.nationality === 'Malaysia'
            && preview.currentCountry === 'Malaysia'
            && preview.stage === 'Undergraduate graduate'
            && preview.readiness?.language === false
            && preview.readinessReadyCount === 2
            && document.querySelector('[data-route-label]')?.textContent.includes('Suggested first choice')
            && document.querySelector('[data-route-copy]')?.textContent.includes('from Malaysia')
            && document.querySelector('[data-route-copy]')?.textContent.includes('Undergraduate graduate')
            && checks.includes('Spring 2027')
            && checks.includes('English-taught')
            && document.querySelector('[data-application-title]')?.textContent.includes('Start your application')
            && document.querySelector('.application-top-action')?.textContent.includes('Start application')
            && document.querySelector('.application-top-action')?.getAttribute('href') === 'application.html'
            && getComputedStyle(document.querySelector('.route-readiness')).display === 'none'
            && document.querySelector('[data-count="documents"]')?.textContent.trim() === '3'
            && !document.querySelector('.cycle-alert')
            && [...document.querySelectorAll('.hub-launch-card')].some((card) => card.textContent.includes('Prepare documents'));
        })()
      `);
      if (!onboardingCarried) {
        const state = await evaluate(cdp, `
          (() => ({
            preview: JSON.parse(localStorage.getItem('cuacOnboardingPreview') || '{}'),
            routeCopy: document.querySelector('[data-route-copy]')?.textContent || '',
            profile: document.querySelector('[data-profile-summary]')?.textContent || '',
            launchCards: [...document.querySelectorAll('.hub-launch-card')].map((card) => card.textContent),
            documentCount: document.querySelector('[data-count="documents"]')?.textContent || '',
          }))()
        `);
        throw new Error(`Onboarding background and readiness context did not carry into Hub. State: ${JSON.stringify(state)}`);
      }
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("guest Agent protected action signs in and continues to add choice", async () => {
      await navigate(cdp, "programs.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-cuac-agent-form]'))", "Agent form");
      await evaluate(cdp, `
        (() => {
          const input = document.querySelector('[data-cuac-agent-input]');
          const form = document.querySelector('[data-cuac-agent-form]');
          input.value = 'add specific choice program';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          form.requestSubmit();
          return true;
        })()
      `);
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-action=\"open-choice-modal\"]'))", "Agent add-choice action", 10000);
      await evaluate(cdp, "document.querySelector('[data-agent-action=\"open-choice-modal\"]').click()");
      await waitFor(cdp, "location.href.includes('auth.html')", "Agent auth continuation page");
      await submitAuthSignIn(cdp);
      try {
        await waitFor(cdp, "location.href.includes('programs.html')", "returned to Agent source page", 10000);
      } catch (error) {
        const state = await evaluate(cdp, `
          (() => ({
            href: location.href,
            readyState: document.readyState,
            continuation: localStorage.getItem('cuacAuthContinuationDemoState'),
            auth: localStorage.getItem('cuacAuthDemoState'),
            activeRole: document.querySelector('[data-auth-role].active')?.dataset.authRole || '',
            hint: document.querySelector('.form-hint')?.textContent || '',
          }))()
        `);
        throw new Error(`${error.message}. State: ${JSON.stringify(state)}`);
      }
      await waitFor(cdp, "Boolean(document.querySelector('[data-auth-continuation-action=\"open-choice-modal\"] [data-agent-action=\"open-choice-modal\"]'))", "restored Agent continuation action", 10000);
      await waitFor(cdp, "JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}').resumeAction?.actionId === 'open-choice-modal'", "Agent continuation kept until clicked");
      await evaluate(cdp, "document.querySelector('[data-auth-continuation-action=\"open-choice-modal\"] [data-agent-action=\"open-choice-modal\"]').click()");
      await waitFor(cdp, "location.href.includes('application.html') && location.hash === '#add-choice'", "Agent continued add-choice navigation", 10000);
      await waitFor(cdp, "document.querySelector('[data-choice-modal]')?.classList.contains('open')", "continued Add choice modal");
      await waitFor(cdp, "!localStorage.getItem('cuacAuthContinuationDemoState')", "Agent add-choice continuation consumed");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("guest Agent save checklist signs in and continues page action", async () => {
      await navigate(cdp, "guides.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await navigate(cdp, "guides.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-cuac-agent-form]'))", "Guide Agent form");
      await waitFor(
        cdp,
        "document.querySelectorAll('[data-application-window]').length >= 5 && document.querySelector('[data-application-timeline-stats]')?.textContent.includes('program deadlines') && document.querySelector('[data-timeline-deadline-board]')?.textContent.includes('Built from school-program deadline fields')",
        "guide public application timeline windows",
      );
      const timelineSwitched = await evaluate(cdp, `
        (() => {
          const cards = [...document.querySelectorAll('[data-application-window]')];
          const before = document.querySelector('[data-timeline-deadline-board]')?.textContent || '';
          const target = cards.find((card) => card.dataset.applicationWindow !== cards[0]?.dataset.applicationWindow) || cards[1];
          if (!target) return false;
          target.click();
          const after = document.querySelector('[data-timeline-deadline-board]')?.textContent || '';
          return target.classList.contains('active') && after.length > 80 && after !== before;
        })()
      `);
      if (!timelineSwitched) throw new Error("Guide application timeline month selection did not update the deadline board.");
      await navigate(cdp, "guides.html?motion=off&timelineQuery=Computer&tag=english&mode=program#timeline");
      await waitFor(
        cdp,
        "document.querySelector('[data-timeline-search]')?.value === 'Computer' && document.querySelector('[data-timeline-tag-filter]')?.value === 'english' && document.querySelector('[data-timeline-result-mode=\"program\"]')?.classList.contains('active') && document.querySelectorAll('[data-timeline-program-result]').length > 0 && document.querySelector('[data-timeline-filter-panel]')?.textContent.includes('Search: Computer') && document.querySelector('[data-timeline-filter-panel]')?.textContent.includes('Tag: english')",
        "guide timeline accepts CSCAlite-style route filters",
      );
      await evaluate(cdp, "document.querySelector('[data-timeline-result-mode=\"school\"]')?.click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-timeline-result-mode=\"school\"]')?.classList.contains('active') && document.querySelectorAll('[data-timeline-school-result]').length > 0 && location.search.includes('timelineQuery=Computer')",
        "guide timeline switches filtered results by school",
      );
      await evaluate(cdp, "document.querySelector('[data-timeline-clear-filter=\"query\"]')?.click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-timeline-search]')?.value === '' && !document.querySelector('[data-timeline-filter-panel]')?.textContent.includes('Search: Computer')",
        "guide timeline clears a route filter chip",
      );
      await evaluate(cdp, `
        (() => {
          const input = document.querySelector('[data-cuac-agent-input]');
          const form = document.querySelector('[data-cuac-agent-form]');
          input.value = 'What documents do I need before Oct 15?';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          form.requestSubmit();
          return true;
        })()
      `);
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-action=\"save-checklist\"]'))", "Agent save-checklist action", 10000);
      await evaluate(cdp, "document.querySelector('[data-agent-action=\"save-checklist\"]').click()");
      await waitFor(cdp, "location.href.includes('auth.html')", "save-checklist auth page");
      await submitAuthSignIn(cdp);
      await waitFor(cdp, "location.href.includes('guides.html') && Boolean(window.CUAC?.isSignedIn?.())", "guide signed-in state");
      await waitFor(cdp, "Boolean(document.querySelector('[data-auth-continuation-action=\"save-checklist\"] [data-agent-action=\"save-checklist\"]'))", "restored checklist continuation action");
      await waitFor(cdp, "JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}').resumeAction?.actionId === 'save-checklist'", "checklist continuation kept until clicked");
      await evaluate(cdp, "document.querySelector('[data-auth-continuation-action=\"save-checklist\"] [data-agent-action=\"save-checklist\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-guide-agent-notice]')?.textContent.includes('reusable document packet') && document.querySelectorAll('.document-row.agent-reviewed').length >= 5",
        "continued guide checklist save",
      );
      await waitFor(cdp, "!localStorage.getItem('cuacAuthContinuationDemoState')", "checklist continuation consumed");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("guest Agent save cost estimate signs in and continues page action", async () => {
      await navigate(cdp, "cities.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await navigate(cdp, "cities.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-cuac-agent-form]'))", "City Agent form");
      await evaluate(cdp, `
        (() => {
          const input = document.querySelector('[data-cuac-agent-input]');
          const form = document.querySelector('[data-cuac-agent-form]');
          input.value = 'How much will one year in Hangzhou cost?';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          form.requestSubmit();
          return true;
        })()
      `);
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-action=\"save-cost-estimate\"]'))", "Agent save-cost-estimate action", 10000);
      await evaluate(cdp, "document.querySelector('[data-agent-action=\"save-cost-estimate\"]').click()");
      await waitFor(cdp, "location.href.includes('auth.html')", "save-cost-estimate auth page");
      await submitAuthSignIn(cdp);
      await waitFor(cdp, "location.href.includes('cities.html') && Boolean(window.CUAC?.isSignedIn?.())", "city signed-in state");
      await waitFor(cdp, "Boolean(document.querySelector('[data-auth-continuation-action=\"save-cost-estimate\"] [data-agent-action=\"save-cost-estimate\"]'))", "restored cost continuation action");
      await waitFor(cdp, "JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}').resumeAction?.actionId === 'save-cost-estimate'", "cost continuation kept until clicked");
      await evaluate(cdp, "document.querySelector('[data-auth-continuation-action=\"save-cost-estimate\"] [data-agent-action=\"save-cost-estimate\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-city-agent-notice]')?.textContent.includes('balanced monthly budget estimate')",
        "continued city cost estimate save",
      );
      await waitFor(cdp, "!localStorage.getItem('cuacAuthContinuationDemoState')", "cost continuation consumed");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("add choice hash opens school-facing selector with student-friendly receipt copy", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await signInStudent(cdp);
      await navigate(cdp, "application.html#add-choice");
      await waitFor(cdp, "document.querySelector('[data-choice-modal]')?.classList.contains('open')", "choice modal");
      await waitFor(cdp, "document.querySelector('[data-program-select]')?.options.length > 0", "program options");
      const selectorOk = await evaluate(cdp, `
        (() => {
          const university = document.querySelector('[data-university-select]')?.value || '';
          const program = document.querySelector('[data-program-select]')?.value || '';
          const sourceText = document.querySelector('[data-choice-source-map]')?.textContent || '';
          const intake = document.querySelector('[name="intake"]');
          const language = document.querySelector('[name="language"]');
          return Boolean(university && program
            && intake?.disabled
            && language?.disabled
            && intake?.dataset.catalogLocked === 'SchoolProgram'
            && language?.dataset.catalogLocked === 'SchoolProgram'
            && sourceText.includes('What this school will receive')
            && sourceText.includes('Intake and teaching language are locked from the catalog')
            && sourceText.includes('Your selected route')
            && sourceText.includes('Not shared by CUAC'));
        })()
      `);
      if (!selectorOk) throw new Error("Add choice selector did not expose expected school/program receipt copy.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("removing an application choice recalculates school count and fee", async () => {
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "application.html?motion=off");
      await waitFor(cdp, "document.querySelectorAll('[data-remove-choice]').length >= 3", "remove choice actions");
      await evaluate(cdp, "document.querySelector('[data-choice][data-school=\"Nanjing University\"] [data-remove-choice]').click()");
      await waitFor(
        cdp,
        "document.querySelectorAll('[data-choice]').length === 2 && [...document.querySelectorAll('[data-total-fee]')].some((item) => item.textContent.includes('USD 20'))",
        "choice removal fee recalculation",
      );
      const removalState = await evaluate(cdp, `
        (() => {
          const app = JSON.parse(localStorage.getItem('cuacApplicationDemoState') || '{}');
          return document.querySelector('[data-choice-status]')?.textContent.includes('2 choices')
            && !document.querySelector('[data-choice][data-school="Nanjing University"]')
            && app.choiceCount === 2
            && app.schoolCount === 2
            && app.totalFee === 20;
        })()
      `);
      if (!removalState) throw new Error("Choice removal did not persist the recalculated application state.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("added program choice keeps source fields through school portal handoff", async () => {
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "application.html#add-choice");
      await waitFor(cdp, "document.querySelector('[data-choice-modal]')?.classList.contains('open')", "choice modal");
      await evaluate(cdp, `
        (() => {
          const degree = document.querySelector('[data-degree-select]');
          degree.value = 'Master';
          degree.dispatchEvent(new Event('change', { bubbles: true }));
          const university = document.querySelector('[data-university-select]');
          university.value = 'Zhejiang University';
          university.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `);
      await waitFor(cdp, "[...document.querySelector('[data-program-select]')?.options || []].some((option) => option.textContent.trim() === 'Biomedical Engineering MSc')", "biomedical option");
      await evaluate(cdp, `
        (() => {
          const program = document.querySelector('[data-program-select]');
          program.value = [...program.options].find((option) => option.textContent.trim() === 'Biomedical Engineering MSc')?.value || '';
          program.dispatchEvent(new Event('change', { bubbles: true }));
          const note = document.querySelector('[data-choice-note]');
          note.value = 'I want a biomedical route with lab exposure and scholarship review.';
          note.dispatchEvent(new Event('input', { bubbles: true }));
          const sourceMap = document.querySelector('[data-choice-source-map]')?.textContent || '';
          if (!sourceMap.includes('Academic route') || !sourceMap.includes('Entry requirements') || !sourceMap.includes('2-3 years') || !sourceMap.includes('Engineering') || !sourceMap.includes('CSCA') || !sourceMap.includes('IELTS / TOEFL')) {
            throw new Error('Choice source map does not expose the selected SchoolProgram requirements.');
          }
          const intake = document.querySelector('[name="intake"]');
          const language = document.querySelector('[name="language"]');
          intake.append(new Option('Spring 2027', 'Spring 2027'));
          language.append(new Option('Chinese-taught', 'Chinese-taught'));
          intake.value = 'Spring 2027';
          language.value = 'Chinese-taught';
          document.querySelector('[data-choice-form]').requestSubmit();
          return true;
        })()
      `);
      await waitFor(cdp, "Boolean(document.querySelector('[data-choice][data-program=\"Biomedical Engineering MSc\"]'))", "biomedical choice added");
      const addedChoice = await evaluate(cdp, `
        (() => {
          const route = document.querySelector('[data-choice][data-program="Biomedical Engineering MSc"]');
          const actual = { ...route?.dataset };
          const ok = route?.dataset.school === 'Zhejiang University'
            && route?.dataset.schoolId === '101'
            && route?.dataset.programId === '10103'
            && route?.dataset.programName === 'Biomedical Engineering'
            && route?.dataset.degree === 'Master'
            && route?.dataset.durationYears === '2-3 years'
            && route?.dataset.fieldCategory === 'Biomedical Engineering'
            && route?.dataset.cscaRequirement.includes('CSCA')
            && route?.dataset.englishRequirement.includes('IELTS / TOEFL')
            && route?.dataset.applicationUrl.includes('zju.edu.cn')
            && route?.dataset.intake === 'Fall 2026'
            && route?.dataset.language === 'English-taught'
            && route?.dataset.choiceNote === 'I want a biomedical route with lab exposure and scholarship review.'
            && route?.textContent.includes('School note');
          return { ok: Boolean(ok), actual };
        })()
      `);
      if (!addedChoice?.ok) throw new Error(`Added choice did not preserve selected school and program fields: ${JSON.stringify(addedChoice?.actual || {})}`);
      await prepareApplicationForPayment(cdp);
      await evaluate(cdp, "document.querySelector('[data-open-payment]').click()");
      await waitFor(cdp, "document.querySelector('[data-payment-modal]')?.classList.contains('open')", "payment modal for added choice");
      await evaluate(cdp, "document.querySelector('[data-complete-payment]').click()");
      await waitFor(cdp, "document.querySelector('[data-payment-simulation-status]')?.textContent.includes('Confirming payment') && JSON.parse(localStorage.getItem('cuacApplicationDemoState') || '{}').submittedToSchools !== true", "payment processing before added choice send");
      await waitFor(cdp, "Boolean(document.querySelector('[data-submission-status]:not([hidden])'))", "submitted state for added choice");
      const submittedChoice = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacApplicationDemoState') || '{}');
          const zjuRecords = state.submittedRecords?.filter((item) => item.school === 'Zhejiang University') || [];
          const record = zjuRecords[0];
          const biomedical = record?.programInterests?.find((item) => item.programFullName === 'Biomedical Engineering MSc');
          return record
            && state.cartResult?.pricing?.payableTotalCents === 4000
            && state.commerceOrder?.status === 'PAID'
            && state.paymentCreateResult?.status === 'SUCCEEDED'
            && state.paymentCreateResult?.providerTxnId
            && state.paymentCreateResult?.callbackSignaturePayload?.includes('amountCents=4000')
            && zjuRecords.length === 1
            && record.programInterests?.length === 2
            && record.programInterestSummary === '2 program interests'
            && biomedical?.programName === 'Biomedical Engineering'
            && biomedical?.degree === 'Master'
            && biomedical?.durationYears === '2-3 years'
            && biomedical?.fieldCategory === 'Biomedical Engineering'
            && biomedical?.cscaRequirement?.includes('CSCA')
            && biomedical?.englishRequirement?.includes('IELTS / TOEFL')
            && biomedical?.applicationUrl?.includes('zju.edu.cn')
            && biomedical?.applicationNote?.includes('schools request official documents directly')
            && biomedical?.informationSources?.selectedByStudent?.schoolId
            && biomedical?.informationSources?.selectedByStudent?.programId
            && biomedical?.informationSources?.selectedByStudent?.studentChoiceNote === 'I want a biomedical route with lab exposure and scholarship review.'
            && biomedical?.studentChoiceNote === 'I want a biomedical route with lab exposure and scholarship review.'
            && record.note.includes('biomedical route with lab exposure')
            && biomedical?.informationSources?.fromProgramRecord?.nameEn === 'Biomedical Engineering MSc'
            && biomedical?.informationSources?.fromProgramRecord?.durationYears === '2-3 years'
            && biomedical?.informationSources?.fromProgramRecord?.fieldCategory === 'Biomedical Engineering'
            && biomedical?.informationSources?.fromProgramRecord?.cscaRequirement?.includes('CSCA')
            && biomedical?.informationSources?.fromProgramRecord?.englishRequirement?.includes('IELTS / TOEFL')
            && biomedical?.informationSources?.fromProgramRecord?.applicationUrl?.includes('zju.edu.cn')
            && biomedical?.informationSources?.fromProgramRecord?.tuitionAmount
            && biomedical?.informationSources?.fromProgramRecord?.deadlineDate
            && biomedical?.informationSources?.fromProgramRecord?.sourceFieldLineage?.sourceModel === 'SchoolProgram'
            && record.informationSources?.fromSchoolRecord?.sourceFieldLineage?.sourceModel === 'School'
            && biomedical?.informationSources?.sourceFieldLineage?.fromProgramRecord?.sourceFields?.includes('tuitionAmount')
            && record.sourceFieldLineage?.fromSchoolRecord?.sourceFields?.includes('admissionsWebsiteUrl')
            && record.informationSources?.fromSchoolRecord?.nameEn === 'Zhejiang University'
            && record.informationSources?.fromStudentProfile?.legalName === 'Maya Chen'
            && record.informationSources?.fromStudentProfile?.passportNationality === 'Malaysia'
            && record.informationSources?.fromStudentProfile?.currentSchool === "Taylor's University"
            && record.informationSources?.fromStudentProfile?.intendedLevel === 'Master'
            && record.informationSources?.fromStudentProfile?.guardianStatus === 'Not required'
            && /software and biology coursework/i.test(record.informationSources?.fromStudentProfile?.academicSummary || '')
            && Array.isArray(record.notCollectedByCuac)
            && record.notCollectedByCuac.includes('passportScan');
        })()
      `);
      if (!submittedChoice) throw new Error("Added choice did not persist CSCAlite-style source fields before school handoff.");

      await signInSchoolStaff(cdp);
      await navigate(cdp, "school-portal.html?motion=off");
      await waitFor(cdp, "!document.querySelector('[data-submission-receipt]')?.hidden", "school receipt for added choice");
      await evaluate(cdp, `
        (() => {
          const row = [...document.querySelectorAll('[data-record-row]')].find((item) => item.textContent.includes('生物医学工程') && item.textContent.includes('CUAC 实时提交'));
          if (!row) throw new Error('No received Biomedical Engineering row found');
          row.querySelector('[data-application]').click();
          return true;
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-detail-source]')?.textContent.includes('CUAC 实时提交')", "received biomedical detail");
      const schoolDetail = await evaluate(cdp, `
        (() => {
          const sources = document.querySelector('[data-information-sources]')?.textContent || '';
          const notCollected = document.querySelector('[data-not-collected]')?.textContent || '';
          const liveRecord = window.CuacDataClient?.getTenantSubmittedRecords?.('Zhejiang University')
            ?.find((item) => item.programInterests?.some((interest) => interest.programFullName === 'Biomedical Engineering MSc'));
          const programInterestText = document.querySelector('[data-program-interest]')?.textContent || '';
          const bodyText = document.body.textContent || '';
          const checks = {
            programHasBiomedical: programInterestText.includes('生物医学工程硕士'),
            programHasComputerScience: programInterestText.includes('计算机科学硕士'),
            hasStudentChoice: sources.includes('学生选择'),
            hasRoute: sources.includes('项目路线'),
            hasRequirements: sources.includes('入学要求'),
            hasApplicationEntry: sources.includes('学校申请入口'),
            hasDuration: sources.includes('2-3 years'),
            hasField: sources.includes('工程'),
            hasCsca: sources.includes('CSCA'),
            hasEnglish: sources.includes('IELTS / TOEFL'),
            hasApplicationUrl: sources.includes('zju.edu.cn'),
            hasCatalog: sources.includes('CUAC 目录'),
            hasProfile: sources.includes('学生资料'),
            hasChoiceNote: sources.includes('I want a biomedical route with lab exposure and scholarship review.'),
            hasStudentName: sources.includes('Maya Chen'),
            hasSchoolName: sources.includes('浙江大学'),
            hasCurrentSchool: sources.includes("Taylor's University"),
            hasDetailNote: document.querySelector('[data-note-text]')?.textContent.includes('biomedical route with lab exposure'),
            hasPassportNationality: document.querySelector('[data-passport-nationality]')?.textContent.includes('马来西亚'),
            hasDetailCurrentSchool: document.querySelector('[data-current-school]')?.textContent.includes("Taylor's University"),
            hasIntendedLevel: document.querySelector('[data-intended-level]')?.textContent.includes('硕士'),
            hasGuardianStatus: document.querySelector('[data-guardian-status]')?.textContent.includes('不需要'),
            hasAcademicSummary: document.querySelector('[data-academic-summary]')?.textContent.includes('software and biology coursework'),
            liveProgramLineage: liveRecord?.sourceFieldLineage?.fromProgramRecord?.sourceModel === 'SchoolProgram',
            liveSchoolLineage: liveRecord?.sourceFieldLineage?.fromSchoolRecord?.sourceModel === 'School',
            hasNotCollectedPassport: notCollected.includes('护照扫描件'),
            hidesOtherTenantNanjing: !bodyText.includes('Nanjing University received'),
            hidesOtherTenantUibe: !bodyText.includes('UIBE received'),
          };
          return {
            ok: Object.values(checks).every(Boolean),
            failed: Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name),
            sources,
            notCollected,
            programInterestText,
            liveSourceFieldLineage: liveRecord?.sourceFieldLineage || null,
          };
        })()
      `);
      if (!schoolDetail?.ok) throw new Error(`School portal did not show the added program with source-map fields and tenant isolation: ${JSON.stringify(schoolDetail)}`);
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("application final submit is locked until required sections are complete", async () => {
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "application.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-open-payment]'))", "payment entry");
      const lockedInitially = await evaluate(cdp, `
        (() => {
          const button = document.querySelector('[data-open-payment]');
          return button?.disabled === true
            && button?.title.includes('confirm the choice order')
            && document.querySelector('.application-page')?.dataset.applicationStage === 'choices'
            && document.querySelector('[data-application-gate]')?.hidden === true;
        })()
      `);
      if (!lockedInitially) throw new Error("Application submit entry was not locked on the initial choices step.");
      await evaluate(cdp, "document.querySelector('[data-flow-target=\"fee\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('.application-page')?.dataset.applicationStage === 'fee' && document.querySelector('[data-fee-card]')?.offsetParent !== null",
        "fee review stage",
      );
      const feeReviewLocked = await evaluate(cdp, `
        (() => {
          const button = document.querySelector('[data-open-payment]');
          return !document.querySelector('[data-payment-modal]')?.classList.contains('open')
            && button?.disabled === true
            && button?.title.includes('confirm the choice order')
            && document.querySelector('[data-fee-card]')?.textContent.includes('Why this fee?');
        })()
      `);
      if (!feeReviewLocked) throw new Error("Fee review did not open with submit still locked by required application sections.");
    });

    await runStep("student profile section cards open standalone detail routes", async () => {
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-confirm-choice]').click()");
      await waitFor(cdp, "document.querySelector('.application-page')?.dataset.applicationStage === 'info'", "student profile stage");
      await evaluate(cdp, "document.querySelector('[data-profile-section-target=\"contact\"]').click()");
      await waitFor(
        cdp,
        "location.hash === '#profile/contact' && document.querySelector('.application-page')?.classList.contains('profile-detail-mode') && document.querySelector('[data-profile-detail-title]')?.textContent === 'Contact details' && document.querySelector('[data-profile-overview]')?.offsetParent === null && document.querySelector('[data-profile-section=\"contact\"]')?.classList.contains('active') && document.querySelector('[data-profile-section=\"account\"]')?.hidden === true",
        "standalone contact detail route",
      );
      await evaluate(cdp, `
        (() => {
          const phone = document.querySelector('[data-student-info-form]').elements.phone;
          phone.value = '';
          phone.dispatchEvent(new Event('input', { bubbles: true }));
        })()
      `);
      await waitFor(
        cdp,
        "Array.from(document.querySelectorAll('[data-profile-section-status=\"contact\"]')).some((item) => item.textContent === 'Missing')",
        "contact section missing state",
      );
      await evaluate(cdp, `
        (() => {
          const phone = document.querySelector('[data-student-info-form]').elements.phone;
          phone.value = '+60 12 000 0000';
          phone.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-profile-next]').click();
        })()
      `);
      await waitFor(cdp, "location.hash === '#profile/background' && document.querySelector('[data-profile-section=\"background\"]')?.classList.contains('active')", "next profile section route");
      await evaluate(cdp, "document.querySelector('[data-profile-return]').click()");
      await waitFor(
        cdp,
        "location.hash === '#info' && !document.querySelector('.application-page')?.classList.contains('profile-detail-mode') && document.querySelector('[data-profile-overview]')?.offsetParent !== null && document.querySelector('[data-profile-editor]')?.hidden === true",
        "profile overview return",
      );
    });

    await runStep("student profile reuses account and onboarding answers", async () => {
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await evaluate(cdp, `
        localStorage.setItem('cuacAuthDemoState', JSON.stringify({
          authState: 'signed-in',
          selectedSurface: 'student',
          role: 'student',
          surface: 'authenticated-student',
          accessGrantStatus: 'active-preview',
          accessGrantType: 'student_profile',
          accessGrantSource: 'self_registration',
          userName: 'Lina Zhao',
          userInitial: 'L',
          email: 'lina@example.com'
        }));
        localStorage.setItem('cuacOnboardingPreview', JSON.stringify({
          nationality: 'Pakistan',
          currentCountry: 'China',
          stage: 'Undergraduate student',
          level: 'PhD',
          subject: 'Engineering',
          funding: 'Need full funding',
          language: 'Chinese-taught',
          readiness: { passport: true, transcript: true, graduation: false, language: false, translation: false },
          savedAt: '2026-08-20T08:00:00.000Z',
          source: 'CUAC onboarding preview'
        }));
      `);
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-confirm-choice]').click()");
      await waitFor(cdp, "document.querySelector('.application-page')?.dataset.applicationStage === 'info'", "student profile stage");
      const inheritedProfile = await evaluate(cdp, `
        (() => {
          const form = document.querySelector('[data-student-info-form]');
          return {
            fullName: form.elements.fullName.value,
            email: form.elements.email.value,
            currentCountry: form.elements.currentCountry.value,
            passportNationality: form.elements.passportNationality.value,
            educationStage: form.elements.educationStage.value,
            intendedLevel: form.elements.intendedLevel.value,
            subjectInterest: form.elements.subjectInterest.value,
            fundingIntent: form.elements.fundingIntent.value,
            budgetRange: form.elements.budgetRange.value,
            languageStatus: form.elements.languageStatus.value,
            hskStatus: form.elements.hskStatus.value,
            academicSummary: form.elements.academicSummary.value
          };
        })()
      `);
      const inheritedOk = inheritedProfile.fullName === "Lina Zhao"
        && inheritedProfile.email === "lina@example.com"
        && inheritedProfile.currentCountry === "China"
        && inheritedProfile.passportNationality === "Pakistan"
        && inheritedProfile.educationStage === "Undergraduate student"
        && inheritedProfile.intendedLevel === "PhD"
        && inheritedProfile.subjectInterest === "Engineering"
        && inheritedProfile.fundingIntent === "Need full funding"
        && inheritedProfile.budgetRange === "RMB 25k-45k/year"
        && inheritedProfile.languageStatus === "HSK required"
        && inheritedProfile.hskStatus === "HSK needed"
        && inheritedProfile.academicSummary.includes("Engineering");
      if (!inheritedOk) throw new Error(`Student profile did not reuse account and onboarding answers: ${JSON.stringify(inheritedProfile)}`);
    });

    await runStep("payment issue persists to billing and notifications without school send", async () => {
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "application.html?motion=off");
      await prepareApplicationForPayment(cdp);
      await waitFor(cdp, "Boolean(document.querySelector('[data-open-payment]'))", "payment entry");
      await evaluate(cdp, "document.querySelector('[data-open-payment]').click()");
      await waitFor(cdp, "document.querySelector('[data-payment-modal]')?.classList.contains('open')", "payment modal");
      await evaluate(cdp, "document.querySelector('[data-payment-fail]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-payment-error]')?.textContent.includes('nothing has been sent to schools')",
        "payment failure copy",
      );
      const failedState = await evaluate(cdp, `
        (() => {
          const app = JSON.parse(localStorage.getItem('cuacApplicationDemoState') || '{}');
          const events = JSON.parse(localStorage.getItem('cuacNotificationEventsDemoState') || '{}');
          return app.paymentStatus === 'failed-preview'
            && app.submittedToSchools !== true
            && app.commerceOrder?.status === 'FAILED'
            && app.paymentCreateResult?.status === 'FAILED'
            && app.paymentCreateResult?.providerTxnId
            && Array.isArray(events.events)
            && events.events.some((event) => event.id === 'payment-issue-application-set');
        })()
      `);
      if (!failedState) throw new Error("Payment issue did not persist without sending to schools.");

      await navigate(cdp, "billing.html?motion=off");
      await waitFor(cdp, "document.body.textContent.includes('Payment issue') && document.body.textContent.includes('Choices saved, not sent') && document.body.textContent.includes('CSCAlite commerce flow') && document.body.textContent.includes('PaymentCreateResult.paymentId')", "billing payment issue state");

      await navigate(cdp, "notifications.html?motion=off");
      await waitFor(
        cdp,
        "[...document.querySelectorAll('.notice-row')].some((row) => row.textContent.includes('CUAC payment was not completed'))",
        "payment issue notification",
      );
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("application consent blocks school send with inline feedback", async () => {
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "application.html?motion=off");
      await prepareApplicationForPayment(cdp);
      await waitFor(cdp, "Boolean(document.querySelector('[data-open-payment]'))", "payment entry");
      await evaluate(cdp, "document.querySelector('[data-open-payment]').click()");
      await waitFor(cdp, "document.querySelector('[data-payment-modal]')?.classList.contains('open')", "payment modal");
      await evaluate(cdp, `
        (() => {
          const consent = document.querySelector('[data-submit-consent]');
          consent.checked = false;
          consent.dispatchEvent(new Event('change', { bubbles: true }));
          document.querySelector('[data-complete-payment]').click();
          return true;
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-payment-error]')?.textContent.includes('Confirm information sharing')",
        "consent inline error",
      );
      const blocked = await evaluate(cdp, `
        (() => {
          const app = JSON.parse(localStorage.getItem('cuacApplicationDemoState') || '{}');
          return document.querySelector('[data-payment-modal]')?.classList.contains('open')
            && app.submittedToSchools !== true
            && (!Array.isArray(app.submittedRecords) || app.submittedRecords.length === 0)
            && !localStorage.getItem('cuacSchoolPortalDemoState');
        })()
      `);
      if (!blocked) throw new Error("Application consent failure still sent or persisted school records.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("high-risk student Agent submit requires confirmation before payment modal", async () => {
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "application.html?motion=off");
      await prepareApplicationForPayment(cdp);
      await waitFor(cdp, "Boolean(document.querySelector('[data-cuac-agent-form]'))", "Application Agent form");
      await evaluate(cdp, `
        (() => {
          const input = document.querySelector('[data-cuac-agent-input]');
          const form = document.querySelector('[data-cuac-agent-form]');
          input.value = 'Submit my application to selected schools';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          form.requestSubmit();
          return true;
        })()
      `);
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-action=\"submit-application\"]'))", "submit application Agent action", 10000);
      await evaluate(cdp, "document.querySelector('[data-agent-action=\"submit-application\"]').click()");
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-confirmation]'))", "submit confirmation card");
      const notOpenedYet = await evaluate(cdp, `
        (() => {
          const app = JSON.parse(localStorage.getItem('cuacApplicationDemoState') || '{}');
          return !document.querySelector('[data-payment-modal]')?.classList.contains('open') && app.submittedToSchools !== true;
        })()
      `);
      if (!notOpenedYet) throw new Error("Student Agent submit opened payment or submitted before confirmation.");
      await evaluate(cdp, "document.querySelector('[data-agent-confirmation] [data-agent-confirmed=\"true\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-payment-modal]')?.classList.contains('open')", "payment modal after submit confirmation");
      const stillNotSubmitted = await evaluate(cdp, `
        (() => {
          const app = JSON.parse(localStorage.getItem('cuacApplicationDemoState') || '{}');
          return app.submittedToSchools !== true;
        })()
      `);
      if (!stillNotSubmitted) throw new Error("Student Agent submit sent to schools before payment/send confirmation.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("school portal default teacher notes are Chinese", async () => {
      await navigate(cdp, "school-portal.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInSchoolStaff(cdp);
      await navigate(cdp, "school-portal.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-note-text]')) && document.querySelector('[data-detail-source]')?.textContent.includes('预置记录')", "school default prepared detail");
      const chineseTeacherNotes = await evaluate(cdp, `
        (() => {
          const note = document.querySelector('[data-note-text]')?.textContent || '';
          const timeline = document.querySelector('[data-timeline]')?.textContent || '';
          const body = document.body.textContent || '';
          return note.includes('学生关注杭州英文授课计算机方向')
            && timeline.includes('CUAC 已收到学生路线选择')
            && !body.includes('Interested in a realistic English-taught CS route')
            && !body.includes('Strong engineering interest. The school should confirm lab availability')
            && !body.includes('Student is comparing spring options')
            && !body.includes('CUAC sent non-document application information for school follow-up');
        })()
      `);
      if (!chineseTeacherNotes) throw new Error("School portal exposed English system-generated teacher notes.");
    });

    await runStep("application send writes school-scoped record visible in school portal", async () => {
      await navigate(cdp, "application.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "application.html?motion=off");
      await prepareApplicationForPayment(cdp);
      await waitFor(cdp, "Boolean(document.querySelector('[data-open-payment]'))", "payment entry");
      await evaluate(cdp, "document.querySelector('[data-open-payment]').click()");
      await waitFor(cdp, "document.querySelector('[data-payment-modal]')?.classList.contains('open')", "payment modal");
      await evaluate(cdp, "document.querySelector('[data-complete-payment]').click()");
      await waitFor(cdp, "document.querySelector('[data-payment-simulation-status]')?.textContent.includes('Confirming payment') && JSON.parse(localStorage.getItem('cuacApplicationDemoState') || '{}').submittedToSchools !== true", "payment processing before school send");
      await waitFor(cdp, "Boolean(document.querySelector('[data-submission-status]:not([hidden])'))", "submitted state");
      const submitted = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacApplicationDemoState') || '{}');
          return Boolean(
            state.submittedToSchools
            && state.commerceOrder?.status === 'PAID'
            && state.commerceOrder?.payment?.status === 'SUCCEEDED'
            && state.paymentCreateResult?.status === 'SUCCEEDED'
            && state.paymentCreateResult?.callbackSignaturePayload?.includes('orderId=')
            && state.cartResult?.pricing?.currency === 'USD'
            && Array.isArray(state.submittedRecords)
            && state.submittedRecords.some((record) => record.school === 'Zhejiang University')
          );
        })()
      `);
      if (!submitted) throw new Error("Application did not persist a Zhejiang University school record.");

      await navigate(cdp, "notifications.html?motion=off");
      await waitFor(
        cdp,
        "[...document.querySelectorAll('.notice-row')].some((row) => row.textContent.includes('Application sent to'))",
        "application sent notification",
      );
      const submissionNotice = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacNotificationEventsDemoState') || '{}');
          return Array.isArray(state.events) && state.events.some((event) => event.id === 'application-submitted-to-schools' && event.type === 'document');
        })()
      `);
      if (!submissionNotice) throw new Error("Application submission did not persist a student notification event.");

      await navigate(cdp, "application.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-submit-action]')?.textContent.includes('View sent status')", "submitted CTA state");
      await evaluate(cdp, "document.querySelector('[data-submit-action]').click()");
      await waitFor(cdp, "location.hash === '#send' && Boolean(document.querySelector('[data-submission-status]:not([hidden])'))", "submitted CTA opens sent status");

      await signInSchoolStaff(cdp);
      await navigate(cdp, "school-portal.html?motion=off");
      await waitFor(cdp, "!document.querySelector('[data-submission-receipt]')?.hidden", "school receipt");
      await waitFor(cdp, "document.querySelector('[data-detail-source]')?.textContent.includes('CUAC 实时提交')", "received record detail");
      const tenantOnly = await evaluate(cdp, `
        (() => {
          const body = document.body.textContent || '';
          return body.includes('本门户不会显示学生申请的其他学校') && !body.includes('Nanjing University received') && !body.includes('UIBE received');
        })()
      `);
      if (!tenantOnly) throw new Error("School portal did not preserve tenant-only receipt copy.");

      const viewedOk = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacSchoolPortalDemoState') || '{}');
          return state.schoolFollowups?.['Zhejiang University']?.statusKey === 'viewed';
        })()
      `);
      if (!viewedOk) throw new Error("School viewed state was not persisted for the student loop.");

      await signInStudent(cdp);
      await navigate(cdp, "application.html?motion=off");
      await waitFor(
        cdp,
        "[...document.querySelectorAll('[data-school-status]')].some((card) => card.dataset.schoolStatus === 'Zhejiang University' && card.classList.contains('viewed') && card.textContent.includes('School viewed your CUAC record'))",
        "student application viewed status",
      );
      await navigate(cdp, "hub.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-application-title]')?.textContent.includes('School viewed your record')", "hub viewed status");

      await signInSchoolStaff(cdp);
      await navigate(cdp, "school-portal.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-mark-contacted]'))", "mark contacted button after viewed check");
    });

    await runStep("school mark contacted updates status and student-loop storage", async () => {
      await waitFor(cdp, "Boolean(document.querySelector('[data-mark-contacted]'))", "mark contacted button");
      await evaluate(cdp, "document.querySelector('[data-mark-contacted]').click()");
      await waitFor(cdp, "document.querySelector('[data-detail-status]')?.textContent === '已联系'", "contacted status");
      const storageOk = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacSchoolPortalDemoState') || '{}');
          return Array.isArray(state.contactedSchools)
            && state.contactedSchools.includes('Zhejiang University')
            && state.schoolFollowups?.['Zhejiang University']?.statusKey === 'contacted';
        })()
      `);
      if (!storageOk) throw new Error("School contacted state was not persisted for the student loop.");

      await waitFor(cdp, "Boolean(document.querySelector('[data-mark-waiting]'))", "mark waiting button");
      await evaluate(cdp, "document.querySelector('[data-mark-waiting]').click()");
      await waitFor(cdp, "document.querySelector('[data-detail-status]')?.textContent === '等待材料'", "waiting documents status");
      const waitingStorageOk = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacSchoolPortalDemoState') || '{}');
          return state.schoolFollowups?.['Zhejiang University']?.statusKey === 'waiting-documents'
            && /护照|成绩单|语言证明/.test(state.schoolFollowups['Zhejiang University'].nextAction || '');
        })()
      `);
      if (!waitingStorageOk) throw new Error("School waiting-for-documents state was not persisted for the student loop.");

      await signInStudent(cdp);
      await navigate(cdp, "application.html?motion=off");
      await waitFor(
        cdp,
        "[...document.querySelectorAll('[data-school-status]')].some((card) => card.dataset.schoolStatus === 'Zhejiang University' && card.classList.contains('waiting') && card.textContent.includes('Waiting for documents'))",
        "student application waiting status",
      );
      await navigate(cdp, "hub.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-application-title]')?.textContent.includes('Documents needed')", "hub waiting status");
      await navigate(cdp, "notifications.html?motion=off");
      await waitFor(
        cdp,
        "[...document.querySelectorAll('.notice-row')].some((row) => row.textContent.includes('Zhejiang University contacted the student'))",
        "school contacted notification",
      );
      await waitFor(
        cdp,
        "[...document.querySelectorAll('.notice-row')].some((row) => row.textContent.includes('Zhejiang University is waiting for documents'))",
        "school waiting documents notification",
      );
      const schoolEventHasLocalizedCopy = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacNotificationEventsDemoState') || '{}');
          return state.events?.some((event) => event.id === 'school-contacted-zhejiang-university'
            && event.localized?.zh?.title?.includes('已联系学生')
            && event.localized?.zh?.body?.includes('不通过 CUAC 上传'))
            && state.events?.some((event) => event.id === 'school-waiting-documents-zhejiang-university'
              && event.localized?.zh?.title?.includes('正在等待材料'));
        })()
      `);
      if (!schoolEventHasLocalizedCopy) throw new Error("School-origin student notifications did not persist localized copy for preference-based rendering.");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacPreferencesDemoState') || '{}');
          localStorage.setItem('cuacPreferencesDemoState', JSON.stringify({
            ...state,
            workspace: {
              ...(state.workspace || {}),
              language: { ...((state.workspace || {}).language || {}), interfaceLanguage: 'Chinese' }
            }
          }));
        })()
      `);
      await navigate(cdp, "notifications.html?motion=off");
      await waitFor(
        cdp,
        "[...document.querySelectorAll('.notice-row')].some((row) => row.textContent.includes('Zhejiang University 已联系学生')) && [...document.querySelectorAll('.notice-row')].some((row) => row.textContent.includes('Zhejiang University 正在等待材料'))",
        "school notifications follow student language preference",
      );
      const localizedRows = await evaluate(cdp, `
        (() => {
          const contacted = document.querySelector('[data-notice-id="school-contacted-zhejiang-university"]')?.textContent || '';
          const waiting = document.querySelector('[data-notice-id="school-waiting-documents-zhejiang-university"]')?.textContent || '';
          return contacted.includes('正式材料应按学校流程提交')
            && contacted.includes('打开申请')
            && waiting.includes('学生应继续按学校自己的材料要求处理')
            && !contacted.includes('contacted the student')
            && !waiting.includes('is waiting for documents');
        })()
      `);
      if (!localizedRows) throw new Error("Notifications did not render the school event in the student's selected language.");
    });
  });

  await withBrowser(async (cdp) => {
      await runStep("high-risk school Agent action requires confirmation before applying", async () => {
      await navigate(cdp, "school-portal.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInSchoolStaff(cdp);
      await navigate(cdp, "school-portal.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-select-record]'))", "school record selector");
      await evaluate(cdp, `
        (() => {
          const checkbox = document.querySelector('[data-select-record]');
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          const input = document.querySelector('[data-cuac-agent-input]');
          const form = document.querySelector('[data-cuac-agent-form]');
          input.value = 'Which Zhejiang University applicants need first contact?';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          form.requestSubmit();
          return true;
        })()
      `);
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-action=\"school-bulk-contact\"]'))", "school bulk contact Agent action", 10000);
      await evaluate(cdp, "document.querySelector('[data-agent-action=\"school-bulk-contact\"]').click()");
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-confirmation]'))", "Agent confirmation card");
      const notAppliedYet = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacSchoolPortalDemoState') || '{}');
          return !Array.isArray(state.contactedSchools) || !state.contactedSchools.includes('Zhejiang University');
        })()
      `);
      if (!notAppliedYet) throw new Error("High-risk school Agent action applied before confirmation.");
      await evaluate(cdp, "document.querySelector('[data-agent-confirmation] [data-agent-confirmed=\"true\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-portal-toast]')?.textContent.includes('已为')",
        "confirmed school Agent action toast",
      );
      const applied = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacSchoolPortalDemoState') || '{}');
          return Array.isArray(state.contactedSchools) && state.contactedSchools.includes('Zhejiang University');
        })()
      `);
      if (!applied) throw new Error("Confirmed high-risk school Agent action did not update tenant state.");
    });
  });

  await withBrowser(async (cdp) => {
      await runStep("high-risk school Agent export requires confirmation and persists tenant scope", async () => {
      await navigate(cdp, "school-portal.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInSchoolStaff(cdp);
      await navigate(cdp, "school-portal.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-cuac-agent-form]'))", "School Agent form");
      await evaluate(cdp, `
        (() => {
          const input = document.querySelector('[data-cuac-agent-input]');
          const form = document.querySelector('[data-cuac-agent-form]');
          input.value = "Export this school's visible CUAC records";
          input.dispatchEvent(new Event('input', { bubbles: true }));
          form.requestSubmit();
          return true;
        })()
      `);
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-action=\"school-export-csv\"]'))", "school export Agent action", 10000);
      await evaluate(cdp, "document.querySelector('[data-agent-action=\"school-export-csv\"]').click()");
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-confirmation]'))", "Agent export confirmation card");
      const notExportedYet = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacSchoolPortalDemoState') || '{}');
          return !Array.isArray(state.exportEvents) && !state.lastExport;
        })()
      `);
      if (!notExportedYet) throw new Error("High-risk tenant export persisted before confirmation.");
      await evaluate(cdp, "document.querySelector('[data-agent-confirmation] [data-agent-confirmed=\"true\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-portal-toast]')?.textContent.includes('已为浙江大学准备 CSV 导出')",
        "confirmed tenant export toast",
      );
      const tenantExport = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacSchoolPortalDemoState') || '{}');
          const event = state.lastExport || {};
          return Array.isArray(state.exportEvents)
            && state.exportEvents.length > 0
            && event.school === 'Zhejiang University'
            && event.scope === 'tenant-only'
            && event.source === 'agent'
            && event.recordCount === document.querySelectorAll('[data-record-row]').length
            && Array.isArray(event.visibleRecordIds)
            && !JSON.stringify(event).includes('Nanjing University')
            && !JSON.stringify(event).includes('UIBE');
        })()
      `);
      if (!tenantExport) throw new Error("Confirmed school export did not persist tenant-only export state.");
    });
  });

  await withBrowser(async (cdp) => {
      await runStep("school settings saves editable tenant template", async () => {
      await navigate(cdp, "school-settings.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInSchoolStaff(cdp);
      await navigate(cdp, "school-settings.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-school-template]'))", "school settings template editor");
      await evaluate(cdp, `
        (() => {
          const template = document.querySelector('[data-school-template]');
          template.value = 'Hello Maya, please send transcript and passport directly to Zhejiang University.';
          template.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-school-settings-save]').click();
          return true;
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('租户范围仍锁定为浙江大学')",
        "school settings saved toast",
      );
      const saved = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacSchoolSettingsDemoState') || '{}');
          return Boolean(state.template?.includes('Zhejiang University') && state.savedAt);
        })()
      `);
      if (!saved) throw new Error("School settings template was not persisted in demo state.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("ops admin in-page navigation never blanks sections", async () => {
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await navigate(cdp, "ops-admin.html?motion=off");
      await installRuntimeErrorTrap(cdp);

      const topLevelOk = await evaluate(cdp, `
        (() => {
          const tabs = ["overview", "school", "students", "content", "access", "queue"];
          return tabs.map((key) => {
            document.querySelector(\`[data-ops-tab="\${key}"]\`)?.click();
            const panel = document.querySelector(\`[data-ops-section="\${key}"]\`);
            const text = panel?.textContent?.trim() || "";
            return {
              key,
              active: Boolean(panel && !panel.hidden),
              enoughContent: text.length > 120,
              hasBlankRecovery: Boolean(document.querySelector(".ops-error-state")),
            };
          });
        })()
      `);
      const failedTopLevel = topLevelOk.filter((item) => !item.active || !item.enoughContent || item.hasBlankRecovery);
      if (failedTopLevel.length) throw new Error(`Ops top-level navigation produced blank panels: ${JSON.stringify(failedTopLevel)}`);

      const schoolTabsOk = await evaluate(cdp, `
        (() => {
          document.querySelector('[data-ops-tab="school"]')?.click();
          document.querySelector('[data-ops-school-view="edit"]')?.click();
          const tabs = ["overview", "basic", "admissions", "costs", "contact", "programs", "scholarships", "source", "logs"];
          return tabs.map((key) => {
            document.querySelector(\`[data-ops-school-tab="\${key}"]\`)?.click();
            const active = document.querySelector(\`[data-ops-school-tab="\${key}"]\`)?.classList.contains("active");
            const panel = document.querySelector('[data-ops-school-editor] .ops-editor-panel');
            const text = panel?.textContent?.trim() || "";
            return {
              key,
              active: Boolean(active),
              enoughContent: text.length > 80,
              hasBlankRecovery: Boolean(document.querySelector(".ops-error-state")),
            };
          });
        })()
      `);
      const failedSchoolTabs = schoolTabsOk.filter((item) => !item.active || !item.enoughContent || item.hasBlankRecovery);
      if (failedSchoolTabs.length) throw new Error(`Ops school editor tabs produced blank panels: ${JSON.stringify(failedSchoolTabs)}`);

      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"overview\"]')?.click()");
      await waitFor(
        cdp,
        "Boolean(document.querySelector('[data-ops-school-public-preview]')) && document.body.textContent.includes('学生端影响预览') && document.body.textContent.includes('学生端展示字段') && !document.body.textContent.includes('CSCAlite 展示字段') && document.body.textContent.includes('待补字段') && Boolean(document.querySelector('[data-ops-school-public-preview] a[href*=\"university-detail.html\"]'))",
        "ops school overview tab shows public preview and student-facing field summary",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"basic\"]')?.click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-ops-school-tab=\"basic\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-school-field=\"nameZh\"]')) && Boolean(document.querySelector('[data-ops-school-field=\"nameEn\"]')) && !document.querySelector('[data-ops-school-editor] .ops-editor-panel [data-ops-school-public-preview]')",
        "ops school basic tab keeps editable school profile fields without public preview",
      );

      const contentTabsOk = await evaluate(cdp, `
        (() => {
          document.querySelector('[data-ops-tab="content"]')?.click();
          const tabs = ["cities", "scholarships", "timeline"];
          return tabs.map((key) => {
            document.querySelector(\`[data-ops-content-tab="\${key}"]\`)?.click();
            const active = document.querySelector(\`[data-ops-content-tab="\${key}"]\`)?.classList.contains("active");
            const panel = document.querySelector('[data-ops-section="content"]');
            const text = panel?.textContent?.trim() || "";
            return {
              key,
              active: Boolean(active && panel && !panel.hidden),
              enoughContent: text.length > 200,
              createType: document.querySelector("[data-ops-content-create]")?.dataset.contentType || "",
              hasBlankRecovery: Boolean(document.querySelector(".ops-error-state")),
            };
          });
        })()
      `);
      const failedContentTabs = contentTabsOk.filter((item) => !item.active || !item.enoughContent || item.createType !== item.key || item.hasBlankRecovery);
      if (failedContentTabs.length) throw new Error(`Ops content tabs produced blank panels: ${JSON.stringify(failedContentTabs)}`);
      await evaluate(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.click()");
      await waitFor(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active') && document.querySelector('[data-ops-content-create]')?.dataset.contentType === 'scholarships'", "ops public scholarships content tab");
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]')?.click()");
      await waitFor(
        cdp,
        "Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && document.body.textContent.includes('新公共奖学金草稿') && document.querySelector('[data-ops-section=\"content\"]')?.hidden === false && !document.querySelector('.ops-error-state')",
        "ops public scholarship create keeps page rendered",
      );
      const scholarshipEditorTabsOk = await evaluate(cdp, `
        (() => {
          const editor = document.querySelector('[data-ops-content-editor][data-content-type="scholarships"]');
          if (!editor) return [{ key: 'missing-editor', active: false, enoughContent: false, hasEditableOrPicker: false, hasBlankRecovery: true }];
          return [...editor.querySelectorAll('[data-ops-content-editor-tab]')].map((tab) => {
            tab.click();
            const panelKey = tab.dataset.opsContentEditorTab || '';
            const panel = editor.querySelector(\`[data-ops-content-editor-panel="\${panelKey}"]\`);
            const text = panel?.textContent?.trim() || '';
            return {
              key: tab.textContent?.trim() || panelKey,
              active: tab.classList.contains('active') && Boolean(panel && !panel.hidden),
              enoughContent: text.length > 8,
              hasEditableOrPicker: Boolean(panel?.querySelector('[data-ops-content-field], [data-ops-scholarship-school-picker], [data-ops-scholarship-program-picker]')),
              hasBlankRecovery: Boolean(document.querySelector('.ops-error-state')),
            };
          });
        })()
      `);
      const failedScholarshipEditorTabs = scholarshipEditorTabsOk.filter((item) => !item.active || !item.enoughContent || !item.hasEditableOrPicker || item.hasBlankRecovery);
      if (failedScholarshipEditorTabs.length) throw new Error(`Ops scholarship editor tabs produced blank panels: ${JSON.stringify(failedScholarshipEditorTabs)}`);
      await assertNoRuntimeErrors(cdp, "ops in-page navigation raised runtime error");
    });

      await runStep("ops admin retry action writes audited local state", async () => {
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await navigate(cdp, "ops-admin.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-action=\"retry-routing\"]'))", "ops retry action");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"school\"]').hidden", "ops school section");
      await evaluate(cdp, "document.querySelector('[data-ops-school-import-toggle]').click()");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-school-import-text]')) && document.body.textContent.includes('批量 JSON 导入')", "ops school import panel opens");
      await evaluate(cdp, `
        (() => {
          const area = document.querySelector('[data-ops-school-import-text]');
          if (!area) throw new Error('Missing school import textarea');
          area.value = ${JSON.stringify(JSON.stringify({ items: [{ nameEn: "Broken School Import" }] }, null, 2))};
          document.querySelector('[data-ops-school-import-preview]').click();
        })()
      `);
      await waitFor(cdp, "document.body.textContent.includes('第 1 条缺少 nameZh') && Boolean(document.querySelector('[data-ops-school-import-text]')) && !document.querySelector('.ops-error-state')", "ops school invalid import shows inline error");
      await evaluate(cdp, "document.querySelector('[data-ops-school-import-apply]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('导入失败') && document.body.textContent.includes('第 1 条缺少 nameZh')", "ops school invalid import apply blocked");
      const invalidSchoolImportBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const text = document.querySelector('[data-ops-school-import-text]')?.value || '';
          return Boolean(state.schoolImportOpen === true
            && state.schoolImportPreview?.tone === 'danger'
            && text.includes('Broken School Import')
            && !state.schoolRecords?.some((school) => school.nameEn === 'Broken School Import'));
        })()
      `);
      if (!invalidSchoolImportBlocked) throw new Error("Ops school invalid JSON import did not stay editable or incorrectly wrote a record.");
      await evaluate(cdp, `
        (() => {
          const area = document.querySelector('[data-ops-school-import-text]');
          if (!area) throw new Error('Missing school import textarea');
          area.value = ${JSON.stringify(JSON.stringify([
            {
              source: "CSCAlite",
              sourceId: "bulk-demo-001",
              nameZh: "批量导入大学",
              nameEn: "Bulk Import University",
              cityZh: "南京",
              region: "江苏",
              rank: 88,
              schoolType: "regular",
              status: "published",
              verificationStatus: "verified",
              createdAt: "2026-08-01T00:00:00.000Z",
              updatedAt: "2026-08-20T00:00:00.000Z",
              completenessLabel: "字段完整",
              missingFields: ["officialNoticePdf"],
              applicationLevel: "Bachelor / Master / PhD",
              cscaSubjects: ["数学", "英语"],
              englishRequirement: "IELTS 6.0 or university waiver.",
              deadlineSummary: "Main round Oct 15; second round Dec 20.",
              officialWebsiteUrl: "https://bulk.example.edu",
              admissionsWebsiteUrl: "https://apply.bulk.example.edu",
              contactTel: "+86 25 0000 0000",
              contactEmail: "admissions@bulk.example.edu",
              contactAddress: "南京市国际学生办公室",
              yearEstablished: 1998,
              studentCount: "约 18,000 名学生",
              studentsServed: 0,
              under18GuardianRequired: false,
              under18RequirementNote: "未满 18 岁申请人需按学校当年政策确认监护安排。",
              qualityScore: 95,
              sourceLabel: "CSCAlite import demo",
              sourceNote: "Imported from legacy admin schools fixture.",
              languageRequirement: "English-taught programs require IELTS or school waiver.",
              languageOfInstruction: ["Chinese-taught", "English-taught"],
              hskChineseMinLevel: 5,
              hskChineseMinListening: 60,
              hskChineseMinReading: 60,
              hskChineseMinWriting: 60,
              hskChineseConditional: "Conditional Chinese-taught route may be reviewed.",
              hskEnglishRequired: false,
              hskkRequired: true,
              hskkChineseMinLevel: 2,
              hskkChineseConditional: "Interview may replace HSKK for some programs.",
              featuredPrograms: ["Data Science MSc", "Engineering Foundation"],
              fitNotes: ["Good for English-taught STEM applicants", "Check scholarship fit early"],
              subjectTags: ["Data Science", "Engineering"],
              languageTags: ["English-taught", "Chinese-taught"],
              tuitionBandLabel: "Medium tuition",
              hasEnglishPrograms: true,
              hasScholarships: true,
              decisionSummary: "Strong English-taught route with scholarship review.",
              programSubjectTags: ["Computer Science", "Engineering"],
              programTuitionBandLabel: "RMB 30k-45k",
              programQualityIssues: ["Confirm deadline annually"],
              requiredSubjectTags: ["Mathematics"],
              derivedTags: ["application-ready", "english-route"],
              scholarships: ["CSC", "School scholarship"],
              programFields: ["Data Science", "Engineering"],
              programs: [
                {
                  id: "bulk-prog-001",
                  nameZh: "数据科学硕士",
                  nameEn: "Data Science MSc",
                  degreeLevel: "Master",
                  teachingLanguage: "English-taught",
                  openDate: "Sep 1",
                  sortOrder: 1,
                  status: "published"
                }
              ],
              cscaRules: [
                {
                  id: "bulk-rule-001",
                  title: "导入 CSCA 规则",
                  category: "program",
                  programId: "bulk-prog-001",
                  applicablePrograms: ["bulk-prog-001"],
                  cscaSubjects: ["数学"],
                  sortOrder: 1,
                  status: "published"
                }
              ],
              scholarshipsDetailed: [
                {
                  id: "bulk-scholarship-001",
                  name: "导入校级奖学金",
                  type: "university",
                  programId: "bulk-prog-001",
                  applicableProgram: "Data Science MSc",
                  amountText: "Partial tuition",
                  sortOrder: 1,
                  status: "published"
                }
              ]
            }
          ], null, 2))};
          document.querySelector('[data-ops-school-import-preview]').click();
        })()
      `);
      await waitFor(cdp, "document.body.textContent.includes('已识别 1 所学校') && !document.querySelector('.ops-error-state')", "ops school import preview validates");
      await evaluate(cdp, "document.querySelector('[data-ops-school-import-apply]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('导入完成：新增 1') && document.body.textContent.includes('批量导入大学')", "ops school import applies");
      await evaluate(cdp, `
        (() => {
          const filter = document.querySelector('[data-ops-school-filter]');
          if (!filter) throw new Error('Missing ops school status filter');
          filter.value = 'published';
          document.querySelector('[data-ops-school-apply-filter]').click();
        })()
      `);
      await waitFor(cdp, "document.body.textContent.includes('批量导入大学') && document.querySelector('[data-ops-school-filter]')?.value === 'published'", "ops school published filter matches CSCAlite status");
      const schoolImported = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '批量导入大学');
          const logs = state.schoolChangeLogs?.[school?.id] || [];
          return Boolean(school
            && school.source === 'CSCAlite'
            && school.sourceId === 'bulk-demo-001'
            && school.officialWebsite === 'https://bulk.example.edu'
            && school.applicationSystemUrl === 'https://apply.bulk.example.edu'
            && school.qualityScore === 95
            && school.dataQualityScore === 95
            && Array.isArray(school.programs)
            && school.programs.some((program) => program.nameZh === '数据科学硕士')
            && logs.some((log) => log.action === 'import_school_create'));
        })()
      `);
      if (!schoolImported) throw new Error("Ops school bulk import did not persist CSCAlite-shaped school data and SchoolChangeLog.");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-action=\"edit-school\"]'))", "ops school edit action");
      await evaluate(cdp, "document.querySelector('[data-ops-action=\"edit-school\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('已打开学校目录编辑器')",
        "ops school edit toast",
      );
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-school-editor]'))", "ops school editor");
      const schoolRecordMetaVisible = await evaluate(cdp, `
        (() => {
          const editor = document.querySelector('[data-ops-school-editor]');
          return editor?.dataset.schoolId === 'bulk-demo-001'
            && editor?.dataset.schoolVersion === '1'
            && !document.querySelector('[data-ops-school-field="id"]')
            && !document.querySelector('[data-ops-school-field="version"]');
        })()
      `);
      if (!schoolRecordMetaVisible) throw new Error("Ops school editor did not keep AdminSchoolSummary id/version out of editable fields.");
      const schoolPublishedStatusVisible = await evaluate(cdp, `
        (() => {
          const field = document.querySelector('[data-ops-school-field="status"]');
          const pillText = document.querySelector('.ops-school-card.selected .status-pill')?.textContent || '';
          return field?.value === 'published'
            && pillText.includes('已发布')
            && !pillText.includes('published');
        })()
      `);
      if (!schoolPublishedStatusVisible) throw new Error("Ops school editor did not display CSCAlite published status correctly.");
      const importedMainFieldsVisible = await evaluate(cdp, `
        (() => {
          const schoolType = document.querySelector('[data-ops-school-field="schoolType"]');
          const region = document.querySelector('[data-ops-school-field="region"]');
          const rank = document.querySelector('[data-ops-school-field="rank"]');
          const verification = document.querySelector('[data-ops-school-field="verificationStatus"]');
          const completeness = document.querySelector('[data-ops-school-field="completenessLabel"]');
          const missing = document.querySelector('[data-ops-school-field="missingFields"]');
          return schoolType?.value === 'regular'
            && region?.value === '江苏'
            && !rank
            && !verification
            && !completeness
            && !missing;
        })()
      `);
      if (!importedMainFieldsVisible) throw new Error("Ops school editor did not keep only CSCAlite AdminSchool main fields visible.");
      await evaluate(cdp, `
        (() => {
          const name = document.querySelector('[data-ops-school-field="nameZh"]');
          name.value = '未保存切换保护大学';
          name.dispatchEvent(new Event('input', { bubbles: true }));
          const other = [...document.querySelectorAll('[data-ops-school-edit]')].find((button) => button.dataset.schoolId !== 'bulk-demo-001');
          if (!other) throw new Error('No other school row available for dirty switch guard');
          other.click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-ops-school-switch-confirm]')?.hidden === false && document.querySelector('[data-completion-toast]')?.textContent.includes('未保存改动')", "ops school dirty switch confirmation");
      const dirtySwitchBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const editor = document.querySelector('[data-ops-school-editor]');
          return state.selectedSchoolId === 'bulk-demo-001'
            && editor?.dataset.schoolId === 'bulk-demo-001'
            && editor?.dataset.dirty === 'true'
            && document.querySelector('[data-ops-school-unsaved-warning]')?.hidden === false;
        })()
      `);
      if (!dirtySwitchBlocked) throw new Error("Ops school editor did not block switching away from unsaved CSCAlite school fields.");
      await evaluate(cdp, "document.querySelector('[data-ops-school-discard-switch]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-editor]')?.dataset.schoolId !== 'bulk-demo-001'", "ops school dirty discard continues switch");
      await evaluate(cdp, "document.querySelector('[data-ops-school-edit][data-school-id=\"bulk-demo-001\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-editor]')?.dataset.schoolId === 'bulk-demo-001'", "ops school editor returns to imported school after dirty guard");
      await evaluate(cdp, `
        (() => {
          const name = document.querySelector('[data-ops-school-field="nameZh"]');
          if (!name) throw new Error('Missing AdminSchool.nameZh for dirty archive guard');
          name.value = '未保存归档保护大学';
          name.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-school-archive]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-ops-school-unsaved-warning]')?.hidden === false && document.querySelector('[data-completion-toast]')?.textContent.includes('先保存修改再归档')", "ops school dirty archive guard");
      const dirtyArchiveBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => String(item.id) === 'bulk-demo-001');
          return Boolean(document.querySelector('[data-ops-school-editor]')?.dataset.dirty === 'true'
            && school?.nameZh === '批量导入大学'
            && school?.status !== '已归档');
        })()
      `);
      if (!dirtyArchiveBlocked) throw new Error("Ops school archive should be blocked while AdminSchool fields are unsaved.");
      await evaluate(cdp, `
        (() => {
          const name = document.querySelector('[data-ops-school-field="nameZh"]');
          if (!name) throw new Error('Missing AdminSchool.nameZh for dirty archive recovery');
          name.value = '批量导入大学';
          name.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-school-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('学校字段已本地保存')", "ops school dirty archive save recovery");
      const schoolVersionIncremented = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.id === 'bulk-demo-001');
          return Number(school?.version || 0) > 1;
        })()
      `);
      if (!schoolVersionIncremented) throw new Error("Ops AdminSchool save did not increment version for CSCAlite expectedVersion alignment.");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          state.schoolRecords = (state.schoolRecords || []).map((school) => (
            school.id === 'bulk-demo-001'
              ? { ...school, version: Number(school.version || 1) + 1, next: '其他管理员已更新学校' }
              : school
          ));
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
          const name = document.querySelector('[data-ops-school-field="nameZh"]');
          if (!name) throw new Error('Missing AdminSchool.nameZh for stale save check');
          name.value = '过期保存大学';
          name.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-school-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('学校已被其他管理员更新，请刷新后再继续')", "ops school stale save conflict toast");
      const schoolStaleSaveBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.id === 'bulk-demo-001');
          return Boolean(school?.nameZh === '批量导入大学'
            && school?.next === '其他管理员已更新学校'
            && document.querySelector('[data-ops-school-editor]')?.dataset.dirty === 'true');
        })()
      `);
      if (!schoolStaleSaveBlocked) throw new Error("Ops AdminSchool stale save overwrote a newer CSCAlite-shaped record.");
      await navigate(cdp, "ops-admin.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-tab=\"school\"]'))", "ops school tab after stale save refresh");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"school\"]').hidden && Boolean(document.querySelector('[data-ops-school-edit][data-school-id=\"bulk-demo-001\"]'))", "ops school list after stale save refresh");
      await evaluate(cdp, "document.querySelector('[data-ops-school-edit][data-school-id=\"bulk-demo-001\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-editor]')?.dataset.schoolId === 'bulk-demo-001'", "ops school editor after stale save refresh");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          state.schoolRecords = (state.schoolRecords || []).map((school) => (
            school.id === 'bulk-demo-001'
              ? { ...school, version: Number(school.version || 1) + 1, status: 'published' }
              : school
          ));
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
          document.querySelector('[data-ops-school-archive]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('学校已被其他管理员更新，请刷新后再继续')", "ops school stale archive conflict toast");
      const schoolStaleArchiveBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.id === 'bulk-demo-001');
          return school?.status === 'published';
        })()
      `);
      if (!schoolStaleArchiveBlocked) throw new Error("Ops AdminSchool stale archive overwrote a newer CSCAlite-shaped record.");
      await navigate(cdp, "ops-admin.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-tab=\"school\"]'))", "ops school tab after stale archive refresh");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"school\"]').hidden && Boolean(document.querySelector('[data-ops-school-edit][data-school-id=\"bulk-demo-001\"]'))", "ops school list after stale archive refresh");
      await evaluate(cdp, "document.querySelector('[data-ops-school-edit][data-school-id=\"bulk-demo-001\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-editor]')?.dataset.schoolId === 'bulk-demo-001'", "ops school editor after stale archive refresh");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"costs\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"costs\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-school-field=\"officialWebsiteUrl\"]'))", "ops imported school cost and link fields");
      const importedLinkFieldsVisible = await evaluate(cdp, `
        (() => {
          const officialAlias = document.querySelector('[data-ops-school-field="officialWebsiteUrl"]');
          const admissionsAlias = document.querySelector('[data-ops-school-field="admissionsWebsiteUrl"]');
          const tuition = document.querySelector('[data-ops-school-field="tuitionSummary"]');
          const fee = document.querySelector('[data-ops-school-field="applicationFee"]');
          const official = document.querySelector('[data-ops-school-field="officialWebsite"]');
          const quality = document.querySelector('[data-ops-school-field="qualityScore"]');
          return officialAlias?.value === 'https://bulk.example.edu'
            && admissionsAlias?.value === 'https://apply.bulk.example.edu'
            && Boolean(tuition)
            && Boolean(fee)
            && !official
            && !quality;
        })()
      `);
      if (!importedLinkFieldsVisible) throw new Error("Ops school editor did not expose CSCAlite tuition/application fee/link fields.");
      await evaluate(cdp, `
        (() => {
          document.querySelector('[data-ops-school-field="officialWebsiteUrl"]').value = 'https://www.bulk-updated.edu';
          document.querySelector('[data-ops-school-field="admissionsWebsiteUrl"]').value = 'https://apply.bulk-updated.edu';
          document.querySelector('[data-ops-school-field="tuitionSummary"]').value = '本科：RMB 20,000/年；硕士：RMB 30,000/年';
          document.querySelector('[data-ops-school-field="applicationFee"]').value = 'RMB 600';
          document.querySelector('[data-ops-school-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('学校字段已本地保存')", "ops school CSCAlite links and cost save");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"source\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"source\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-school-field=\"sourceId\"]'))", "ops imported school source fields");
      const importedSourceFieldsVisible = await evaluate(cdp, `
        (() => {
          const source = document.querySelector('[data-ops-school-field="source"]');
          const sourceId = document.querySelector('[data-ops-school-field="sourceId"]');
          const sourceUrl = document.querySelector('[data-ops-school-field="sourceUrl"]');
          const sourceLabel = document.querySelector('[data-ops-school-field="sourceLabel"]');
          const sourceNote = document.querySelector('[data-ops-school-field="sourceNote"]');
          const verification = document.querySelector('[data-ops-school-field="verificationStatus"]');
          const quality = document.querySelector('[data-ops-school-field="qualityScore"]');
          const completeness = document.querySelector('[data-ops-school-field="completenessLabel"]');
          const missing = document.querySelector('[data-ops-school-field="missingFields"]');
          const createdAt = document.querySelector('[data-ops-school-field="createdAt"]');
          const updatedAt = document.querySelector('[data-ops-school-field="updatedAt"]');
          const readonly = document.querySelector('[data-ops-school-record-readonly]');
          return source?.value === 'CSCAlite'
            && sourceId?.value === 'bulk-demo-001'
            && Boolean(sourceUrl)
            && !sourceLabel
            && !sourceNote
            && !verification
            && !quality
            && !completeness
            && !missing
            && !createdAt
            && !updatedAt
            && Boolean(readonly)
            && readonly.textContent.includes('本区只编辑学校档案的可维护字段')
            && readonly.textContent.includes('CSCAlite import demo')
            && readonly.textContent.includes('legacy admin schools')
            && readonly.textContent.includes('verified')
            && readonly.textContent.includes('95')
            && readonly.textContent.includes('字段完整')
            && readonly.textContent.includes('officialNoticePdf')
            && Boolean(document.querySelector('[data-source-field="AdminSchoolSummary.verificationStatus"]'))
            && Boolean(document.querySelector('[data-source-field="AdminSchoolSummary.missingFields"]'));
        })()
      `);
      if (!importedSourceFieldsVisible) throw new Error("Ops school editor did not separate CSCAlite source inputs from readonly summary fields.");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"admissions\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"admissions\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-school-field=\"languageOfInstruction\"]'))", "ops imported school language list field");
      const importedLanguageListVisible = await evaluate(cdp, `
        (() => {
          const applicationLevel = document.querySelector('[data-ops-school-field="applicationLevel"]');
          const cscaSubjects = document.querySelector('[data-ops-school-field="cscaSubjects"]');
          const requirement = document.querySelector('[data-ops-school-field="languageRequirement"]');
          const englishRequirement = document.querySelector('[data-ops-school-field="englishRequirement"]');
          const deadlineSummary = document.querySelector('[data-ops-school-field="deadlineSummary"]');
          const field = document.querySelector('[data-ops-school-field="languageOfInstruction"]');
          const englishPrograms = document.querySelector('[data-ops-school-field="englishPrograms"]');
          const programFields = document.querySelector('[data-ops-school-field="programFields"]');
          const hskListening = document.querySelector('[data-ops-school-field="hskChineseMinListening"]');
          const hskkRequired = document.querySelector('[data-ops-school-field="hskkRequired"]');
          return !applicationLevel
            && !cscaSubjects
            && requirement?.value.includes('IELTS or school waiver')
            && !englishRequirement
            && !deadlineSummary
            && field?.value.includes('Chinese-taught')
            && field.value.includes('English-taught')
            && !field.value.includes(',')
            && Boolean(englishPrograms)
            && programFields?.value.includes('Data Science')
            && !hskListening
            && !hskkRequired;
        })()
      `);
      if (!importedLanguageListVisible) throw new Error("Ops school editor did not display CSCAlite languageRequirement/languageOfInstruction fields.");
      await evaluate(cdp, `
        (() => {
          document.querySelector('[data-ops-school-field="languageRequirement"]').value = 'English-taught programs require IELTS or school waiver. Chinese routes require official HSK review.';
          const field = document.querySelector('[data-ops-school-field="languageOfInstruction"]');
          field.value = 'Chinese-taught\\nEnglish-taught\\nBilingual route';
          document.querySelector('[data-ops-school-field="englishPrograms"]').value = 'Data Science MSc\\nEngineering Foundation';
          document.querySelector('[data-ops-school-field="programFields"]').value = 'Data Science\\nEngineering\\nArtificial Intelligence';
          document.querySelector('[data-ops-school-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('学校字段已本地保存')", "ops imported language array save");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"costs\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"costs\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-school-field=\"scholarships\"]'))", "ops imported school scholarship list field");
      const importedScholarshipListVisible = await evaluate(cdp, `
        (() => {
          const field = document.querySelector('[data-ops-school-field="scholarships"]');
          return field?.value.includes('CSC')
            && field.value.includes('School scholarship')
            && !field.value.includes(',');
        })()
      `);
      if (!importedScholarshipListVisible) throw new Error("Ops school editor did not display CSCAlite scholarships array as editable lines.");
      await evaluate(cdp, `
        (() => {
          const field = document.querySelector('[data-ops-school-field="scholarships"]');
          field.value = 'CSC\\nSchool scholarship\\nProvincial scholarship';
          document.querySelector('[data-ops-school-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('学校字段已本地保存')", "ops imported scholarships array save");
      const importedMixedListsSaved = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '批量导入大学');
          return Array.isArray(school?.languageOfInstruction)
            && Array.isArray(school?.cscaSubjects)
            && !school.cscaSubjects.includes('专业面试')
            && school.englishRequirement === 'IELTS 6.0 or university waiver.'
            && school.deadlineSummary.includes('Oct 15')
            && school.languageOfInstruction.includes('Bilingual route')
            && school.officialWebsite === 'https://www.bulk-updated.edu'
            && school.applicationSystemUrl === 'https://apply.bulk-updated.edu'
            && school.tuitionSummary.includes('硕士：RMB 30,000')
            && school.applicationFee === 'RMB 600'
            && typeof school.englishPrograms === 'string'
            && school.englishPrograms.includes('Data Science MSc')
            && Array.isArray(school?.scholarships)
            && school.scholarships.includes('Provincial scholarship')
            && Array.isArray(school?.programFields)
            && school.programFields.includes('Artificial Intelligence');
        })()
      `);
      if (!importedMixedListsSaved) throw new Error("Ops school save did not preserve CSCAlite string[] school fields.");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"contact\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"contact\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-school-field=\"contactTel\"]'))", "ops imported school contact fields");
      const importedContactFieldsVisible = await evaluate(cdp, `
        (() => {
          const tel = document.querySelector('[data-ops-school-field="contactTel"]');
          const email = document.querySelector('[data-ops-school-field="contactEmail"]');
          const address = document.querySelector('[data-ops-school-field="contactAddress"]');
          const year = document.querySelector('[data-ops-school-field="yearEstablished"]');
          const served = document.querySelector('[data-ops-school-field="studentsServed"]');
          const guardian = document.querySelector('[data-ops-school-field="under18GuardianRequired"]');
          const note = document.querySelector('[data-ops-school-field="under18RequirementNote"]');
          return tel?.value === '+86 25 0000 0000'
            && email?.value === 'admissions@bulk.example.edu'
            && address?.value.includes('国际学生办公室')
            && year?.value === '1998'
            && served?.value === '0'
            && guardian?.checked === false
            && note?.value.includes('监护安排');
        })()
      `);
      if (!importedContactFieldsVisible) throw new Error("Ops school import did not hydrate CSCAlite contact/scale fields.");
      const removedDisplayFieldsHidden = await evaluate(cdp, `
        (() => {
          return !document.querySelector('[data-ops-school-tab="display"]')
            && !document.querySelector('[data-ops-school-field="featuredPrograms"]')
            && !document.querySelector('[data-ops-school-field="programQualityIssues"]')
            && !document.querySelector('[data-ops-school-field="derivedTags"]')
            && Boolean(document.querySelector('[data-ops-school-tab="contact"]'));
        })()
      `);
      if (!removedDisplayFieldsHidden) throw new Error("Ops school editor did not keep derived display fields hidden while exposing CSCAlite contact fields.");
      for (const tab of ["admissions", "costs", "contact", "programs", "scholarships", "source", "logs", "basic"]) {
        await evaluate(cdp, `
          (() => {
            const button = document.querySelector('[data-ops-school-tab="${tab}"]');
            if (!button) throw new Error('Missing ops school editor tab ${tab}');
            button.click();
          })()
        `);
        await waitFor(
          cdp,
          `Boolean(document.querySelector('[data-ops-school-editor]')) && document.querySelector('[data-ops-school-tab="${tab}"]')?.classList.contains('active') && document.body.textContent.trim().length > 500`,
          `ops school editor ${tab} tab stays rendered`,
        );
      }
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"programs\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"programs\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"openDate\"]'))", "ops school imported program open date field");
      const importedOpenDateVisible = await evaluate(cdp, `
        (() => {
          const field = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="openDate"]');
          const status = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="status"]');
          const pillText = document.querySelector('[data-ops-subrecord][data-kind="programs"] .status-pill')?.textContent || '';
          return field?.value === 'Sep 1' && field?.type === 'text' && status?.value === 'published' && pillText.includes('已发布') && !pillText.includes('published');
        })()
      `);
      if (!importedOpenDateVisible) throw new Error("Ops school program editor hid a non-ISO date or CSCAlite published status.");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"admissions\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"admissions\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"rules\"] [data-ops-subrecord-field=\"programId\"]'))", "ops imported rule program id field");
      const importedRuleProgramIdVisible = await evaluate(cdp, `
        (() => {
          const field = document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-field="programId"]');
          const status = document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-field="status"]');
          const pillText = document.querySelector('[data-ops-subrecord][data-kind="rules"] .status-pill')?.textContent || '';
          return field?.value === 'bulk-prog-001' && field?.type === 'text' && status?.value === 'published' && pillText.includes('已发布') && !pillText.includes('published');
        })()
      `);
      if (!importedRuleProgramIdVisible) throw new Error("Ops CSCA rule editor hid string programId or CSCAlite published status.");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"scholarships\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"scholarships\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"programId\"]'))", "ops imported scholarship program id field");
      const importedScholarshipProgramIdVisible = await evaluate(cdp, `
        (() => {
          const field = document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-field="programId"]');
          const status = document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-field="status"]');
          const pillText = document.querySelector('[data-ops-subrecord][data-kind="scholarships"] .status-pill')?.textContent || '';
          return field?.value === 'bulk-prog-001' && field?.type === 'text' && status?.value === 'published' && pillText.includes('已发布') && !pillText.includes('published');
        })()
      `);
      if (!importedScholarshipProgramIdVisible) throw new Error("Ops school scholarship editor hid string programId or CSCAlite published status.");
      await evaluate(cdp, "document.querySelector('[data-ops-school-save]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('学校字段已本地保存')", "ops imported school save preserves string ids");
      const importedStringIdsSaved = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '批量导入大学');
          const rule = school?.cscaRules?.find((item) => item.id === 'bulk-rule-001');
          const scholarship = school?.scholarshipsDetailed?.find((item) => item.id === 'bulk-scholarship-001');
          return rule?.programId === 'bulk-prog-001' && scholarship?.programId === 'bulk-prog-001';
        })()
      `);
      if (!importedStringIdsSaved) throw new Error("Ops school save did not preserve string programId links.");
      await evaluate(cdp, "document.querySelector('[data-ops-school-create-toggle]').click()");
      await waitFor(
        cdp,
        "Boolean(document.querySelector('[data-ops-school-create-panel]')) && Boolean(document.querySelector('[data-ops-school-create-field=\"nameZh\"]')) && document.body.textContent.includes('至少需要中文名')",
        "ops school create form opens",
      );
      await evaluate(cdp, `
        (() => {
          const fields = {
            nameZh: '测试大学草稿',
            nameEn: 'Test University',
            cityZh: '测试市',
            region: '测试地区'
          };
          Object.entries(fields).forEach(([key, value]) => {
            const field = document.querySelector(\`[data-ops-school-create-field="\${key}"]\`);
            if (!field) throw new Error(\`Missing create field: \${key}\`);
            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
          });
        })()
      `);
      await evaluate(cdp, "document.querySelector('[data-ops-school-create]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('已新增学校草稿：测试大学草稿') && document.querySelector('[data-ops-school-filter]')?.value === 'all'",
        "ops school create toast",
      );
      await evaluate(cdp, `
        (() => {
          const nameField = document.querySelector('[data-ops-school-field="nameZh"]');
          const nameEnField = document.querySelector('[data-ops-school-field="nameEn"]');
          const cityField = document.querySelector('[data-ops-school-field="cityZh"]');
          const regionField = document.querySelector('[data-ops-school-field="region"]');
          if (!nameField || !nameEnField || !cityField || !regionField) throw new Error('Missing school create result fields');
          if (nameField.value !== '测试大学草稿' || nameEnField.value !== 'Test University' || cityField.value !== '测试市' || regionField.value !== '测试地区') {
            throw new Error('Create form values did not hydrate the editor');
          }
          nameField.value = '测试大学';
          nameEnField.dispatchEvent(new Event('input', { bubbles: true }));
          nameField.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-school-save]').click();
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('学校字段已本地保存')",
        "ops school save toast",
      );
      const schoolSaved = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          const logs = state.schoolChangeLogs?.[school?.id] || [];
          return Boolean(school
            && school.nameEn === 'Test University'
            && school.cityZh === '测试市'
            && school.region === '测试地区'
            && !Object.prototype.hasOwnProperty.call(school, 'round1Deadline')
            && !Object.prototype.hasOwnProperty.call(school, 'round2Deadline')
            && !Object.prototype.hasOwnProperty.call(school, 'englishRequirementNote')
            && !Object.prototype.hasOwnProperty.call(school, 'tuitionByCategory')
            && school.under18GuardianRequired === false
            && logs.some((log) => log.action === 'create_school' && Array.isArray(log.changes) && log.changes.some((entry) => entry.includes('创建学校草稿：测试大学草稿')))
            && logs.some((log) => log.action === 'update_school' && log.actorEmail === 'ops@cuac.demo' && Array.isArray(log.changes) && log.changes.some((entry) => entry.includes('nameZh'))));
        })()
      `);
      if (!schoolSaved) throw new Error("Ops school create/save state or SchoolChangeLog audit was not persisted.");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"logs\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-ops-school-tab=\"logs\"]')?.classList.contains('active') && document.body.textContent.includes('变更审计') && document.body.textContent.includes('update_school')",
        "ops school change log tab",
      );
      await navigate(cdp, "university-detail.html?university=test-university&motion=off");
      await waitFor(cdp, "document.querySelector('.university-detail-hero h1')?.textContent.trim() === 'Test University' && document.body.textContent.includes('测试大学')", "ops saved school opens in public university detail");
      const savedSchoolVisible = await evaluate(cdp, `
        (() => {
          const text = document.body.textContent || '';
          const root = document.querySelector('[data-detail-root]');
          const checks = {
            sourceModel: root?.dataset.detailSourceModel === 'School',
            title: document.querySelector('.university-detail-hero h1')?.textContent.trim() === 'Test University',
            chineseName: text.includes('测试大学'),
            studentFacing: !/School\\.[A-Za-z_][A-Za-z0-9_]*/.test(text),
          };
          return { ok: Object.values(checks).every(Boolean), checks, text: text.slice(0, 3200) };
        })()
      `);
      if (!savedSchoolVisible?.ok) throw new Error(`Public university detail did not render the saved CSCAlite School/AdminSchool preview: ${JSON.stringify(savedSchoolVisible?.checks || {})}`);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"school\"]').hidden && Boolean(document.querySelector('[data-ops-school-editor]'))", "ops school tab returns after public preview");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"costs\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"costs\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-school-field=\"tuitionSummary\"]'))", "ops school costs tab");
      await evaluate(cdp, `
        (() => {
          const tuitionField = document.querySelector('[data-ops-school-field="tuitionSummary"]');
          const feeField = document.querySelector('[data-ops-school-field="applicationFee"]');
          const officialField = document.querySelector('[data-ops-school-field="officialWebsiteUrl"]');
          const admissionsField = document.querySelector('[data-ops-school-field="admissionsWebsiteUrl"]');
          if (!tuitionField || !feeField || !officialField || !admissionsField) throw new Error('Missing CSCAlite AdminSchool cost/link fields');
          tuitionField.value = '本科：RMB 20,000/年；硕士：RMB 30,000/年';
          feeField.value = 'RMB 600';
          officialField.value = 'https://test.example.edu';
          admissionsField.value = 'https://apply.test.example.edu';
          tuitionField.dispatchEvent(new Event('input', { bubbles: true }));
          feeField.dispatchEvent(new Event('input', { bubbles: true }));
          officialField.dispatchEvent(new Event('input', { bubbles: true }));
          admissionsField.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-school-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('学校字段已本地保存')", "ops school costs save toast");
      const cscaliteFieldsSaved = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          return school?.tuitionSummary?.includes('本科：RMB 20,000')
            && school?.applicationFee === 'RMB 600'
            && school?.officialWebsite === 'https://test.example.edu'
            && school?.applicationSystemUrl === 'https://apply.test.example.edu';
        })()
      `);
      if (!cscaliteFieldsSaved) throw new Error("Ops school editor did not persist CSCAlite-aligned AdminSchool cost/link fields.");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"contact\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"contact\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-school-field=\"contactTel\"]')) && Boolean(document.querySelector('[data-ops-school-field=\"under18GuardianRequired\"]'))", "ops school contact and scale tab");
      await evaluate(cdp, `
        (() => {
          const tel = document.querySelector('[data-ops-school-field="contactTel"]');
          const email = document.querySelector('[data-ops-school-field="contactEmail"]');
          const address = document.querySelector('[data-ops-school-field="contactAddress"]');
          const year = document.querySelector('[data-ops-school-field="yearEstablished"]');
          const count = document.querySelector('[data-ops-school-field="studentCount"]');
          const served = document.querySelector('[data-ops-school-field="studentsServed"]');
          const guardian = document.querySelector('[data-ops-school-field="under18GuardianRequired"]');
          const note = document.querySelector('[data-ops-school-field="under18RequirementNote"]');
          if (!tel || !email || !address || !year || !count || !served || !guardian || !note) throw new Error('Missing CSCAlite school contact/scale fields');
          tel.value = '+86 10 0000 0000';
          email.value = 'admissions@test.example.edu';
          address.value = '测试市国际学生办公室';
          year.value = '1999';
          count.value = '约 20,000 名学生';
          served.value = '3';
          guardian.checked = true;
          note.value = '未满 18 岁申请人需由学校确认监护安排。';
          [tel, email, address, year, count, served, guardian, note].forEach((field) => field.dispatchEvent(new Event('input', { bubbles: true })));
          guardian.dispatchEvent(new Event('change', { bubbles: true }));
          document.querySelector('[data-ops-school-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('学校字段已本地保存')", "ops school contact save toast");
      const contactFieldsSaved = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          return school?.contactTel === '+86 10 0000 0000'
            && school?.contactEmail === 'admissions@test.example.edu'
            && school?.contactAddress === '测试市国际学生办公室'
            && school?.yearEstablished === 1999
            && school?.studentCount === '约 20,000 名学生'
            && school?.studentsServed === 3
            && school?.under18GuardianRequired === true
            && school?.under18RequirementNote?.includes('监护安排');
        })()
      `);
      if (!contactFieldsSaved) throw new Error("Ops school editor did not persist CSCAlite contact/scale fields.");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"programs\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"programs\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-school-add-program]'))", "ops school programs tab");
      await evaluate(cdp, "document.querySelector('[data-ops-school-add-program]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已新增项目草稿') && document.body.textContent.includes('资助备注') && Boolean(document.querySelector('[data-ops-school-program-readonly]')) && document.body.textContent.includes('本区只编辑项目的可维护字段') && Boolean(document.querySelector('[data-source-field=\"SchoolProgram.schoolId\"]')) && Boolean(document.querySelector('[data-source-field=\"SchoolProgram.displaySubjects\"]')) && !document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"schoolId\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"isVerified\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"hasScholarship\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"badgeText\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"displayTuition\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"displaySubjects\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"displayGroup\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"displayGroupLabel\"]') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"applicationNote\"]')) && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"scholarshipText\"]')) && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"programs\"] [data-ops-subrecord-field=\"deadlineDate\"]'))", "ops school add editable program draft");
      await evaluate(cdp, `
        (() => {
          const name = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="nameZh"]');
          const fieldCategory = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="fieldCategory"]');
          const csca = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="cscaSubjects"]');
          const tuitionAmount = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="tuitionAmount"]');
          const tuitionText = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="tuitionText"]');
          const note = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="applicationNote"]');
          const scholarshipText = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="scholarshipText"]');
          const applicationUrl = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="applicationUrl"]');
          const sourceUrl = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="sourceUrl"]');
          const sourceLabel = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="sourceLabel"]');
          const status = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="status"]');
          const forbiddenEditable = ['schoolId', 'isVerified', 'hasScholarship', 'badgeText', 'displayTuition', 'displaySubjects', 'displayGroup', 'displayGroupLabel']
            .filter((key) => document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="' + key + '"]'));
          if (!name || !fieldCategory || !csca || !tuitionAmount || !tuitionText || !note || !scholarshipText || !applicationUrl || !sourceUrl || !sourceLabel || !status) throw new Error('Missing editable AdminSchoolProgramInput fields');
          if (forbiddenEditable.length) throw new Error('Record/display SchoolProgram fields should be readonly: ' + forbiddenEditable.join(','));
          if (status.value !== 'draft') throw new Error('SchoolProgram draft status is not aligned to CSCAlite draft');
          name.value = '测试计算机硕士';
          fieldCategory.value = 'Computer Science';
          csca.value = '数学、物理';
          tuitionAmount.value = '42000';
          tuitionText.value = 'RMB 42,000 / year';
          note.value = '学校联系学生后收取材料。';
          scholarshipText.value = 'CSC possible; school award needs separate check.';
          applicationUrl.value = 'https://example.edu/apply/test-computer-msc';
          sourceUrl.value = 'https://example.edu/notices/test-computer-msc';
          sourceLabel.value = 'Official test program notice';
          document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已保存项目')", "ops school program subrecord save toast");
      await evaluate(cdp, `
        (() => {
          const name = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="nameZh"]');
          if (!name) throw new Error('Missing SchoolProgram.nameZh for dirty archive guard');
          name.value = '未保存项目归档保护';
          name.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-archive]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-ops-school-unsaved-warning]')?.hidden === false && document.querySelector('[data-completion-toast]')?.textContent.includes('先保存此条再归档')", "ops school program dirty archive guard");
      const dirtyProgramArchiveBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          const program = school?.programs?.find((item) => item.nameZh === '测试计算机硕士');
          return Boolean(document.querySelector('[data-ops-school-editor]')?.dataset.dirty === 'true'
            && program
            && program.status !== 'archived'
            && !school.programs.some((item) => item.nameZh === '未保存项目归档保护'));
        })()
      `);
      if (!dirtyProgramArchiveBlocked) throw new Error("Ops SchoolProgram archive should be blocked while subrecord fields are unsaved.");
      await evaluate(cdp, `
        (() => {
          const name = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="nameZh"]');
          if (!name) throw new Error('Missing SchoolProgram.nameZh for dirty archive recovery');
          name.value = '测试计算机硕士';
          name.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已保存项目')", "ops school program dirty archive save recovery");
      const programVersionIncremented = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          const program = school?.programs?.find((item) => item.nameZh === '测试计算机硕士');
          return Number(program?.version || 0) > 1;
        })()
      `);
      if (!programVersionIncremented) throw new Error("Ops SchoolProgram save did not increment version for CSCAlite expectedVersion alignment.");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          const program = school?.programs?.find((item) => item.nameZh === '测试计算机硕士');
          if (!school || !program) throw new Error('Missing saved SchoolProgram for stale save check');
          state.schoolRecords = state.schoolRecords.map((item) => (
            item.id === school.id ? {
              ...item,
              programs: item.programs.map((row) => row.id === program.id ? { ...row, version: Number(row.version || 1) + 1, lastVerifiedAt: '2026-08-20' } : row)
            } : item
          ));
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
          const lastVerified = document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-field="lastVerifiedAt"]');
          if (!lastVerified) throw new Error('Missing SchoolProgram.lastVerifiedAt for stale save check');
          lastVerified.value = '2026-08-01';
          lastVerified.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-subrecord][data-kind="programs"] [data-ops-subrecord-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('项目已被其他管理员更新，请刷新后再继续')", "ops school program stale save conflict toast");
      const programStaleSaveBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          const program = school?.programs?.find((item) => item.nameZh === '测试计算机硕士');
          return Boolean(program?.lastVerifiedAt === '2026-08-20'
            && document.querySelector('[data-ops-school-editor]')?.dataset.dirty === 'true');
        })()
      `);
      if (!programStaleSaveBlocked) throw new Error("Ops SchoolProgram stale save overwrote a newer CSCAlite-shaped subrecord.");
      const savedProgramId = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          const program = school?.programs?.find((item) => item.nameZh === '测试计算机硕士');
          return program?.id || '';
        })()
      `);
      if (!savedProgramId) throw new Error("Ops school program save did not persist a program id for public preview.");
      await navigate(cdp, `program-detail.html?program=${encodeURIComponent(savedProgramId)}&motion=off`);
      await waitFor(cdp, "document.querySelector('.program-detail-hero h1')?.textContent.trim() === '测试计算机硕士'", "ops saved program opens in public detail");
      const savedProgramPublicPreview = await evaluate(cdp, `
        (() => {
          const text = document.body.textContent || '';
          const root = document.querySelector('[data-detail-root]');
          const checks = {
            sourceModel: root?.dataset.detailSourceModel === 'SchoolProgram',
            schoolName: text.includes('测试大学'),
            tuition: text.includes('RMB 42,000 / year'),
            field: text.includes('Computer Science'),
            applicationNote: text.includes('学校联系学生后收取材料。'),
            currentDetails: text.includes('Where to check current details'),
            applicationLink: Boolean(document.querySelector('.program-official-list a[href="https://example.edu/apply/test-computer-msc"]')),
            sourceLink: Boolean(document.querySelector('.program-official-list a[href="https://example.edu/notices/test-computer-msc"]')) && text.includes('Official test program notice'),
            noRawFields: !/SchoolProgram\\.[A-Za-z_][A-Za-z0-9_]*/.test(text),
          };
          return {
            ok: Object.values(checks).every(Boolean),
            failed: Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name),
            sourceModel: root?.dataset.detailSourceModel || "",
            text: text.slice(0, 2000),
          };
        })()
      `);
      if (!savedProgramPublicPreview?.ok) throw new Error(`Ops saved SchoolProgram did not render as a student-facing public program detail: ${JSON.stringify(savedProgramPublicPreview)}`);
      await signInStudent(cdp);
      await navigate(cdp, "application.html#add-choice");
      await waitFor(cdp, "document.querySelector('[data-choice-modal]')?.classList.contains('open')", "choice modal for ops saved program");
      await waitFor(cdp, "[...document.querySelector('[data-university-select]')?.options || []].some((option) => ['测试大学', 'Test University'].includes(option.textContent.trim()))", "ops saved school appears in add-choice school list");
      const savedProgramSelectable = await evaluate(cdp, `
        (() => {
          const degree = document.querySelector('[data-degree-select]');
          degree.value = 'Master';
          degree.dispatchEvent(new Event('change', { bubbles: true }));
          const university = document.querySelector('[data-university-select]');
          const universityOption = [...university.options].find((item) => ['测试大学', 'Test University'].includes(item.textContent.trim()));
          university.value = universityOption?.value || '';
          university.dispatchEvent(new Event('change', { bubbles: true }));
          const program = document.querySelector('[data-program-select]');
          const option = [...program.options].find((item) => item.textContent.trim() === '测试计算机硕士');
          if (!option) return { ok: false, failed: ['programOption'], universityOptions: [...university.options].map((item) => item.textContent.trim()), programOptions: [...program.options].map((item) => item.textContent.trim()) };
          program.value = option.value;
          program.dispatchEvent(new Event('change', { bubbles: true }));
          const sourceMap = document.querySelector('[data-choice-source-map]')?.textContent || '';
          const checks = {
            programName: sourceMap.includes('测试计算机硕士'),
            schoolName: sourceMap.includes('测试大学') || sourceMap.includes('Test University'),
            tuition: sourceMap.includes('RMB 42,000 / year'),
            receiveCopy: sourceMap.includes('What this school will receive'),
            notSharedCopy: sourceMap.includes('Not shared by CUAC'),
          };
          return {
            ok: Object.values(checks).every(Boolean),
            failed: Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name),
            universityValue: university.value,
            programValue: program.value,
            sourceMap,
            programOptions: [...program.options].map((item) => item.textContent.trim()),
          };
        })()
      `);
      if (!savedProgramSelectable?.ok) throw new Error(`Ops saved SchoolProgram was not selectable from Add choice with source-map context: ${JSON.stringify(savedProgramSelectable)}`);
      await signInCuacOps(cdp);
      await navigate(cdp, "ops-admin.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-tab=\"school\"]'))", "ops school tab after student add-choice preview");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"school\"]').hidden && document.querySelector('[data-ops-school-tab=\"programs\"]')?.classList.contains('active')", "ops school programs tab returns after program public preview");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"admissions\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"admissions\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-school-add-rule]'))", "ops school admissions tab after program");
      await evaluate(cdp, "document.querySelector('[data-ops-school-add-rule]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已新增 CSCA 规则草稿') && Boolean(document.querySelector('[data-ops-school-csca-readonly]')) && document.body.textContent.includes('本区只编辑 CSCA 规则的可维护字段') && Boolean(document.querySelector('[data-source-field=\"SchoolCscaRule.schoolId\"]')) && !document.querySelector('[data-ops-subrecord][data-kind=\"rules\"] [data-ops-subrecord-field=\"schoolId\"]') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"rules\"] [data-ops-subrecord-field=\"importantNote\"]')) && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"rules\"] [data-ops-subrecord-field=\"cscaSubjects\"]')) && !document.querySelector('[data-ops-subrecord][data-kind=\"rules\"] [data-ops-subrecord-field=\"applicablePrograms\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"rules\"] [data-ops-subrecord-field=\"isVerified\"]') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"rules\"] [data-ops-subrecord-field=\"sortOrder\"]')) && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"rules\"] [data-ops-subrecord-field=\"version\"]'))", "ops school add editable csca rule draft");
      await evaluate(cdp, `
        (() => {
          const title = document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-field="title"]');
          const subjects = document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-field="cscaSubjects"]');
          const importantNote = document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-field="importantNote"]');
          const sortOrder = document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-field="sortOrder"]');
          const version = document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-field="version"]');
          const status = document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-field="status"]');
          const forbiddenEditable = ['schoolId', 'applicablePrograms', 'isVerified']
            .filter((key) => document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-field="' + key + '"]'));
          if (!title || !subjects || !importantNote || !sortOrder || !version || !status) throw new Error('Missing editable AdminSchoolCscaRuleInput fields');
          if (forbiddenEditable.length) throw new Error('SchoolCscaRule read-only fields are still editable: ' + forbiddenEditable.join(','));
          if (status.value !== 'draft') throw new Error('SchoolCscaRule draft status is not aligned to CSCAlite draft');
          title.value = '测试理工科规则';
          subjects.value = '数学、物理';
          importantNote.value = '按学院最新通知复核。';
          sortOrder.value = '3';
          version.value = '2';
          document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已保存CSCA 规则')", "ops school rule subrecord save toast");
      const ruleVersionIncremented = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          const rule = school?.cscaRules?.find((item) => item.title === '测试理工科规则');
          return Number(rule?.version || 0) > 1;
        })()
      `);
      if (!ruleVersionIncremented) throw new Error("Ops SchoolCscaRule save did not increment version for CSCAlite expectedVersion alignment.");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          const rule = school?.cscaRules?.find((item) => item.title === '测试理工科规则');
          if (!school || !rule) throw new Error('Missing saved SchoolCscaRule for stale save check');
          state.schoolRecords = state.schoolRecords.map((item) => (
            item.id === school.id ? {
              ...item,
              cscaRules: item.cscaRules.map((row) => row.id === rule.id ? { ...row, version: Number(row.version || 1) + 1, importantNote: '其他管理员已复核规则。' } : row)
            } : item
          ));
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
          const note = document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-field="importantNote"]');
          if (!note) throw new Error('Missing SchoolCscaRule.importantNote for stale save check');
          note.value = '过期规则保存。';
          note.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-subrecord][data-kind="rules"] [data-ops-subrecord-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('CSCA 规则已被其他管理员更新，请刷新后再继续')", "ops school csca rule stale save conflict toast");
      const ruleStaleSaveBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          const rule = school?.cscaRules?.find((item) => item.title === '测试理工科规则');
          return Boolean(rule?.importantNote === '其他管理员已复核规则。'
            && document.querySelector('[data-ops-school-editor]')?.dataset.dirty === 'true');
        })()
      `);
      if (!ruleStaleSaveBlocked) throw new Error("Ops SchoolCscaRule stale save overwrote a newer CSCAlite-shaped subrecord.");
      await navigate(cdp, "ops-admin.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-tab=\"school\"]'))", "ops school tab after csca stale save refresh");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"school\"]').hidden && Boolean(document.querySelector('[data-ops-school-editor]'))", "ops school editor after csca stale save refresh");
      const subrecordsAligned = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.nameZh === '测试大学');
          const program = school?.programs?.[0];
          const rule = school?.cscaRules?.[0];
          const ok = program?.nameZh === '测试计算机硕士'
            && String(program?.schoolId) === String(school?.id)
            && Array.isArray(program?.cscaSubjects)
            && program.cscaSubjects.includes('数学')
            && program?.applicationNote?.includes('学校联系学生')
            && program?.status === 'draft'
            && program?.scholarshipText === 'CSC possible; school award needs separate check.'
            && program?.isVerified === false
            && program?.hasScholarship === false
            && Object.prototype.hasOwnProperty.call(program, 'displaySubjects')
            && rule?.title === '测试理工科规则'
            && Object.prototype.hasOwnProperty.call(program, 'applicationNote')
            && Object.prototype.hasOwnProperty.call(program, 'sourceLabel')
            && Array.isArray(rule?.cscaSubjects)
            && String(rule?.schoolId) === String(school?.id)
            && rule?.status === 'draft'
            && rule.cscaSubjects.includes('物理')
            && rule?.sortOrder === 3
            && Number(rule?.version || 0) > 2
            && rule?.importantNote === '其他管理员已复核规则。'
            && Object.prototype.hasOwnProperty.call(rule, 'importantNote')
            && Object.prototype.hasOwnProperty.call(rule, 'sourceUrl');
          return { ok: Boolean(ok), schoolId: school?.id, programs: school?.programs || [], rules: school?.cscaRules || [] };
        })()
      `);
      if (!subrecordsAligned?.ok) throw new Error(`Ops school subrecord drafts did not include CSCAlite-aligned fields: ${JSON.stringify(subrecordsAligned)}`);
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const selected = state.schoolRecords?.find((school) => school.nameZh === '测试大学');
          if (!selected) throw new Error('Missing saved test school');
          state.selectedSchoolId = selected.id;
          state.schoolRecords = state.schoolRecords.map((school) => (
            school.id === selected.id ? { ...school, scholarshipsDetailed: 'legacy-preview-value' } : school
          ));
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
        })()
      `);
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"scholarships\"]').click()");
      await waitFor(
        cdp,
        "Boolean(document.querySelector('[data-ops-school-editor]')) && document.querySelector('[data-ops-school-tab=\"scholarships\"]')?.classList.contains('active') && document.body.textContent.includes('还没有结构化学校奖学金')",
        "ops school scholarship tab tolerates legacy state",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-school-add-scholarship]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('已新增学校奖学金草稿') && document.body.textContent.includes('资助与要求') && document.body.textContent.includes('来源记录') && Boolean(document.querySelector('[data-ops-school-scholarship-readonly]')) && document.body.textContent.includes('本区只编辑学校奖学金的可维护字段') && Boolean(document.querySelector('[data-source-field=\"SchoolScholarship.deadlineDate\"]')) && Boolean(document.querySelector('[data-source-field=\"SchoolScholarship.scholarshipSlug\"]')) && !document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"schoolId\"]') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"status\"]')) && document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"status\"]')?.value === 'draft' && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"requirementText\"]')) && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"amountText\"]')) && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"programId\"]')) && !document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"deadlineDate\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"deadlineLabel\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"applicationRound\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"scholarshipSlug\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"isCsc\"]') && !document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"isVerified\"]') && !document.querySelector('.ops-error-state')",
        "ops school add scholarship keeps page rendered",
      );
      await evaluate(cdp, `
        (() => {
          const name = document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-field="name"]');
          const amount = document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-field="amountText"]');
          const requirement = document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-field="requirementText"]');
          const applicableDegree = document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-field="applicableDegree"]');
          const applicableProgram = document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-field="applicableProgram"]');
          const status = document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-field="status"]');
          const forbiddenEditable = ['schoolId', 'deadlineDate', 'deadlineLabel', 'applicationRound', 'scholarshipSlug', 'isCsc', 'isVerified']
            .filter((key) => document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-field="' + key + '"]'));
          if (!name || !amount || !requirement || !applicableDegree || !applicableProgram || !status) throw new Error('Missing editable AdminSchoolScholarshipInput fields');
          if (forbiddenEditable.length) throw new Error('SchoolScholarship read-only fields are still editable: ' + forbiddenEditable.join(','));
          if (status.value !== 'draft') throw new Error('SchoolScholarship draft status is not aligned to CSCAlite draft');
          name.value = '测试校级奖学金';
          applicableDegree.value = 'Master';
          applicableProgram.value = 'Computer Science MSc';
          amount.value = '部分学费减免';
          requirement.value = '学校联系学生后确认材料。';
          document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已保存学校奖学金')", "ops school scholarship subrecord save toast");
      const scholarshipVersionIncremented = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const selected = state.schoolRecords?.find((school) => school.nameZh === '测试大学');
          const scholarship = selected?.scholarshipsDetailed?.find((item) => item.name === '测试校级奖学金');
          return Number(scholarship?.version || 0) > 1
            && scholarship?.amountText === '部分学费减免'
            && scholarship?.requirementText === '学校联系学生后确认材料。'
            && scholarship?.applicableDegree === 'Master'
            && scholarship?.applicableProgram === 'Computer Science MSc'
            && scholarship?.schoolId;
        })()
      `);
      if (!scholarshipVersionIncremented) throw new Error("Ops SchoolScholarship save did not persist CSCAlite AdminSchoolScholarshipInput fields while preserving school route context.");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const selected = state.schoolRecords?.find((school) => school.nameZh === '测试大学');
          const scholarship = selected?.scholarshipsDetailed?.find((item) => item.name === '测试校级奖学金');
          if (!selected || !scholarship) throw new Error('Missing saved SchoolScholarship for stale save check');
          state.schoolRecords = state.schoolRecords.map((school) => (
            school.id === selected.id ? {
              ...school,
              scholarshipsDetailed: school.scholarshipsDetailed.map((row) => row.id === scholarship.id ? { ...row, version: Number(row.version || 1) + 1, requirementText: '其他管理员已更新奖学金要求。' } : row)
            } : school
          ));
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
          const requirement = document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-field="requirementText"]');
          if (!requirement) throw new Error('Missing SchoolScholarship.requirementText for stale save check');
          requirement.value = '过期奖学金保存。';
          requirement.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-subrecord][data-kind="scholarships"] [data-ops-subrecord-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('学校奖学金已被其他管理员更新，请刷新后再继续')", "ops school scholarship stale save conflict toast");
      const scholarshipStaleSaveBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const selected = state.schoolRecords?.find((school) => school.nameZh === '测试大学');
          const scholarship = selected?.scholarshipsDetailed?.find((item) => item.name === '测试校级奖学金');
          return Boolean(scholarship?.requirementText === '其他管理员已更新奖学金要求。'
            && document.querySelector('[data-ops-school-editor]')?.dataset.dirty === 'true');
        })()
      `);
      if (!scholarshipStaleSaveBlocked) throw new Error("Ops SchoolScholarship stale save overwrote a newer CSCAlite-shaped subrecord.");
      await navigate(cdp, "ops-admin.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-tab=\"school\"]'))", "ops school tab after scholarship stale save refresh");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"school\"]').hidden && Boolean(document.querySelector('[data-ops-school-editor]'))", "ops school editor after scholarship stale save refresh");
      await evaluate(cdp, "document.querySelector('[data-ops-school-tab=\"scholarships\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"scholarships\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"]'))", "ops school scholarship tab after stale save refresh");
      const scholarshipAdded = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const selected = state.schoolRecords?.find((school) => school.nameZh === '测试大学');
          const scholarship = selected?.scholarshipsDetailed?.[0];
          return Array.isArray(selected?.scholarshipsDetailed)
            && selected.scholarshipsDetailed.length === 1
            && scholarship?.name === '测试校级奖学金'
            && String(scholarship?.schoolId) === String(selected?.id)
            && scholarship?.status === 'draft'
            && scholarship?.applicableDegree === 'Master'
            && scholarship?.applicableProgram === 'Computer Science MSc'
            && scholarship?.amountText === '部分学费减免'
            && scholarship?.requirementText === '其他管理员已更新奖学金要求。';
        })()
      `);
      if (!scholarshipAdded) throw new Error("Ops school add scholarship did not normalize and persist scholarship records.");
      await evaluate(cdp, "document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-archive]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已归档学校奖学金') && document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-archive]')?.disabled", "ops school scholarship subrecord archive toast");
      const scholarshipArchived = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const selected = state.schoolRecords?.find((school) => school.nameZh === '测试大学');
          const scholarship = selected?.scholarshipsDetailed?.[0];
          return scholarship?.name === '测试校级奖学金'
            && scholarship?.status === 'archived'
            && scholarship?.requirementText === '其他管理员已更新奖学金要求。';
        })()
      `);
      if (!scholarshipArchived) throw new Error("Ops school scholarship subrecord archive did not persist archived status.");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"students\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"students\"]').hidden", "ops students section");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-student-detail]'))", "ops student detail");
      await evaluate(cdp, "document.querySelector('[data-ops-student-select][data-student-id=\"ahmed-khan\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-ops-student-detail]')?.dataset.studentId === 'ahmed-khan' && document.body.textContent.includes('账号治理') && !document.body.textContent.includes('账号治理 · 对齐 AdminUser') && document.body.textContent.includes('学生与申请编辑') && Boolean(document.querySelector('[data-ops-student-field=\"country\"]')) && Boolean(document.querySelector('[data-ops-student-save]')) && document.body.textContent.includes('邮箱未验证') && document.body.textContent.includes('Agent 免费可用')",
        "ops student selected",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-student-open-tab=\"handoff\"][data-student-id=\"ahmed-khan\"]')?.click()");
      await waitFor(
        cdp,
        "!document.querySelector('[data-ops-student-detail-panel=\"handoff\"]')?.hidden && document.querySelector('[data-ops-student-detail]')?.dataset.studentId === 'ahmed-khan'",
        "ops student handoff direct entry",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-student-open-tab=\"account\"][data-student-id=\"ahmed-khan\"]')?.click()");
      await waitFor(
        cdp,
        "!document.querySelector('[data-ops-student-detail-panel=\"account\"]')?.hidden && document.querySelector('[data-ops-student-detail]')?.dataset.studentId === 'ahmed-khan'",
        "ops student account direct entry",
      );
      await evaluate(cdp, `
        (() => {
          document.querySelector('[data-ops-student-field="country"]').value = 'Pakistan / Islamabad';
          document.querySelector('[data-ops-student-field="stage"]').value = 'Master applicant';
          document.querySelector('[data-ops-student-field="status"]').value = '资料不完整';
          document.querySelector('[data-ops-student-field="payment"]').value = 'Payment review required';
          document.querySelector('[data-ops-student-field="agentAccessStatus"]').value = '需复核';
          document.querySelector('[data-ops-student-save]').click();
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('学生申请资料已保存') && document.body.textContent.includes('Pakistan / Islamabad') && document.body.textContent.includes('Master applicant') && document.body.textContent.includes('Payment review required') && document.body.textContent.includes('Agent 需复核')",
        "ops student editable fields save",
      );
      const studentEdited = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const student = state.studentRecords?.find((item) => item.id === 'ahmed-khan');
          return Boolean(student
            && student.country === 'Pakistan / Islamabad'
            && student.stage === 'Master applicant'
            && student.status === '资料不完整'
            && student.payment === 'Payment review required'
            && student.agentAccessStatus === '需复核'
            && student.timeline?.some((item) => item.includes('保存学生申请资料'))
            && state.auditItems?.some((item) => item.includes('已保存学生申请资料')));
        })()
      `);
      if (!studentEdited) throw new Error("Ops student editable fields did not persist.");
      await evaluate(cdp, "document.querySelector('[data-ops-student-action=\"disable-account\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已停用学生账号') && document.body.textContent.includes('账号停用')", "ops student account disabled");
      await evaluate(cdp, "document.querySelector('[data-ops-student-action=\"restore-account\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已恢复学生账号') && document.body.textContent.includes('账号启用')", "ops student account restored");
      await evaluate(cdp, "document.querySelector('[data-ops-student-action=\"refresh-agent\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已恢复学生 Agent 服务') && document.body.textContent.includes('Agent 免费可用')", "ops student agent service restored");
      const studentAccountUpdated = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const student = state.studentRecords?.find((item) => item.id === 'ahmed-khan');
          return Boolean(student
            && student.accountStatus === 'active'
            && student.agentAccessStatus === '免费可用'
            && student.agentMemoryState === '登录后长期保留'
            && student.timeline?.some((item) => item.includes('恢复免费 Agent 申请辅助服务'))
            && state.auditItems?.some((item) => item.includes('已恢复学生 Agent 服务')));
        })()
      `);
      if (!studentAccountUpdated) throw new Error("Ops student account governance actions did not persist.");
      await evaluate(cdp, "document.querySelector('[data-ops-student-action=\"contacted\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('已标记学生跟进完成')",
        "ops student contacted toast",
      );
      const studentUpdated = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          return Boolean(state.studentRecords?.find((student) => student.id === 'ahmed-khan')?.status === '学校已联系');
        })()
      `);
      if (!studentUpdated) throw new Error("Ops student status action was not persisted.");
      await evaluate(cdp, "document.querySelector('[data-ops-student-export]').click()");
      await waitFor(
        cdp,
        "Boolean(document.querySelector('[data-ops-student-export-panel]')) && Boolean(document.querySelector('[data-ops-student-export-csv]')) && document.body.textContent.includes('学生申请 CSV 汇总')",
        "ops student CSV export panel",
      );
      const studentExported = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const csv = document.querySelector('[data-ops-student-export-csv]')?.value || '';
          const ok = Boolean(state.studentExportCsv
            && state.studentExportCount === 3
            && csv.includes('学生ID,姓名,邮箱,角色,账号状态,邮箱验证,Agent服务,Agent记忆,最后登录,电话,国家地区,申请阶段,资金意向,语言状态,申请状态,支付说明,支付状态')
            && csv.includes('ahmed-khan')
            && csv.includes('账号启用')
            && csv.includes('学生')
            && csv.includes('免费可用')
            && csv.includes('Pakistan / Islamabad')
            && csv.includes('Master applicant')
            && csv.includes('Payment review required')
            && csv.includes('学校已联系')
            && csv.includes('南京大学 / Economics BA')
            && state.lastAction === '已生成学生申请 CSV 汇总'
            && Array.isArray(state.auditItems)
            && state.auditItems.some((item) => item.includes('已生成学生申请 CSV 汇总：3 条')));
          return {
            ok,
            count: state.studentExportCount,
            lastAction: state.lastAction,
            student: state.studentRecords?.find((item) => item.id === 'ahmed-khan') || null,
            csv,
            auditItems: state.auditItems || []
          };
        })()
      `);
      if (!studentExported.ok) throw new Error(`Ops student CSV export did not persist current student application summary: ${JSON.stringify(studentExported)}`);
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"access\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"access\"]').hidden && document.querySelector('[data-ops-access-view=\"accounts\"]')?.classList.contains('active') && document.body.textContent.includes('账号权限管理')", "ops access section");
      await evaluate(cdp, "document.querySelector('[data-ops-access-view=\"boundary\"]')?.click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-access-view-panel=\"boundary\"]')?.hidden", "ops access tabs open boundary");
      await evaluate(cdp, "document.querySelector('[data-ops-access-view=\"agent\"]')?.click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-access-view-panel=\"agent\"]')?.hidden", "ops access tabs open agent");
      await evaluate(cdp, "document.querySelector('[data-ops-access-view=\"invites\"]')?.click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-access-view-panel=\"invites\"]')?.hidden", "ops access tabs open invites");
      await evaluate(cdp, "document.querySelector('[data-ops-access-view=\"accounts\"]')?.click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-access-view-panel=\"accounts\"]')?.hidden", "ops access tabs return accounts");
      await evaluate(cdp, `
        (() => {
          document.querySelector('[data-ops-access-role-filter]').value = 'school_staff';
          document.querySelector('[data-ops-access-grant-filter]').value = 'pending-review';
          document.querySelector('[data-ops-access-apply-filter]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('账号权限筛选已应用')", "ops access filters applied");
      const accessFiltered = await evaluate(cdp, `
        (() => {
          const panel = document.querySelector('[data-ops-access-view-panel="accounts"]:not([hidden])');
          const cards = [...panel.querySelectorAll('[data-ops-access-card]')];
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          return cards.length === 1
            && cards[0].dataset.accessId === 'user-nju-pending'
            && state.accessRoleFilter === 'school_staff'
            && state.accessGrantFilter === 'pending-review'
            && document.body.textContent.includes('没有匹配的账号权限记录') === false;
        })()
      `);
      if (!accessFiltered) throw new Error("Ops access filters did not narrow unified account permissions like CSCAlite user management.");
      await evaluate(cdp, `
        (() => {
          document.querySelector('[data-ops-access-role-filter]').value = 'all';
          document.querySelector('[data-ops-access-grant-filter]').value = 'all';
          document.querySelector('[data-ops-access-status-filter]').value = 'all';
          document.querySelector('[data-ops-access-search]').value = '';
          document.querySelector('[data-ops-access-apply-filter]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-ops-access-view-panel=\"accounts\"]:not([hidden])').querySelectorAll('[data-ops-access-card]').length >= 4", "ops access filters cleared");
      await evaluate(cdp, "document.querySelector('[data-ops-access-view=\"invites\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-access-view-panel=\"invites\"]')?.hidden && document.body.textContent.includes('school_staff_invites')", "ops access invites view");
      await evaluate(cdp, `
        (() => {
          const email = document.querySelector('[data-ops-access-invite-email]');
          const school = document.querySelector('[data-ops-access-invite-school]');
          const code = document.querySelector('[data-ops-access-invite-code]');
          const role = document.querySelector('[data-ops-access-invite-role]');
          if (!email || !school || !code || !role) throw new Error('Missing access invite fields');
          email.value = 'missing.scope@example.edu';
          school.value = '';
          code.value = '';
          role.value = 'school_staff';
          document.querySelector('[data-ops-access-create-invite]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-ops-access-invite-feedback]')?.textContent.includes('学校老师邀请必须选择学校租户') && document.querySelector('[data-completion-toast]')?.textContent.includes('学校老师邀请必须选择学校租户')", "ops access invite missing school blocked");
      const invalidInviteBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          return Boolean(state.accessInviteEmail === 'missing.scope@example.edu'
            && state.accessInviteRole === 'school_staff'
            && state.accessInviteFeedbackTone === 'danger'
            && !state.accessRecords?.some((item) => item.email === 'missing.scope@example.edu'));
        })()
      `);
      if (!invalidInviteBlocked) throw new Error("Ops access invite validation did not preserve form state or incorrectly created a scoped account record.");
      await evaluate(cdp, `
        (() => {
          const email = document.querySelector('[data-ops-access-invite-email]');
          const school = document.querySelector('[data-ops-access-invite-school]');
          const code = document.querySelector('[data-ops-access-invite-code]');
          if (!email || !school || !code) throw new Error('Missing access invite fields');
          email.value = 'new.iso@example.edu';
          school.value = 'Fudan University';
          code.value = 'FDU-2026-ISO';
          document.querySelector('[data-ops-access-create-invite]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('邀请草稿已生成') && document.body.textContent.includes('new.iso@example.edu')", "ops access invite created");
      await evaluate(cdp, "document.querySelector('[data-ops-access-view=\"agent\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-access-view-panel=\"agent\"]')?.hidden && document.body.textContent.includes('申请辅助免费开放')", "ops access agent view");
      await evaluate(cdp, "document.querySelector('[data-ops-access-open-grant][data-access-id=\"user-zju-staff\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-access-grant-panel]')?.dataset.accessId === 'user-zju-staff' && document.body.textContent.includes('Agent 服务权限') && document.body.textContent.includes('Agent 申请辅助免费提供')", "ops access agent service panel opened");
      await evaluate(cdp, `
        (() => {
          const status = document.querySelector('[data-ops-access-agent-status]');
          const reason = document.querySelector('[data-ops-access-agent-reason]');
          if (!status || !reason) throw new Error('Missing access Agent service controls');
          status.value = '需复核';
          reason.value = '学校老师招生旺季 Agent 分析需审计';
          document.querySelector('[data-ops-access-grant-submit][data-access-id="user-zju-staff"]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已更新账号 Agent 服务权限') && document.body.textContent.includes('需复核')", "ops access agent service updated");
      await waitFor(cdp, "document.querySelector('[data-ops-access-view=\"accounts\"]')?.classList.contains('active')", "ops access returned to accounts");
      await evaluate(cdp, "document.querySelector('[data-ops-access-approve][data-access-id=\"user-nju-pending\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('账号权限已批准') && document.body.textContent.includes('授权已批准并写入审计')", "ops access grant approved");
      await evaluate(cdp, "document.querySelector('[data-ops-access-toggle][data-access-id=\"user-zju-staff\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已停用账号') && document.body.textContent.includes('账号已停用，授权已撤销')", "ops access disabled");
      await evaluate(cdp, "document.querySelector('[data-ops-access-toggle][data-access-id=\"user-zju-staff\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已恢复账号') && document.body.textContent.includes('账号已恢复')", "ops access restored");
      await evaluate(cdp, "document.querySelector('[data-ops-access-export]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已生成账号权限审计 CSV')", "ops access audit export");
      const accessUpdated = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const invite = state.accessRecords?.find((item) => item.email === 'new.iso@example.edu');
          const nju = state.accessRecords?.find((item) => item.id === 'user-nju-pending');
          const zju = state.accessRecords?.find((item) => item.id === 'user-zju-staff');
          return Boolean(invite
            && invite.role === 'school_staff'
            && invite.schoolTenant === 'Fudan University'
            && invite.inviteCode === 'FDU-2026-ISO'
            && invite.grantStatus === 'pending-review'
            && nju?.grantStatus === 'approved-preview'
            && zju?.status === 'active'
            && zju?.grantStatus === 'approved-preview'
            && zju?.agentAccessStatus === '需复核'
            && zju?.lastAgentAccessReason === '学校老师招生旺季 Agent 分析需审计'
            && state.accessAuditCsv?.includes('new.iso@example.edu')
            && state.accessExportCount === state.accessRecords.length
            && state.auditItems?.some((item) => item.includes('已更新账号 Agent 服务权限：user-zju-staff · 需复核'))
            && state.auditItems?.some((item) => item.includes('已生成账号权限审计 CSV')));
        })()
      `);
      if (!accessUpdated) throw new Error("Ops access governance actions did not persist unified account and invitation state.");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"queue\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"queue\"]').hidden", "ops queue section");
      await waitFor(cdp, "document.querySelector('[data-ops-queue-view=\"work\"]')?.classList.contains('active')", "ops queue work view");
      await evaluate(cdp, "document.querySelector('[data-ops-queue-command-view=\"audit\"]')?.click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-queue-view-panel=\"audit\"]')?.hidden", "ops queue command opens audit");
      await evaluate(cdp, "document.querySelector('[data-ops-queue-command-view=\"support\"]')?.click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-queue-view-panel=\"support\"]')?.hidden", "ops queue command opens support");
      await evaluate(cdp, "document.querySelector('[data-ops-queue-command-view=\"agent\"]')?.click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-queue-view-panel=\"agent\"]')?.hidden", "ops queue command opens agent");
      await evaluate(cdp, "document.querySelector('[data-ops-queue-command-view=\"work\"]')?.click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-queue-view-panel=\"work\"]')?.hidden", "ops queue command returns work");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-queue-detail]'))", "ops queue detail");
      await evaluate(cdp, "document.querySelector('[data-ops-queue-select][data-queue-id=\"review-agent-audit\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-ops-queue-detail]')?.dataset.queueId === 'review-agent-audit'",
        "ops queue selected",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-action=\"retry-routing\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('已按幂等检查加入发送重试队列')",
        "ops retry toast",
      );
      await waitFor(cdp, "document.querySelector('[data-ops-last-action]')?.textContent.includes('已按幂等检查加入发送重试队列')", "ops audit UI");
      await evaluate(cdp, "document.querySelector('[data-ops-queue-view=\"support\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-queue-view-panel=\"support\"]')?.hidden && Boolean(document.querySelector('[data-ops-support-console]'))", "ops queue support view");
      await evaluate(cdp, "document.querySelector('[data-ops-action=\"support-lookup\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('支持查询已打开')",
        "ops support lookup toast",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-queue-view=\"work\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-queue-view-panel=\"work\"]')?.hidden", "ops queue work view after support");
      await evaluate(cdp, "document.querySelector('[data-ops-action=\"review-agent-audit\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已打开 Agent 策略拒绝记录')", "ops agent audit queue action");
      await evaluate(cdp, "document.querySelector('[data-ops-queue-view=\"audit\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-queue-view-panel=\"audit\"]')?.hidden && Boolean(document.querySelector('[data-ops-audit-events-panel]'))", "ops queue audit view");
      await evaluate(cdp, `
        (() => {
          const moduleFilter = document.querySelector('[data-ops-audit-module-filter]');
          const actionFilter = document.querySelector('[data-ops-audit-action-filter]');
          const search = document.querySelector('[data-ops-audit-search]');
          if (!moduleFilter || !actionFilter || !search) throw new Error('Missing audit event filters');
          moduleFilter.value = 'agent';
          actionFilter.value = 'review';
          search.value = 'Agent';
          document.querySelector('[data-ops-audit-apply-filter]').click();
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('审计事件筛选已应用') && [...document.querySelectorAll('[data-ops-audit-event]')].every((item) => item.dataset.module === 'agent' && item.dataset.action === 'review')",
        "ops audit filters narrow Agent review events",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-audit-export]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已生成审计事件 CSV') && Boolean(document.querySelector('[data-ops-audit-export-result]'))", "ops audit csv export");
      await evaluate(cdp, "document.querySelector('[data-ops-queue-view=\"agent\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-queue-view-panel=\"agent\"]')?.hidden", "ops queue agent view");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-agent-operations]')) && document.body.textContent.includes('CUACAgentGatewaySummary')", "ops Agent operations card");
      await evaluate(cdp, "document.querySelector('[data-ops-agent-ops-action=\"refresh\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已刷新 Agent 运维摘要') && document.body.textContent.includes('已刷新网关、服务配置、就绪度和生成队列摘要') && !document.body.textContent.includes('Agent 申请辅助 readiness')", "ops Agent operations refresh");
      await evaluate(cdp, "document.querySelector('[data-ops-agent-ops-action=\"retry-failed\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已重试 Agent 失败任务') && document.body.textContent.includes('已重试 2 个失败生成任务')", "ops Agent failed job retry");
      await evaluate(cdp, "document.querySelector('[data-ops-agent-ops-action=\"toggle-rollout\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('已暂停 Agent 放量') && document.querySelector('[data-ops-agent-rollout]')?.textContent.trim() === '0%'", "ops Agent rollout pause");
      const audited = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const retryRecord = state.queueRecords?.find((item) => item.id === 'retry-routing');
          return Boolean(
            state.lastAction?.includes('已暂停 Agent 放量') &&
            state.queueView === 'agent' &&
            Array.isArray(state.auditItems) &&
            state.routingRetries === 1 &&
            retryRecord?.status === '重试已排队' &&
            state.supportLookup?.query?.includes('maya@example.com') &&
            state.auditModuleFilter === 'agent' &&
            state.auditActionFilter === 'review' &&
            state.auditExportCsv?.includes('occurredAt') &&
            state.auditExportCsv?.includes('agent_action') &&
            Number(state.auditExportCount || 0) >= 1 &&
            state.agentOps?.rolloutPaused === true &&
            state.agentOps?.rolloutPercent === 0 &&
            state.agentOps?.failedJobs === 1 &&
            state.agentOps?.runningJobs >= 4 &&
            state.auditItems?.some((item) => item.includes('已生成审计事件 CSV')) &&
            state.auditItems?.some((item) => item.includes('已暂停 Agent 放量'))
          );
        })()
      `);
      if (!audited) throw new Error("Ops admin queue/support actions did not persist audited demo state.");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"overview\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"overview\"]').hidden", "ops overview section");
      const overviewSynced = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const schoolCount = Array.isArray(state.schoolRecords) ? state.schoolRecords.length : 0;
          const summary = document.querySelector('[data-ops-overview-summary]')?.textContent || '';
          const routingCount = document.querySelector('[data-ops-routing-count]')?.textContent || '';
          return schoolCount >= 5
            && state.schoolRecords.some((school) => school.nameZh === '批量导入大学')
            && state.schoolRecords.some((school) => school.nameZh === '测试大学')
            && summary.includes(schoolCount + ' 所学校')
            && summary.includes('5 个账号权限')
            && summary.includes('3 个学生申请')
            && summary.includes('1 个学生待跟进')
            && routingCount.trim() === '1';
        })()
      `);
      if (!overviewSynced) throw new Error("Ops admin overview did not summarize edited school, student, and queue state.");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden && document.body.textContent.includes('城市、公共奖学金与申请时间窗管理')", "ops content section");
      await evaluate(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-content-save]'))", "ops public scholarship editor");
      await evaluate(cdp, "document.querySelector('[data-ops-scholarship-import-toggle]').click()");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-scholarship-import-text]')) && document.body.textContent.includes('公共奖学金 JSON 导入')", "ops scholarship import panel opens");
      await evaluate(cdp, `
        (() => {
          const area = document.querySelector('[data-ops-scholarship-import-text]');
          if (!area) throw new Error('Missing scholarship import textarea');
          area.value = ${JSON.stringify(JSON.stringify({ items: [{ slug: "broken-scholarship-import" }] }, null, 2))};
          document.querySelector('[data-ops-scholarship-import-preview]').click();
        })()
      `);
      await waitFor(cdp, "document.body.textContent.includes('第 1 条缺少 title') && Boolean(document.querySelector('[data-ops-scholarship-import-text]')) && !document.querySelector('.ops-error-state')", "ops scholarship invalid import shows inline error");
      await evaluate(cdp, "document.querySelector('[data-ops-scholarship-import-apply]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('导入失败') && document.body.textContent.includes('第 1 条缺少 title')", "ops scholarship invalid import apply blocked");
      const invalidScholarshipImportBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const text = document.querySelector('[data-ops-scholarship-import-text]')?.value || '';
          return Boolean(state.scholarshipImportOpen === true
            && state.scholarshipImportPreview?.tone === 'danger'
            && text.includes('broken-scholarship-import')
            && !state.publicScholarshipRecords?.some((item) => item.slug === 'broken-scholarship-import'));
        })()
      `);
      if (!invalidScholarshipImportBlocked) throw new Error("Ops scholarship invalid JSON import did not stay editable or incorrectly wrote a record.");
      await evaluate(cdp, `
        (() => {
          const area = document.querySelector('[data-ops-scholarship-import-text]');
          if (!area) throw new Error('Missing scholarship import textarea');
          area.value = ${JSON.stringify(JSON.stringify([
            {
              slug: "imported-scholarship-demo",
              title: "Imported Scholarship Demo",
              type: "provincial",
              fundingLevel: "partial",
              providerName: "Jiangsu universities",
              providerLocation: "Jiangsu",
              summary: "Imported CSCAlite-style public scholarship.",
              targetCountries: ["Malaysia"],
              benefits: ["Tuition support"],
              schoolIds: [1002],
              programIds: [2002],
              status: "draft",
              sortOrder: 1
            }
          ], null, 2))};
          document.querySelector('[data-ops-scholarship-import-preview]').click();
        })()
      `);
      await waitFor(cdp, "document.body.textContent.includes('已识别 1 条公共奖学金') && !document.querySelector('.ops-error-state')", "ops scholarship import preview validates");
      await evaluate(cdp, "document.querySelector('[data-ops-scholarship-import-apply]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('导入完成：新增 1') && document.body.textContent.includes('Imported Scholarship Demo')", "ops scholarship import applies");
      const scholarshipImported = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const item = state.publicScholarshipRecords?.find((record) => record.title === 'Imported Scholarship Demo');
          return Boolean(item
            && item.slug === 'imported-scholarship-demo'
            && item.providerName === 'Jiangsu universities'
            && Array.isArray(item.schoolIds)
            && item.schoolIds.includes(1002)
            && Array.isArray(item.programIds)
            && item.programIds.includes(2002)
            && Array.isArray(item.benefits)
            && item.benefits.includes('Tuition support')
            && state.lastAction === '已批量导入公共奖学金 JSON');
        })()
      `);
      if (!scholarshipImported) throw new Error("Ops public scholarship bulk import did not persist AdminScholarship-shaped data.");
      await evaluate(cdp, "document.querySelector('[data-ops-content-save]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('公共奖学金字段已本地保存')", "ops imported public scholarship numeric ids save");
      const importedScholarshipNumericIdsSaved = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const item = state.publicScholarshipRecords?.find((record) => record.title === 'Imported Scholarship Demo');
          return Array.isArray(item?.schoolIds)
            && item.schoolIds.includes(1002)
            && !item.schoolIds.includes('1002')
            && Array.isArray(item.programIds)
            && item.programIds.includes(2002)
            && !item.programIds.includes('2002');
        })()
      `);
      if (!importedScholarshipNumericIdsSaved) throw new Error("Ops public scholarship save did not preserve CSCAlite numeric schoolIds/programIds.");
      await evaluate(cdp, `
        (() => {
          const search = document.querySelector('[data-ops-content-search]');
          const status = document.querySelector('[data-ops-content-status-filter]');
          if (!search || !status) throw new Error('Missing content search/status filter controls');
          search.value = 'Imported';
          status.value = 'draft';
          document.querySelector('[data-ops-content-apply-filter]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('内容数据筛选已应用') && document.querySelector('[data-ops-content-search]')?.value === 'Imported'", "ops content filters applied");
      const contentFiltered = await evaluate(cdp, `
        (() => {
          const cards = [...document.querySelectorAll('[data-ops-content-select]')];
          const body = document.body.textContent || '';
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          return cards.length === 1
            && body.includes('Imported Scholarship Demo')
            && !body.includes('新公共奖学金草稿')
            && state.contentSearch === 'Imported'
            && state.contentStatusFilter === 'draft';
        })()
      `);
      if (!contentFiltered) throw new Error("Ops content filters did not narrow public scholarship records like CSCAlite content management.");
      await installRuntimeErrorTrap(cdp);
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新公共奖学金草稿') && document.querySelector('[data-ops-content-search]')?.value === '' && document.querySelector('[data-ops-content-status-filter]')?.value === 'all' && Boolean(document.querySelector('[data-ops-scholarship-record-readonly] [data-source-field=\"Scholarship.id\"]')) && Boolean(document.querySelector('[data-source-field=\"AdminScholarship.schoolIds\"]')) && document.body.textContent.includes('基础信息') && document.body.textContent.includes('展示内容') && document.body.textContent.includes('适用范围') && document.body.textContent.includes('来源与联系') && document.body.textContent.includes('关联学校') && document.body.textContent.includes('关联项目') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-save]')) && Boolean(document.querySelector('[data-ops-content-field=\"schoolIds\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"programIds\"]')) && !document.querySelector('[data-ops-content-field=\"id\"]') && !document.querySelector('[data-ops-content-field=\"createdAt\"]') && !document.querySelector('[data-ops-content-field=\"updatedAt\"]') && Boolean(document.querySelector('[data-ops-scholarship-school-picker]')) && Boolean(document.querySelector('[data-ops-scholarship-school-toggle][value=\"zju\"]')) && Boolean(document.querySelector('[data-ops-scholarship-program-picker]')) && Boolean(document.querySelector('[data-ops-scholarship-program-toggle][value=\"zju-cs-msc\"]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops public scholarship draft created without blank state",
      );
      await assertNoRuntimeErrors(cdp, "ops public scholarship create click raised runtime error");
      await evaluate(cdp, `
        (() => {
          const root = document.querySelector('[data-detail-root]');
          if (!root) throw new Error('Missing detail root for forced blank recovery test');
          root.innerHTML = '';
          if (typeof ensureOpsPageNotBlank !== 'function') throw new Error('Missing ops blank recovery helper');
          ensureOpsPageNotBlank('QA forced blank after scholarship create');
        })()
      `);
      await waitFor(
        cdp,
        "!document.querySelector('[data-ops-section=\"content\"]')?.hidden && document.body.textContent.includes('新公共奖学金草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-save]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops forced blank recovery restores public scholarship editor",
      );
      await evaluate(cdp, `
        (() => {
          const title = document.querySelector('[data-ops-content-field="title"]');
          const readonlySignals = document.querySelector('[data-ops-scholarship-record-readonly]');
          const type = document.querySelector('[data-ops-content-field="type"]');
          const funding = document.querySelector('[data-ops-content-field="fundingLevel"]');
          const status = document.querySelector('[data-ops-content-field="status"]');
          const materials = document.querySelector('[data-ops-content-field="applicationMaterials"]');
          const countries = document.querySelector('[data-ops-content-field="targetCountries"]');
          const benefits = document.querySelector('[data-ops-content-field="benefitItems"]');
          const eligibility = document.querySelector('[data-ops-content-field="eligibilityItems"]');
          const requirement = document.querySelector('[data-ops-content-field="requirementText"]');
          const steps = document.querySelector('[data-ops-content-field="applicationSteps"]');
          const links = document.querySelector('[data-ops-content-field="actionLinks"]');
          const contact = document.querySelector('[data-ops-content-field="contactInfo"]');
          const schoolIds = document.querySelector('[data-ops-content-field="schoolIds"]');
          const programIds = document.querySelector('[data-ops-content-field="programIds"]');
          const zju = document.querySelector('[data-ops-scholarship-school-toggle][value="zju"]');
          const nju = document.querySelector('[data-ops-scholarship-school-toggle][value="nju"]');
          const zjuProgram = document.querySelector('[data-ops-scholarship-program-toggle][value="zju-cs-msc"]');
          if (!title || !readonlySignals || !type || !funding || !status || !materials || !countries || !benefits || !eligibility || !requirement || !steps || !links || !contact || !schoolIds || !programIds || !zju || !nju || !zjuProgram) throw new Error('Missing AdminScholarship CSCAlite fields');
          if (type.tagName !== 'SELECT' || funding.tagName !== 'SELECT' || status.tagName !== 'SELECT') throw new Error('AdminScholarship enum fields must be select controls');
          if (document.querySelector('[data-ops-content-field="id"]') || document.querySelector('[data-ops-content-field="version"]') || document.querySelector('[data-ops-content-field="createdAt"]') || document.querySelector('[data-ops-content-field="updatedAt"]')) throw new Error('AdminScholarship system fields should not be editable inputs');
          if (!readonlySignals.textContent.includes('本区只编辑公共奖学金的可维护字段')) throw new Error('AdminScholarship readonly signal should explain the editable input boundary');
          title.value = '测试公共奖学金';
          type.value = 'government';
          funding.value = 'full';
          status.value = 'published';
          materials.value = 'Transcript - Official academic record\\nPassport - Valid passport scan';
          countries.value = 'Malaysia\\nPakistan';
          benefits.value = 'Tuition waiver - Partial tuition support\\nLiving allowance - Confirm by notice';
          eligibility.value = 'Nationality - Non-Chinese applicants\\nAcademic fit - Matched degree route';
          requirement.value = [
            '1. Funding categories',
            'Full scholarship supports tuition, accommodation, stipend, and medical insurance where the annual notice confirms coverage.',
            'Partial scholarship may cover tuition only or a reduced living allowance depending on the university route.',
            '2. Eligibility',
            '1. Applicants must be non-Chinese international students.',
            '2. Degree level and program route must match the current university notice.',
            '3. Program universities',
            '1. Zhejiang University | Computer Science MSc',
            '2. Nanjing University | Software Engineering MSc',
            '4. Application materials',
            '1. Passport copy',
            '2. Official academic transcript',
            '3. Language proof when the selected program asks for it'
          ].join('\\n');
          steps.value = 'Prepare forms - Confirm notice list\\nSubmit to school - Follow school instruction';
          links.value = 'Official notice | https://example.edu/scholarship | source\\nApplication guide | https://example.edu/apply | primary';
          contact.value = 'Email - scholarship@example.edu\\nWebsite - https://example.edu/scholarship\\nNote - Confirm annually';
          if (!zju.checked) zju.click();
          if (!nju.checked) nju.click();
          if (!schoolIds.value.includes('zju') || !schoolIds.value.includes('nju')) throw new Error('School picker did not sync Scholarship.schoolIds');
          if (!zjuProgram.checked) zjuProgram.click();
          if (!programIds.value.includes('zju-cs-msc')) throw new Error('Program picker did not sync AdminScholarship.programIds');
          document.querySelector('[data-ops-content-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('公共奖学金字段已本地保存')", "ops public scholarship save");
      await waitFor(
        cdp,
        `(() => {
          const rows = [...document.querySelectorAll('.ops-content-list-row')].map((node) => node.textContent || '');
          const editor = document.querySelector('[data-ops-content-editor][data-content-type="scholarships"]')?.textContent || '';
          const rowOk = rows.some((text) => text.includes('测试公共奖学金') && text.includes('2') && text.includes('学校') && text.includes('1') && text.includes('项目'));
          const editorOk = (editor.includes('浙江大学') || editor.includes('Zhejiang'))
            && (editor.includes('南京大学') || editor.includes('Nanjing'))
            && (editor.includes('计算机科学硕士') || editor.includes('Computer Science'));
          return rowOk && editorOk;
        })()`,
        "ops public scholarship compact card and editor show related schools and programs",
      );
      const publicScholarshipVersioned = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const item = state.publicScholarshipRecords?.find((record) => record.title === '测试公共奖学金');
          return Number(item?.version || 0) > 1;
        })()
      `);
      if (!publicScholarshipVersioned) throw new Error("Ops public scholarship save did not increment CSCAlite version.");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          state.publicScholarshipRecords = state.publicScholarshipRecords.map((record) => record.title === '测试公共奖学金'
            ? { ...record, version: Number(record.version || 1) + 1, summary: 'Other admin saved a fresher scholarship summary', status: 'published' }
            : record);
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
          const summary = document.querySelector('[data-ops-content-field="summary"]');
          if (!summary) throw new Error('Missing summary field for AdminScholarship version conflict');
          summary.value = 'Stale editor should not overwrite this scholarship';
          summary.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-content-save]').click();
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('奖学金已被其他管理员更新，请刷新后再继续')",
        "ops public scholarship save version conflict",
      );
      const publicScholarshipConflictBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const item = state.publicScholarshipRecords?.find((record) => record.title === '测试公共奖学金');
          const editor = document.querySelector('[data-ops-content-editor]');
          const warning = document.querySelector('[data-ops-content-unsaved-warning]');
          return item?.summary === 'Other admin saved a fresher scholarship summary'
            && item?.summary !== 'Stale editor should not overwrite this scholarship'
            && editor?.dataset.dirty === 'true'
            && warning?.hidden === false;
        })()
      `);
      if (!publicScholarshipConflictBlocked) throw new Error("Ops AdminScholarship version conflict did not block stale save.");
      await evaluate(cdp, `
        (() => {
          const editor = document.querySelector('[data-ops-content-editor]');
          if (!editor) throw new Error('Missing editor for AdminScholarship archive conflict');
          editor.dataset.dirty = 'false';
          const warning = document.querySelector('[data-ops-content-unsaved-warning]');
          if (warning) warning.hidden = true;
          document.querySelector('[data-ops-content-archive]').click();
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('奖学金已被其他管理员更新，请刷新后再继续')",
        "ops public scholarship archive version conflict",
      );
      const publicScholarshipArchiveConflictBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const item = state.publicScholarshipRecords?.find((record) => record.title === '测试公共奖学金');
          return item?.status === 'published';
        })()
      `);
      if (!publicScholarshipArchiveConflictBlocked) throw new Error("Ops AdminScholarship version conflict did not block stale archive.");
      const savedScholarshipSlug = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const item = state.publicScholarshipRecords?.find((record) => record.title === '测试公共奖学金');
          return item?.slug || item?.id || '';
        })()
      `);
      if (!savedScholarshipSlug) throw new Error("Ops public scholarship save did not persist a stable slug/id.");
      await navigate(cdp, `scholarship-detail.html?scholarship=${encodeURIComponent(savedScholarshipSlug)}&motion=off`);
      await waitFor(cdp, "document.querySelector('.funding-detail-hero h1')?.textContent.trim() === '测试公共奖学金'", "ops saved scholarship opens in public detail");
      const savedScholarshipVisible = await evaluate(cdp, `
        (() => {
          const text = document.body.textContent || '';
          const root = document.querySelector('[data-detail-root]');
          const checks = {
            sourceModel: root?.dataset.detailSourceModel === 'Scholarship',
            funding: text.includes('full') || text.includes('Full'),
            material: text.includes('Passport') && text.includes('Valid passport scan'),
            eligibility: text.includes('Nationality') && text.includes('Non-Chinese applicants'),
            officialReader: text.includes('Official notice reader') && text.includes('Readable scholarship notice'),
            officialSections: text.includes('Funding categories') && text.includes('Program universities'),
            officialSchoolRows: text.includes('Nanjing University') && text.includes('Software Engineering MSc'),
            step: text.includes('Submit to school') && text.includes('school instruction'),
            contact: text.includes('scholarship@example.edu') && text.includes('https://example.edu/scholarship'),
            school: text.includes('Zhejiang University') || text.includes('浙江大学'),
            program: text.includes('Computer Science MSc') || text.includes('计算机科学硕士'),
          };
          return { ok: Object.values(checks).every(Boolean), checks, text: text.slice(0, 3600) };
        })()
      `);
      if (!savedScholarshipVisible?.ok) throw new Error(`Public scholarship detail did not render saved CSCAlite AdminScholarship preview: ${JSON.stringify(savedScholarshipVisible?.checks || {})}`);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden && document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active')", "ops scholarship tab returns after public preview");
      await evaluate(cdp, "document.querySelector('[data-ops-content-tab=\"cities\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-content-tab=\"cities\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-ops-content-save]'))", "ops city editor");
      await waitFor(
        cdp,
        "document.body.textContent.includes('真实聚合来自学校、项目和奖学金库') && Boolean(document.querySelector('.ops-aggregate-sources')) && Boolean(document.querySelector('[data-source-field=\"CityGuideAggregate.visiblePrograms\"]'))",
        "ops city aggregate preview",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(cdp, "document.body.textContent.includes('新城市草稿') && Boolean(document.querySelector('[data-source-field=\"CityGuideAggregate.visibleSchools\"]'))", "ops city draft created");
      await evaluate(cdp, `
        (() => {
          const name = document.querySelector('[data-ops-content-field="nameZh"]');
          const nameEn = document.querySelector('[data-ops-content-field="nameEn"]');
          const slug = document.querySelector('[data-ops-content-field="slug"]');
          const readonlySignals = document.querySelector('[data-ops-city-record-readonly]');
          const status = document.querySelector('[data-ops-content-field="status"]');
          const quickFacts = document.querySelector('[data-ops-content-field="quickFacts"]');
          const budgetSummary = document.querySelector('[data-ops-content-field="budgetSummary"]');
          const bestFor = document.querySelector('[data-ops-content-field="bestFor"]');
          const csca = document.querySelector('[data-ops-content-field="referenceCscaSchoolCount"]');
          const costProfiles = document.querySelector('[data-ops-content-field="costProfiles"]');
          const nearby = document.querySelector('[data-ops-content-field="nearby"]');
          const applicationTips = document.querySelector('[data-ops-content-field="applicationTips"]');
          const cityFaqs = document.querySelector('[data-ops-content-field="cityFaqs"]');
          const contentJson = document.querySelector('[data-ops-content-field="contentJsonText"]');
          if (!name || !nameEn || !slug || !readonlySignals || !status || !quickFacts || !budgetSummary || !bestFor || !csca || !costProfiles || !nearby || !applicationTips || !cityFaqs || !contentJson) throw new Error('Missing CityGuide CSCAlite fields');
          if (document.querySelector('[data-ops-content-field="id"]') || document.querySelector('[data-ops-content-field="createdAt"]') || document.querySelector('[data-ops-content-field="updatedAt"]')) throw new Error('CityGuide system fields should not be editable inputs');
          if (!readonlySignals.textContent.includes('本区只编辑城市指南的可维护字段')) throw new Error('CityGuide readonly signal should explain the editable input boundary');
          if (status.tagName !== 'SELECT') throw new Error('CityGuide status must be a select control');
          name.value = '测试城市';
          nameEn.value = 'Test City';
          slug.value = 'test-city-cscalite';
          status.value = 'published';
          contentJson.value = JSON.stringify({
            summary: 'JSON summary from CSCAlite',
            why: ['JSON migration path'],
            relatedProgramKeywords: ['Data Science', 'International Business'],
            faqs: [{ question: 'Can JSON content be saved?', answer: 'Yes' }],
            cityFaqs: [{ question: 'Is this city student friendly?', answer: 'Use program fit and cost together.' }]
          }, null, 2);
          quickFacts.value = 'Monthly cost - RMB 3,400 - Student budget, shared room';
          budgetSummary.value = 'Monthly - RMB 3,400\\nYearly - RMB 40,800\\nConfirm dorm prices, utilities, and metro cards';
          bestFor.value = 'Budget-sensitive students comparing exact programs\\nApplicants who need English-taught routes';
          csca.value = '2';
          costProfiles.value = 'Low budget - RMB 3,000 - Campus housing, metro access';
          nearby.value = '苏州\\n杭州';
          applicationTips.value = 'Start from exact programs\\nPrepare passport, transcript, and translations';
          document.querySelector('[data-ops-content-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('城市指南字段已本地保存')", "ops city save");
      const cityFaqsFieldRehydrated = await evaluate(cdp, `
        (() => {
          const field = document.querySelector('[data-ops-content-field="cityFaqs"]');
          return field?.value.includes('Is this city student friendly?')
            && field.value.includes('Use program fit and cost together.');
        })()
      `);
      if (!cityFaqsFieldRehydrated) throw new Error("Ops city editor did not rehydrate CSCAlite CityGuide.content.cityFaqs.");
      const savedCitySlug = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const city = state.cityGuideRecords?.find((record) => record.nameZh === '测试城市');
          return city?.slug || '';
        })()
      `);
      if (savedCitySlug !== "test-city-cscalite") throw new Error("Ops city save did not persist a stable CityGuide slug.");
      await navigate(cdp, `city-detail.html?city=${savedCitySlug}&motion=off`);
      await waitFor(cdp, "Boolean(document.querySelector('[data-detail-root]')) && document.body.textContent.trim().length > 300", "ops saved city detail shell");
      const savedCityVisible = await evaluate(cdp, `
        (() => {
          const text = document.body.textContent || '';
          const root = document.querySelector('[data-detail-root]');
          const checks = {
            sourceModel: root?.dataset.detailSourceModel === 'CityGuide',
            title: document.querySelector('.city-detail-hero h1')?.textContent.includes('Test City'),
            summary: text.includes('JSON summary from CSCAlite'),
            monthlyLabel: text.includes('Monthly cost'),
            budget: text.includes('RMB 3,400'),
            bestForStrip: Boolean(document.querySelector('.city-budget-card .city-best-for-strip')),
            bestForCopy: text.includes('Budget-sensitive students comparing exact programs'),
            quickFact: text.includes('Student budget, shared room'),
            programDirections: text.includes('Recommended program directions'),
            dataScience: text.includes('Data Science'),
            internationalBusiness: text.includes('International Business'),
            faq: text.includes('Can JSON content be saved?'),
            cityFaq: text.includes('Is this city student friendly?'),
            cityFaqAnswer: text.includes('Use program fit and cost together.'),
          };
          return { ok: Object.values(checks).every(Boolean), checks, text: text.slice(0, 3000), href: location.href };
        })()
      `);
      if (!savedCityVisible?.ok) throw new Error(`Public city detail did not render the saved CSCAlite CityGuide.content preview: ${JSON.stringify(savedCityVisible)}`);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden && document.querySelector('[data-ops-content-tab=\"cities\"]')?.classList.contains('active')", "ops city tab returns after public preview");
      await evaluate(cdp, `
        (() => {
          const field = document.querySelector('[data-ops-content-field="nameZh"]');
          if (!field) throw new Error('Missing CityGuide.nameZh field for dirty status guard');
          field.value = '未保存城市标题';
          field.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-content-archive]').click();
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-ops-content-unsaved-warning]')?.hidden === false && document.querySelector('[data-completion-toast]')?.textContent.includes('当前内容有未保存改动')",
        "ops content dirty archive guard",
      );
      const dirtyContentBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const city = state.cityGuideRecords?.find((record) => record.slug === 'test-city-cscalite');
          return Boolean(document.querySelector('[data-ops-content-editor]')?.dataset.dirty === 'true'
            && city?.nameZh === '测试城市'
            && city?.status !== 'archived');
        })()
      `);
      if (!dirtyContentBlocked) throw new Error("Ops content archive should be blocked while CityGuide edits are unsaved.");
      await evaluate(cdp, `
        (() => {
          const field = document.querySelector('[data-ops-content-field="nameZh"]');
          if (!field) throw new Error('Missing CityGuide.nameZh field for dirty save recovery');
          field.value = '测试城市';
          field.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-content-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('城市指南字段已本地保存')", "ops content dirty guard save recovery");
      await evaluate(cdp, "document.querySelector('[data-ops-content-publish]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('城市指南已发布')", "ops city publish");
      await evaluate(cdp, "document.querySelector('[data-ops-content-archive]').click()");
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('城市指南已归档')", "ops city archive");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          state.cityGuideRecords = state.cityGuideRecords.map((record) => record.slug === 'test-city-cscalite'
            ? { ...record, version: Number(record.version || 1) + 1, status: 'archived', summary: 'Other admin kept the city archived' }
            : record);
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
          document.querySelector('[data-ops-content-publish]').click();
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('城市指南已被其他管理员更新，请刷新后再继续')",
        "ops city publish version conflict",
      );
      const cityPublishConflictBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const city = state.cityGuideRecords?.find((record) => record.slug === 'test-city-cscalite');
          return city?.status === 'archived' && city?.summary === 'Other admin kept the city archived';
        })()
      `);
      if (!cityPublishConflictBlocked) throw new Error("Ops CityGuide version conflict did not block stale publish.");
      await evaluate(cdp, "document.querySelector('[data-ops-content-tab=\"timeline\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-content-tab=\"timeline\"]')?.classList.contains('active') && Boolean(document.querySelector('[data-source-field=\"ApplicationTimelineWindow.month\"]')) && !(document.body.innerText || '').includes('ApplicationTimelineWindow.month') && Boolean(document.querySelector('[data-ops-content-save]'))", "ops timeline editor");
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新申请时间窗草稿') && Boolean(document.querySelector('[data-source-field=\"ApplicationTimelineWindow.applicationWindow\"]')) && Boolean(document.querySelector('[data-source-field=\"ApplicationTimelineWindow.cscaWindow\"]')) && !(document.body.innerText || '').includes('ApplicationTimelineWindow.applicationWindow') && !(document.body.innerText || '').includes('ApplicationTimelineWindow.cscaWindow') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"timeline\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"month\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"applicationWindow\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"cscaWindow\"]')) && !document.querySelector('.ops-error-state')",
        "ops timeline draft created",
      );
      await evaluate(cdp, `
        (() => {
          const readonlySignals = document.querySelector('[data-ops-timeline-record-readonly]');
          const month = document.querySelector('[data-ops-content-field="month"]');
          const title = document.querySelector('[data-ops-content-field="title"]');
          const applicationWindow = document.querySelector('[data-ops-content-field="applicationWindow"]');
          const cscaWindow = document.querySelector('[data-ops-content-field="cscaWindow"]');
          const status = document.querySelector('[data-ops-content-field="status"]');
          const sortOrder = document.querySelector('[data-ops-content-field="sortOrder"]');
          if (!readonlySignals || !month || !title || !applicationWindow || !cscaWindow || !status || !sortOrder) throw new Error('Missing ApplicationTimelineWindow fields');
          if (document.querySelector('[data-ops-content-field="id"]') || document.querySelector('[data-ops-content-field="version"]') || document.querySelector('[data-ops-content-field="updatedAt"]')) throw new Error('ApplicationTimelineWindow system fields should not be editable inputs');
          if (!readonlySignals.textContent.includes('本区只编辑申请时间窗的可维护字段')) throw new Error('Timeline readonly signal should explain the editable input boundary');
          month.value = 'Jan';
          title.value = 'Late application check';
          applicationWindow.value = 'Review late intake schools and saved choices.';
          cscaWindow.value = 'Confirm CSCA requirement before school contact.';
          status.value = 'published';
          sortOrder.value = '9';
          document.querySelector('[data-ops-content-save]').click();
        })()
      `);
      await waitFor(cdp, "document.querySelector('[data-completion-toast]')?.textContent.includes('申请时间窗字段已本地保存')", "ops timeline save");
      const timelineVersioned = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const editorId = document.querySelector('[data-ops-content-editor]')?.dataset.contentId;
          const item = state.timelineWindowRecords?.find((record) => String(record.id) === String(editorId));
          return Boolean(editorId && item?.title === 'Late application check' && Number(item?.version || 0) > 1);
        })()
      `);
      if (!timelineVersioned) throw new Error("Ops ApplicationTimelineWindow save did not increment CSCAlite version.");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const editorId = document.querySelector('[data-ops-content-editor]')?.dataset.contentId;
          state.timelineWindowRecords = state.timelineWindowRecords.map((record) => String(record.id) === String(editorId)
            ? { ...record, version: Number(record.version || 1) + 1, applicationWindow: 'Other admin saved a fresher late intake application window', status: 'published' }
            : record);
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
          const field = document.querySelector('[data-ops-content-field="applicationWindow"]');
          if (!field) throw new Error('Missing timeline applicationWindow field for version conflict');
          field.value = 'Stale editor should not overwrite this timeline';
          field.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('[data-ops-content-save]').click();
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('申请时间窗已被其他管理员更新，请刷新后再继续')",
        "ops timeline save version conflict",
      );
      const timelineSaveConflictBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const editor = document.querySelector('[data-ops-content-editor]');
          const item = state.timelineWindowRecords?.find((record) => String(record.id) === String(editor?.dataset.contentId));
          const warning = document.querySelector('[data-ops-content-unsaved-warning]');
          return item?.applicationWindow === 'Other admin saved a fresher late intake application window'
            && item?.applicationWindow !== 'Stale editor should not overwrite this timeline'
            && item?.status === 'published'
            && editor?.dataset.dirty === 'true'
            && warning?.hidden === false;
        })()
      `);
      if (!timelineSaveConflictBlocked) throw new Error("Ops ApplicationTimelineWindow version conflict did not block stale save.");
      await evaluate(cdp, `
        (() => {
          const editor = document.querySelector('[data-ops-content-editor]');
          if (!editor) throw new Error('Missing timeline editor for archive conflict');
          editor.dataset.dirty = 'false';
          const warning = document.querySelector('[data-ops-content-unsaved-warning]');
          if (warning) warning.hidden = true;
          document.querySelector('[data-ops-content-archive]').click();
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-toast]')?.textContent.includes('申请时间窗已被其他管理员更新，请刷新后再继续')",
        "ops timeline archive version conflict",
      );
      const timelineArchiveConflictBlocked = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const editorId = document.querySelector('[data-ops-content-editor]')?.dataset.contentId;
          const item = state.timelineWindowRecords?.find((record) => String(record.id) === String(editorId));
          return item?.status === 'published' && item?.applicationWindow === 'Other admin saved a fresher late intake application window';
        })()
      `);
      if (!timelineArchiveConflictBlocked) throw new Error("Ops ApplicationTimelineWindow version conflict did not block stale archive.");
      const contentSaved = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const scholarshipOk = state.publicScholarshipRecords?.some((item) => item.title === '测试公共奖学金'
              && item.type === 'government'
              && item.fundingLevel === 'full'
              && item.status === 'published'
              && Array.isArray(item.applicationMaterials)
              && item.applicationMaterials.some((entry) => entry.label === 'Passport' && entry.body.includes('Valid passport'))
              && Array.isArray(item.targetCountries)
              && item.targetCountries.includes('Malaysia')
              && Array.isArray(item.benefitItems)
              && item.benefitItems.some((entry) => entry.label === 'Tuition waiver' && entry.included === true && entry.note.includes('Partial tuition'))
              && Array.isArray(item.eligibilityItems)
              && item.eligibilityItems.some((entry) => entry.label === 'Nationality' && entry.body.includes('Non-Chinese'))
              && Array.isArray(item.applicationSteps)
              && item.applicationSteps.some((entry) => entry.label === 'Submit to school' && entry.body.includes('school instruction'))
              && Array.isArray(item.actionLinks)
              && item.actionLinks.some((entry) => entry.label === 'Official notice' && entry.url.includes('example.edu') && entry.kind === 'source')
              && item.contactInfo?.email === 'scholarship@example.edu'
              && item.contactInfo?.website?.includes('example.edu')
              && Array.isArray(item.benefits)
              && item.benefits.includes('Tuition waiver')
              && Array.isArray(item.schoolIds)
              && item.schoolIds.includes('zju')
              && Array.isArray(item.schools)
              && item.schools.some((school) => school.id === 'zju' && school.nameZh === '浙江大学' && school.status)
              && Array.isArray(item.programIds)
              && item.programIds.includes('zju-cs-msc')
              && item.createdAt
              && item.updatedAt
              && Array.isArray(item.programs)
              && item.programs.some((program) => program.id === 'zju-cs-msc' && program.schoolId === 'zju' && program.nameZh === '计算机科学硕士'));
          const cityOk = state.cityGuideRecords?.some((item) => item.nameZh === '测试城市'
              && item.referenceCscaSchoolCount === 2
              && item.references?.cscaRequiredSchoolCount === 2
              && item.updatedAt
              && Array.isArray(item.nearby)
              && item.nearby.includes('苏州')
              && item.contentJson?.summary === 'JSON summary from CSCAlite'
              && Array.isArray(item.contentJson?.why)
              && item.contentJson.why.includes('JSON migration path')
              && Array.isArray(item.contentJson?.faqs)
              && item.contentJson.faqs.some((faq) => faq.question === 'Can JSON content be saved?' && faq.answer === 'Yes')
              && Array.isArray(item.contentJson?.cityFaqs)
              && item.contentJson.cityFaqs.some((faq) => faq.question === 'Is this city student friendly?' && faq.answer === 'Use program fit and cost together.')
              && Array.isArray(item.contentJson?.costProfiles)
              && item.contentJson.costProfiles.some((profile) => profile.label === 'Low budget' && profile.value === 'RMB 3,000' && profile.note === 'Campus housing, metro access')
              && Array.isArray(item.contentJson?.applicationTips)
              && item.contentJson.applicationTips.includes('Prepare passport, transcript, and translations')
              && Array.isArray(item.contentJson?.quickFacts)
              && item.contentJson.quickFacts.some((fact) => fact.label === 'Monthly cost' && fact.value === 'RMB 3,400' && fact.note === 'Student budget, shared room')
              && item.contentJson?.budgetSummary?.monthly === 'RMB 3,400'
              && item.contentJson?.budgetSummary?.yearly === 'RMB 40,800'
              && item.contentJson?.budgetSummary?.note === 'Confirm dorm prices, utilities, and metro cards'
              && item.status === 'archived');
          const timelineOk = state.timelineWindowRecords?.some((item) => item.title === 'Late application check'
              && item.month === 'Jan'
              && item.applicationWindow.includes('late intake')
              && item.cscaWindow.includes('CSCA requirement')
              && item.status === 'published'
              && item.sortOrder === 9
              && item.updatedAt);
          return {
            ok: Boolean(scholarshipOk && cityOk && timelineOk),
            scholarshipOk: Boolean(scholarshipOk),
            cityOk: Boolean(cityOk),
            timelineOk: Boolean(timelineOk),
            cityRecords: state.cityGuideRecords?.map((item) => ({ nameZh: item.nameZh, slug: item.slug, status: item.status, referenceCscaSchoolCount: item.referenceCscaSchoolCount, cscaRequiredSchoolCount: item.references?.cscaRequiredSchoolCount })) || [],
            timelineRecords: state.timelineWindowRecords?.map((item) => ({ title: item.title, status: item.status, sortOrder: item.sortOrder })) || [],
            scholarshipRecords: state.publicScholarshipRecords?.map((item) => ({ title: item.title, status: item.status, schoolIds: item.schoolIds, programIds: item.programIds })) || [],
          };
        })()
      `);
      if (!contentSaved?.ok) throw new Error(`Ops content data editor did not persist aligned fields: ${JSON.stringify(contentSaved)}`);
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          history.replaceState(null, '', location.pathname + location.search);
          state.contentType = 'scholarships';
          state.opsSection = 'content';
          state.contentSearch = '';
          state.contentStatusFilter = 'all';
          state.selectedPublicScholarshipId = 'legacy-public-scholarship';
          state.publicScholarshipRecords = {
            one: {
              id: 'legacy-public-scholarship',
              title: '旧公共奖学金',
              providerName: '旧提供方',
              fundingLevel: 'partial',
              applicationMaterials: ['护照', { title: '成绩单', body: '英文版' }],
            }
          };
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
        })()
      `);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden && document.body.textContent.includes('旧公共奖学金')", "ops public scholarship legacy object renders");
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新公共奖学金草稿') && document.body.textContent.includes('旧公共奖学金') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-save]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops public scholarship draft survives legacy object state",
      );
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          state.selectedSchoolId = 'legacy-scholarship-school';
          state.schoolEditorTab = 'scholarships';
          state.schoolRecords = [{
            id: 'legacy-scholarship-school',
            nameZh: '旧状态大学',
            nameEn: 'Legacy State University',
            cityZh: '杭州',
            status: '需审核',
            dataQualityScore: 10,
            programs: { one: { id: 'legacy-program', nameZh: '旧项目' } },
            cscaRules: null,
            scholarshipsDetailed: { one: { id: 'legacy-scholarship', name: '旧奖学金', type: 'university' } }
          }];
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
        })()
      `);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]').click()");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-school-editor]')) && document.body.textContent.includes('旧奖学金')", "ops legacy scholarship object renders");
      await installRuntimeErrorTrap(cdp);
      await evaluate(cdp, "document.querySelector('[data-ops-school-add-scholarship]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('旧奖学金') && document.body.textContent.includes('新奖学金草稿') && document.body.textContent.includes('资助与要求') && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops add scholarship works from legacy object state",
      );
      await assertNoRuntimeErrors(cdp, "ops school scholarship create click raised runtime error");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          state.schoolEditorTab = 'scholarships';
          state.schoolRecords = [{
            id: 'mixed-scholarship-school',
            nameZh: '混合状态大学',
            nameEn: 'Mixed State University',
            cityZh: '上海',
            status: '需审核',
            programs: null,
            cscaRules: 'legacy-rule-preview',
            scholarshipsDetailed: [null, 'legacy-label', { id: 'mixed-scholarship', name: '混合旧奖学金', type: 'university' }],
          }];
          state.selectedSchoolId = 'mixed-scholarship-school';
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
        })()
      `);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]').click()");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-school-editor]')) && document.body.textContent.includes('混合旧奖学金')", "ops mixed scholarship state renders");
      await evaluate(cdp, "document.querySelector('[data-ops-school-add-scholarship]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('混合旧奖学金') && document.body.textContent.includes('新奖学金草稿') && document.body.textContent.includes('资助与要求') && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops add scholarship survives mixed array state",
      );
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("ops scholarship create stays rendered with real mouse clicks", async () => {
      await navigate(cdp, "ops-admin.html");
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await navigate(cdp, "ops-admin.html");
      await installRuntimeErrorTrap(cdp);

      await clickSelector(cdp, '.ops-tab-nav [data-ops-tab="content"]');
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]')?.hidden", "ops content panel after mouse click");
      await clickSelector(cdp, '[data-ops-content-tab="scholarships"]');
      await waitFor(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active')", "ops scholarship tab after mouse click");
      await clickSelector(cdp, '[data-ops-content-create]');
      await waitFor(
        cdp,
        "document.body.textContent.includes('新公共奖学金草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-save]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops public scholarship draft after real mouse click",
      );
      await evaluate(cdp, `
        (() => {
          document.querySelector('[data-ops-content-editor][data-content-type="scholarships"]')?.remove();
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          scheduleOpsContentEditorIntegrityCheck('scholarships', state.selectedPublicScholarshipId, '新公共奖学金草稿');
        })()
      `);
      await waitFor(
        cdp,
        "document.body.textContent.includes('新公共奖学金草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-save]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops public scholarship editor recovers after post-click blank editor state",
      );

      await clickSelector(cdp, '.ops-tab-nav [data-ops-tab="school"]');
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"school\"]')?.click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"school\"]')?.hidden && Boolean(document.querySelector('[data-ops-school-view=\"edit\"]')) && Boolean(document.querySelector('[data-ops-school-selected-task]'))", "ops school panel after mouse click");
      await clickSelector(cdp, '[data-ops-school-view="preview"]');
      await waitFor(cdp, "!document.querySelector('[data-ops-school-view-panel=\"preview\"]')?.hidden && Boolean(document.querySelector('[data-ops-school-public-preview]')) && document.body.textContent.trim().length > 1000", "ops school selected task opens preview without blank");
      await clickSelector(cdp, '[data-ops-school-view="edit"]');
      await waitFor(cdp, "!document.querySelector('[data-ops-school-view-panel=\"edit\"]')?.hidden && Boolean(document.querySelector('[data-ops-school-editor]'))", "ops school edit view after mouse click");
      await clickSelector(cdp, '[data-ops-school-tab="scholarships"]');
      await waitFor(cdp, "document.querySelector('[data-ops-school-tab=\"scholarships\"]')?.classList.contains('active')", "ops school scholarships tab after mouse click");
      await clickSelector(cdp, '[data-ops-school-add-scholarship]');
      await waitFor(
        cdp,
        "!document.querySelector('[data-ops-section=\"school\"]')?.hidden && document.querySelector('[data-ops-school-tab=\"scholarships\"]')?.classList.contains('active') && document.body.textContent.includes('新奖学金草稿') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"name\"]')) && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-save]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops school scholarship draft after real mouse click",
      );
      await evaluate(cdp, `
        (() => {
          [...document.querySelectorAll('[data-ops-subrecord][data-kind="scholarships"]')]
            .find((node) => node.textContent.includes('新奖学金草稿'))
            ?.remove();
          scheduleOpsSchoolEditorIntegrityCheck('scholarship', '新奖学金草稿');
        })()
      `);
      await waitFor(
        cdp,
        "document.body.textContent.includes('新奖学金草稿') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"]')) && document.querySelector('[data-completion-toast]')?.textContent.includes('学校奖学金草稿已自动恢复') && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops school scholarship editor recovers after post-click blank subrecord state",
      );
      const recoveredSchoolScholarship = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const school = state.schoolRecords?.find((item) => item.id === state.selectedSchoolId);
          return (school?.scholarshipsDetailed || []).filter((item) => item?.name === '新奖学金草稿').length >= 2;
        })()
      `);
      if (!recoveredSchoolScholarship) throw new Error("Ops school scholarship blank recovery did not persist a replacement draft.");
      await waitFor(
        cdp,
        "!document.querySelector('[data-ops-section=\"school\"]')?.hidden && Boolean(document.querySelector('[data-ops-open-public-scholarships]'))",
        "ops school scholarship library shortcut after recovery",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-open-public-scholarships]')?.click()");
      await waitFor(
        cdp,
        "!document.querySelector('[data-ops-section=\"content\"]')?.hidden && document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active') && document.body.textContent.includes('公共奖学金') && Boolean(document.querySelector('[data-ops-content-create]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops school scholarship opens public scholarship library",
      );
      await evaluate(cdp, `
        (() => {
          document.querySelector('[data-ops-section="content"]').hidden = true;
          document.querySelector('[data-ops-section="content"]').classList.remove('active');
          ensureOpsPageNotBlank('forced hidden content section after scholarship click');
        })()
      `);
      await waitFor(
        cdp,
        "!document.querySelector('[data-ops-section=\"content\"]')?.hidden && document.querySelector('[data-ops-section=\"content\"]')?.classList.contains('active') && document.body.textContent.includes('公共奖学金') && Boolean(document.querySelector('[data-ops-content-create]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops scholarship blank guard restores hidden content panel",
      );
      await assertNoRuntimeErrors(cdp, "real mouse scholarship create raised runtime error");
    });

    await runStep("ops public scholarship create works from the normal click path", async () => {
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await navigate(cdp, "ops-admin.html?motion=off");
      await installRuntimeErrorTrap(cdp);
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden && Boolean(document.querySelector('[data-ops-content-tab=\"scholarships\"]'))", "ops content tab visible");
      await evaluate(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active')", "ops public scholarship tab active");
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify({ ...state, contentType: 'cities' }));
        })()
      `);
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新公共奖学金草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-scholarship-public-preview]')) && Boolean(document.querySelector('[data-ops-content-field=\"title\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"schoolIds\"]')) && Boolean(document.querySelector('[data-ops-scholarship-school-picker]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops public scholarship normal create path stays rendered",
      );
      for (const [label, expected] of [["展示内容", "AdminScholarship.requirementText"], ["适用范围", "AdminScholarship.schoolIds"], ["关联选择", "关联学校"]]) {
        await evaluate(cdp, `
          (() => {
            const editor = document.querySelector('[data-ops-content-editor]');
            const button = [...editor.querySelectorAll('[data-ops-content-editor-tab]')].find((item) => item.textContent.includes(${JSON.stringify(label)}));
            if (!button) throw new Error('Missing content editor group ${label}');
            button.click();
          })()
        `);
        await waitFor(
          cdp,
          `(() => {
            const editor = document.querySelector('[data-ops-content-editor]');
            const button = [...editor.querySelectorAll('[data-ops-content-editor-tab]')].find((item) => item.textContent.includes(${JSON.stringify(label)}));
            const visiblePanel = [...editor.querySelectorAll('[data-ops-content-editor-panel]')].find((panel) => !panel.hidden);
            const expected = ${JSON.stringify(expected)};
            const mappedField = visiblePanel?.querySelector?.('[data-source-field="' + expected + '"]');
            const contentFieldKey = expected.startsWith('AdminScholarship.') ? expected.split('.')[1] : '';
            const editableField = contentFieldKey ? visiblePanel?.querySelector?.('[data-ops-content-field="' + contentFieldKey + '"]') : null;
            const expectedVisible = visiblePanel?.textContent.includes(expected);
            const expectedPresent = expected.startsWith('AdminScholarship.')
              ? Boolean(mappedField || editableField)
              : Boolean(expectedVisible);
            return Boolean(button?.classList.contains('active')
              && button?.getAttribute('aria-selected') === 'true'
              && expectedPresent
              && !document.querySelector('.ops-error-state')
              && document.body.textContent.trim().length > 1000);
          })()`,
          `ops public scholarship ${label} editor group stays rendered`,
        );
      }
      await assertNoRuntimeErrors(cdp, "normal ops public scholarship create click raised runtime error");
    });

    await runStep("ops city and timeline create work from real mouse clicks", async () => {
      await navigate(cdp, "ops-admin.html");
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await navigate(cdp, "ops-admin.html");
      await installRuntimeErrorTrap(cdp);

      await clickSelector(cdp, '[data-ops-tab="content"]');
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]')?.hidden", "ops content panel for city/timeline click");

      await clickSelector(cdp, '[data-ops-content-tab="cities"]');
      await waitFor(cdp, "document.querySelector('[data-ops-content-tab=\"cities\"]')?.classList.contains('active')", "ops city tab after mouse click");
      await clickSelector(cdp, '[data-ops-content-create]');
      await waitFor(
        cdp,
        "document.body.textContent.includes('新城市草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"cities\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"nameZh\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"contentJsonText\"]')) && Boolean(document.querySelector('[data-source-field=\"CityGuideAggregate.visibleSchools\"]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops city draft after real mouse click",
      );
      await evaluate(cdp, `
        (() => {
          const editor = document.querySelector('[data-ops-content-editor][data-content-type="cities"]');
          const button = [...editor.querySelectorAll('[data-ops-content-editor-tab]')].find((item) => item.textContent.includes('参考与聚合'));
          if (!button) throw new Error('Missing city aggregate editor group');
          button.click();
        })()
      `);
      await waitFor(
        cdp,
        "(() => { const editor = document.querySelector('[data-ops-content-editor][data-content-type=\"cities\"]'); if (!editor) return false; const visiblePanel = [...editor.querySelectorAll('[data-ops-content-editor-panel]')].find((panel) => !panel.hidden); return document.querySelector('[data-ops-content-editor-tab].active')?.textContent.includes('参考与聚合') && Boolean(visiblePanel?.querySelector('[data-source-field=\"CityGuideAggregate.visibleSchools\"]')) && Boolean(visiblePanel?.querySelector('.ops-aggregate-sources')) && !document.querySelector('.ops-error-state'); })()",
        "ops city aggregate editor group stays rendered",
      );

      await clickSelector(cdp, '[data-ops-content-tab="timeline"]');
      await evaluate(cdp, "document.querySelector('[data-ops-content-tab=\"timeline\"]')?.click()");
      await waitFor(cdp, "document.querySelector('[data-ops-content-tab=\"timeline\"]')?.classList.contains('active')", "ops timeline tab after mouse click");
      await waitFor(cdp, "document.querySelector('[data-ops-content-create]')?.dataset.contentType === 'timeline'", "ops timeline create button ready");
      await clickSelector(cdp, '[data-ops-content-create]');
      await evaluate(cdp, `
        (() => {
          const create = document.querySelector('[data-ops-content-create]');
          if (!document.body.textContent.includes('新申请时间窗草稿') && create?.dataset.contentType === 'timeline') {
            document.querySelector('[data-ops-content-create]')?.click();
          }
        })()
      `);
      await waitFor(
        cdp,
        "document.body.textContent.includes('新申请时间窗草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"timeline\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"month\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"applicationWindow\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"cscaWindow\"]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops timeline draft after real mouse click",
      );
      await waitFor(
        cdp,
        "(() => { const editor = document.querySelector('[data-ops-content-editor][data-content-type=\"timeline\"]'); return Boolean(editor && [...editor.querySelectorAll('[data-ops-content-editor-tab]')].some((item) => item.textContent.includes('窗口内容'))); })()",
        "ops timeline content editor group is ready",
      );
      await evaluate(cdp, `
        (() => {
          const editor = document.querySelector('[data-ops-content-editor][data-content-type="timeline"]');
          const button = editor ? [...editor.querySelectorAll('[data-ops-content-editor-tab]')].find((item) => item.textContent.includes('窗口内容')) : null;
          if (!button) throw new Error('Missing timeline content editor group');
          button.click();
        })()
      `);
      await waitFor(
        cdp,
        "(() => { const editor = document.querySelector('[data-ops-content-editor][data-content-type=\"timeline\"]'); if (!editor) return false; const activeTab = editor.querySelector('[data-ops-content-editor-tab].active'); const visiblePanel = [...editor.querySelectorAll('[data-ops-content-editor-panel]')].find((panel) => !panel.hidden); return activeTab?.textContent.includes('窗口内容') && Boolean(visiblePanel?.querySelector('[data-ops-content-field=\"applicationWindow\"]')) && !document.querySelector('.ops-error-state'); })()",
        "ops timeline content editor group stays rendered",
      );
      await assertNoRuntimeErrors(cdp, "real mouse city/timeline create raised runtime error");
    });

    await runStep("ops scholarship create does not depend on CSS.escape", async () => {
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await navigate(cdp, "ops-admin.html?motion=off");
      await installRuntimeErrorTrap(cdp);
      await evaluate(cdp, `
        (() => {
          window.__originalCssEscapeForCuacQa = window.CSS?.escape;
          if (!window.CSS) window.CSS = {};
          try {
            Object.defineProperty(window.CSS, 'escape', { value: undefined, configurable: true, writable: true });
          } catch {
            window.CSS.escape = undefined;
          }
        })()
      `);
      await clickSelector(cdp, '[data-ops-tab="content"]');
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]')?.hidden", "ops content tab without CSS.escape");
      await clickSelector(cdp, '[data-ops-content-tab="scholarships"]');
      await clickSelector(cdp, '[data-ops-content-create]');
      await waitFor(
        cdp,
        "!document.querySelector('[data-ops-section=\"content\"]')?.hidden && document.body.textContent.includes('新公共奖学金草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && !document.querySelector('.ops-error-state')",
        "ops public scholarship create without CSS.escape",
      );
      await clickSelector(cdp, '[data-ops-tab="school"]');
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"school\"]')?.hidden && Boolean(document.querySelector('[data-ops-school-view=\"edit\"]'))", "ops school tab without CSS.escape");
      await clickSelector(cdp, '[data-ops-school-view="edit"]');
      await waitFor(cdp, "!document.querySelector('[data-ops-school-view-panel=\"edit\"]')?.hidden && Boolean(document.querySelector('[data-ops-school-editor]'))", "ops school edit view without CSS.escape");
      await clickSelector(cdp, '[data-ops-school-tab="scholarships"]');
      await clickSelector(cdp, '[data-ops-school-add-scholarship]');
      await waitFor(
        cdp,
        "!document.querySelector('[data-ops-section=\"school\"]')?.hidden && document.querySelector('[data-ops-school-tab=\"scholarships\"]')?.classList.contains('active') && document.body.textContent.includes('新奖学金草稿') && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-field=\"name\"]')) && Boolean(document.querySelector('[data-ops-subrecord][data-kind=\"scholarships\"] [data-ops-subrecord-save]')) && !document.querySelector('.ops-error-state')",
        "ops school scholarship create without CSS.escape",
      );
      await assertNoRuntimeErrors(cdp, "ops scholarship create used CSS.escape and blanked the page");
    });

    await runStep("ops public scholarship create survives legacy local state", async () => {
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await evaluate(cdp, `localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify({ contentType: 'scholarship', opsSection: 'content', publicScholarshipRecords: [] }))`);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden && document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active')", "ops content normalizes singular scholarship state");
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新公共奖学金草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"title\"]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops public scholarship create survives singular content type",
      );
      await assertNoRuntimeErrors(cdp, "singular ops public scholarship create click raised runtime error");

      await evaluate(cdp, `
        (() => {
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify({
            contentType: 'scholarships',
            selectedPublicScholarshipId: 'legacy-public-scholarship',
            publicScholarshipRecords: {
              legacy: {
                id: 'legacy-public-scholarship',
                title: '旧奖学金状态',
                providerName: '旧来源',
                fundingLevel: 'partial',
                bodySections: [{ title: '说明', body: '旧版本对象结构' }],
                actionLinks: [{ label: '通知', href: 'https://example.com' }]
              },
              empty: null,
              text: 'legacy label only'
            }
          }));
        })()
      `);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden && document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active')", "ops content opens legacy scholarships");
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新公共奖学金草稿') && document.body.textContent.includes('旧奖学金状态') && document.body.textContent.includes('基础信息') && document.body.textContent.includes('展示内容') && document.body.textContent.includes('适用范围') && document.body.textContent.includes('来源与联系') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"applicationMaterials\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"schoolIds\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"programIds\"]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops public scholarship create remains visible",
      );
      const draftVisible = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          return state.contentType === 'scholarships'
            && Array.isArray(state.publicScholarshipRecords)
            && state.publicScholarshipRecords.some((item) => item.title === '新公共奖学金草稿')
            && state.selectedPublicScholarshipId
            && document.querySelector('[data-ops-content-editor]')?.dataset.contentType === 'scholarships';
        })()
      `);
      if (!draftVisible) throw new Error("Ops public scholarship create did not preserve a rendered editable draft.");

      await evaluate(cdp, `
        (() => {
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify({
            contentType: 'scholarships',
            selectedPublicScholarshipId: 'broken-scholarship',
            publicScholarshipRecords: [null, 'legacy label only', 42]
          }));
        })()
      `);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden && document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active')", "ops content opens broken scholarship state");
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新公共奖学金草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-save]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops public scholarship create survives broken array state",
      );
      await evaluate(cdp, "localStorage.setItem('cuacOpsAdminDemoState', 'null')");
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden", "ops content opens after null local state");
      await evaluate(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active')", "ops scholarship tab after null local state");
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新公共奖学金草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"schoolIds\"]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops public scholarship create survives null local state",
      );
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden", "ops content opens before mismatched active tab");
      await evaluate(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-ops-content-create]')?.dataset.contentType === 'scholarships'", "ops scholarship create button carries explicit content type");
      await evaluate(cdp, `
        (() => {
          document.querySelectorAll('[data-ops-content-tab]').forEach((tab) => tab.classList.remove('active'));
          document.querySelector('[data-ops-content-tab="cities"]')?.classList.add('active');
        })()
      `);
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新公共奖学金草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"schoolIds\"]')) && !document.body.textContent.includes('新城市草稿') && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops public scholarship create trusts button type over stale active tab",
      );
    });

    await runStep("ops city and timeline create survive legacy local state", async () => {
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await evaluate(cdp, `
        localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify({
          opsSection: 'content',
          contentType: 'cities',
          selectedCityGuideId: 'legacy-city-record',
          cityGuideRecords: {
            legacy: {
              id: 'legacy-city-record',
              slug: 'legacy-city',
              nameZh: '旧城市状态',
              nameEn: 'Legacy City',
              contentJson: {
                summary: '旧城市 JSON',
                quickFacts: [{ label: 'Monthly cost', value: 'RMB 3,200', note: 'legacy shape' }]
              },
              referenceProgramCount: 2,
              status: 'draft'
            },
            empty: null,
            text: 'legacy label only'
          }
        }));
      `);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden && document.querySelector('[data-ops-content-tab=\"cities\"]')?.classList.contains('active') && document.body.textContent.includes('旧城市状态')", "ops legacy city object renders");
      await installRuntimeErrorTrap(cdp);
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新城市草稿') && document.body.textContent.includes('旧城市状态') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"cities\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"nameZh\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"contentJsonText\"]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops city create survives legacy object state",
      );
      const cityRecovered = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          return state.contentType === 'cities'
            && Array.isArray(state.cityGuideRecords)
            && state.cityGuideRecords.some((item) => item.nameZh === '新城市草稿')
            && state.cityGuideRecords.some((item) => item.nameZh === '旧城市状态')
            && state.selectedCityGuideId
            && document.querySelector('[data-ops-content-editor]')?.dataset.contentType === 'cities';
        })()
      `);
      if (!cityRecovered) throw new Error("Ops city create did not preserve a rendered editable draft from legacy state.");
      const cityEditorTabsOk = await evaluate(cdp, `
        (() => {
          const editor = document.querySelector('[data-ops-content-editor][data-content-type="cities"]');
          if (!editor) return [{ key: 'missing-editor', active: false, enoughContent: false, hasEditableField: false, hasBlankRecovery: true }];
          return [...editor.querySelectorAll('[data-ops-content-editor-tab]')].map((tab) => {
            tab.click();
            const panelKey = tab.dataset.opsContentEditorTab || '';
            const panel = editor.querySelector(\`[data-ops-content-editor-panel="\${panelKey}"]\`);
            const text = panel?.textContent?.trim() || '';
            return {
              key: tab.textContent?.trim() || panelKey,
              active: tab.classList.contains('active') && Boolean(panel && !panel.hidden),
              enoughContent: text.length > 8,
              hasEditableField: Boolean(panel?.querySelector('[data-ops-content-field]')),
              hasBlankRecovery: Boolean(document.querySelector('.ops-error-state')),
            };
          });
        })()
      `);
      const failedCityEditorTabs = cityEditorTabsOk.filter((item) => !item.active || !item.enoughContent || !item.hasEditableField || item.hasBlankRecovery);
      if (failedCityEditorTabs.length) throw new Error(`Ops city editor tabs produced blank panels: ${JSON.stringify(failedCityEditorTabs)}`);

      await evaluate(cdp, `
        localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify({
          opsSection: 'content',
          contentType: 'timeline',
          selectedTimelineWindowId: 'legacy-timeline-record',
          timelineWindowRecords: {
            legacy: {
              id: 'legacy-timeline-record',
              month: 'Apr',
              title: '旧时间窗状态',
              applicationWindow: '旧申请窗口',
              cscaWindow: '旧 CSCA 窗口',
              status: 'draft'
            },
            empty: null,
            text: 'legacy label only'
          }
        }));
      `);
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-ops-section=\"content\"]').hidden && document.querySelector('[data-ops-content-tab=\"timeline\"]')?.classList.contains('active') && document.body.textContent.includes('旧时间窗状态')", "ops legacy timeline object renders");
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "document.body.textContent.includes('新申请时间窗草稿') && document.body.textContent.includes('旧时间窗状态') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"timeline\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"month\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"applicationWindow\"]')) && Boolean(document.querySelector('[data-ops-content-field=\"cscaWindow\"]')) && !document.querySelector('.ops-error-state') && document.body.textContent.trim().length > 1000",
        "ops timeline create survives legacy object state",
      );
      const timelineRecovered = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          return state.contentType === 'timeline'
            && Array.isArray(state.timelineWindowRecords)
            && state.timelineWindowRecords.some((item) => item.title === '新申请时间窗草稿')
            && state.timelineWindowRecords.some((item) => item.title === '旧时间窗状态')
            && state.selectedTimelineWindowId
            && document.querySelector('[data-ops-content-editor]')?.dataset.contentType === 'timeline';
        })()
      `);
      if (!timelineRecovered) throw new Error("Ops timeline create did not preserve a rendered editable draft from legacy state.");
      const timelineEditorTabsOk = await evaluate(cdp, `
        (() => {
          const editor = document.querySelector('[data-ops-content-editor][data-content-type="timeline"]');
          if (!editor) return [{ key: 'missing-editor', active: false, enoughContent: false, hasEditableField: false, hasBlankRecovery: true }];
          return [...editor.querySelectorAll('[data-ops-content-editor-tab]')].map((tab) => {
            tab.click();
            const panelKey = tab.dataset.opsContentEditorTab || '';
            const panel = editor.querySelector(\`[data-ops-content-editor-panel="\${panelKey}"]\`);
            const text = panel?.textContent?.trim() || '';
            return {
              key: tab.textContent?.trim() || panelKey,
              active: tab.classList.contains('active') && Boolean(panel && !panel.hidden),
              enoughContent: text.length > 8,
              hasEditableField: Boolean(panel?.querySelector('[data-ops-content-field]')),
              hasBlankRecovery: Boolean(document.querySelector('.ops-error-state')),
            };
          });
        })()
      `);
      const failedTimelineEditorTabs = timelineEditorTabsOk.filter((item) => !item.active || !item.enoughContent || !item.hasEditableField || item.hasBlankRecovery);
      if (failedTimelineEditorTabs.length) throw new Error(`Ops timeline editor tabs produced blank panels: ${JSON.stringify(failedTimelineEditorTabs)}`);
      await assertNoRuntimeErrors(cdp, "legacy city/timeline create raised runtime error");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("ops public scholarship create survives catalog failure without blank state", async () => {
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await navigate(cdp, "ops-admin.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-ops-tab=\"content\"]'))", "ops tabs before forced scholarship crash");
      await evaluate(cdp, `
        (() => {
          window.CuacDataClient.getDiscoveryScholarships = () => {
            throw new Error('forced scholarship catalog failure');
          };
          renderOpsPage();
        })()
      `);
      await evaluate(cdp, "document.querySelector('[data-ops-tab=\"content\"]').click()");
      await waitFor(
        cdp,
        "!document.querySelector('[data-ops-section=\"content\"]').hidden && document.body.textContent.includes('城市、公共奖学金与申请时间窗管理') && !document.querySelector('.ops-error-state')",
        "ops content panel remains visible after scholarship catalog failure",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-content-tab=\"scholarships\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-ops-content-tab=\"scholarships\"]')?.classList.contains('active') && document.body.textContent.includes('暂无内容记录') && !document.querySelector('.ops-error-state')",
        "ops scholarship panel shows empty editable state after catalog failure",
      );
      await evaluate(cdp, "document.querySelector('[data-ops-content-create]').click()");
      await waitFor(
        cdp,
        "!document.querySelector('.ops-error-state') && !document.querySelector('[data-ops-section=\"content\"]').hidden && document.body.textContent.includes('新公共奖学金草稿') && Boolean(document.querySelector('[data-ops-content-editor][data-content-type=\"scholarships\"]')) && Boolean(document.querySelector('[data-ops-content-save]')) && document.body.textContent.trim().length > 1000",
        "ops scholarship draft after catalog failure",
      );
      const recoveredState = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          return state.contentType === 'scholarships'
            && state.selectedPublicScholarshipId
            && Array.isArray(state.publicScholarshipRecords)
            && state.publicScholarshipRecords.some((item) => item.title === '新公共奖学金草稿');
        })()
      `);
      if (!recoveredState) throw new Error("Ops scholarship recovery did not persist a draft state.");
    });
  });

  await withBrowser(async (cdp) => {
      await runStep("high-risk Ops Agent action requires confirmation and writes audit state", async () => {
      await navigate(cdp, "ops-admin.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInCuacOps(cdp);
      await navigate(cdp, "ops-admin.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-cuac-agent-form]'))", "Ops Agent form");
      await evaluate(cdp, `
        (() => {
          const input = document.querySelector('[data-cuac-agent-input]');
          const form = document.querySelector('[data-cuac-agent-form]');
          input.value = 'Review denied Agent export requests';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          form.requestSubmit();
          return true;
        })()
      `);
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-action=\"ops-review-agent-audit\"]'))", "Ops Agent audit action", 10000);
      await evaluate(cdp, "document.querySelector('[data-agent-action=\"ops-review-agent-audit\"]').click()");
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-confirmation]'))", "Ops Agent confirmation card");
      const notAppliedYet = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          return !String(state.lastAction || '').includes('Agent 策略拒绝');
        })()
      `);
      if (!notAppliedYet) throw new Error("High-risk Ops Agent action applied before confirmation.");
      await evaluate(cdp, "document.querySelector('[data-agent-confirmation] [data-agent-confirmed=\"true\"]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-ops-last-action]')?.textContent.includes('已打开 Agent 策略拒绝记录')",
        "Ops Agent audit UI",
      );
      const audited = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          return state.lastAction?.includes('已打开 Agent 策略拒绝记录') && Array.isArray(state.auditItems);
        })()
      `);
      if (!audited) throw new Error("Confirmed Ops Agent audit action did not persist local audit state.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("completion detail exposes loading empty and error states", async () => {
      await navigate(cdp, "program-detail.html?state=loading&motion=off");
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-state=\"loading\"]')?.textContent.includes('Loading route detail')",
        "completion loading state",
      );

      await navigate(cdp, "program-detail.html?state=empty&motion=off");
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-state=\"empty\"]')?.textContent.includes('No matching CUAC detail record')",
        "completion empty state",
      );

      await navigate(cdp, "program-detail.html?state=error&motion=off");
      await waitFor(
        cdp,
        "document.querySelector('[data-completion-state=\"error\"]')?.textContent.includes('Could not load this CUAC detail')",
        "completion error state",
      );
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("completion detail resolves non-default catalog records", async () => {
      const detailChecks = [
        ["program-detail.html?program=fudan-econ-ba&motion=off", "Economics BA", "Program", "SchoolProgram"],
        ["program-detail.html?program=zju-cs-msc&motion=off", "Computer Science MSc", "Program", "SchoolProgram"],
        ["university-detail.html?university=tsinghua-university&motion=off", "Tsinghua University", "School", "School"],
        ["university-detail.html?university=zhejiang-university&motion=off", "Zhejiang University", "School", "School"],
        ["scholarship-detail.html?scholarship=3&motion=off", "Shanghai Government Scholarship", "PublicScholarship", "Scholarship"],
        ["city-detail.html?city=shanghai&motion=off", "Shanghai", "City", "CityGuide"],
      ];
      for (const [file, title, entityType, sourceModel] of detailChecks) {
        await navigate(cdp, file);
        await waitFor(
          cdp,
          `document.querySelector('.program-detail-hero h1')?.textContent.trim() === ${JSON.stringify(title)} || document.querySelector('.university-detail-hero h1')?.textContent.trim() === ${JSON.stringify(title)} || document.querySelector('.funding-detail-hero h1')?.textContent.trim() === ${JSON.stringify(title)} || document.querySelector('.detail-hero h1')?.textContent.trim() === ${JSON.stringify(title)} || document.querySelector('.city-detail-hero h1')?.textContent.trim() === ${JSON.stringify(`Study in ${title}`)}`,
          `${title} dynamic detail`,
        );
        const notFallback = await evaluate(cdp, `!document.body.textContent.includes('Selected profile from the CUAC demo')`);
        if (!notFallback) throw new Error(`${title} used fallback detail copy instead of catalog-backed detail.`);
        const sourceContext = await evaluate(cdp, `
          (() => {
            const root = document.querySelector('[data-detail-root]');
            return root?.dataset.detailEntityType === ${JSON.stringify(entityType)}
              && root?.dataset.detailSourceModel === ${JSON.stringify(sourceModel)}
              && Boolean(root?.dataset.detailEntityId);
          })()
        `);
        if (!sourceContext) throw new Error(`${title} did not expose structured detail source context.`);
        const noRawModelFields = await evaluate(cdp, `
          (() => {
            const text = document.body.textContent || "";
            const rawFieldPattern = /\\b(?:School|SchoolProgram|SchoolScholarship|Scholarship|PublicScholarship|CityGuide|CityGuideAggregate)\\.[A-Za-z_][A-Za-z0-9_]*/;
            return !rawFieldPattern.test(text);
          })()
        `);
        if (!noRawModelFields) throw new Error(`${title} exposed raw CSCAlite field paths in student-visible detail copy.`);
        if (title === "Economics BA") {
          const exposesProgramFields = await evaluate(cdp, `
            (() => {
              const text = document.body.textContent || "";
              const root = document.querySelector('[data-detail-root]');
              return text.includes("Program information")
                && text.includes("Course basics")
                && text.includes("Confirm the exact route")
                && text.includes("Selected route")
                && text.includes("复旦大学")
                && text.includes("经济学本科")
                && Boolean(document.querySelector(".program-name-alias"))
                && text.includes("Academic fit")
                && text.includes("Cost planning")
                && text.includes("Admissions requirements")
                && text.includes("Tuition and timing")
                && text.includes("CUAC application handoff")
                && text.includes("What happens after you add it")
                && text.includes("Language readiness")
                && text.includes("School follow-up")
                && text.includes("Funding route")
                && text.includes("Application entry")
                && text.includes("Add exact choice")
                && text.includes("Official program check")
                && Boolean(document.querySelector('.program-side-action-grid a[href="application.html#add-choice"]'))
                && Boolean(document.querySelector('.program-side-action-grid a[href*="university-detail.html"]'))
                && Boolean(document.querySelector('.program-side-action-grid a[href]'))
                && !text.includes("Program identity")
                && !text.includes("Route display")
                && !text.includes("How this program is shown to students")
                && !text.includes("Displayed tuition")
                && !text.includes("Source confidence")
                && !text.includes("Information status")
                && !text.includes("Scholarship and source")
                && !text.includes("What matters before choosing")
                && !text.includes("Chinese school name")
                && !text.includes("SchoolProgram.nameZh")
                && !text.includes("SchoolProgram.nameEn")
                && !text.includes("SchoolProgram.applicationUrl")
                && Number(root?.dataset.detailSourceFieldCount || 0) > 0;
            })()
          `);
          if (!exposesProgramFields) throw new Error("Program detail did not render user-facing SchoolProgram information with hidden source fields.");
          const checklistProgressUpdates = await evaluate(cdp, `
            (() => {
              const progress = document.querySelector('[data-check-progress]');
              const checks = Array.from(document.querySelectorAll('[data-check-item]'));
              if (!progress || checks.length < 2 || progress.textContent.trim() !== '1/4 ready') return false;
              checks[1].checked = true;
              checks[1].dispatchEvent(new Event('change', { bubbles: true }));
              return progress.textContent.trim() === '2/4 ready' && progress.dataset.progressState === 'active';
            })()
          `);
          if (!checklistProgressUpdates) throw new Error("Completion detail checklist progress did not update after checking an item.");
          await evaluate(cdp, `
            (() => {
              const input = document.querySelector('[data-cuac-agent-input]');
              const form = document.querySelector('[data-cuac-agent-form]');
              if (!input || !form) return false;
              input.value = 'Summarize Economics BA and tell me the next CUAC action';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              return true;
            })()
          `);
          await waitFor(
            cdp,
            "document.querySelector('[data-cuac-agent-results]')?.dataset.agentEntityType === 'Program' && document.querySelector('[data-cuac-agent-results]')?.dataset.agentSourceModel === 'SchoolProgram'",
            "detail Agent structured source context",
          );
        }
        if (title === "Computer Science MSc") {
          const exposesProgramBadge = await evaluate(cdp, `
            (() => {
              const text = document.body.textContent || "";
              return Boolean(document.querySelector(".program-route-badge"))
                && text.includes("CSC possible")
                && !text.includes("SchoolProgram.badgeText");
            })()
          `);
          if (!exposesProgramBadge) throw new Error("Program detail did not render SchoolProgram.badgeText as a student-facing route badge.");
        }
        if (title === "Tsinghua University") {
          const exposesSchoolFields = await evaluate(cdp, `
            (() => {
              const text = document.body.textContent || "";
              const root = document.querySelector('[data-detail-root]');
              return text.includes("University information")
                && text.includes("Can I apply?")
                && text.includes("Cost range")
                && text.includes("Decision snapshot")
                && text.includes("Identity and school")
                && text.includes("Degree fit")
                && text.includes("Language and CSCA")
                && text.includes("Costs and funding")
                && text.includes("Dates and official entry")
                && text.includes("Official checks")
                && text.includes("Links and application fee")
                && text.includes("Application fee")
                && text.includes("Admissions entry")
                && text.includes("Application timing")
                && text.includes("Recent deadlines and school steps")
                && text.includes("School application timeline")
                && text.includes("Closest program deadlines")
                && text.includes("CSCA and funding checks from this school")
                && text.includes("CSCA rules students should notice")
                && text.includes("School funding routes to verify")
                && text.includes("Programs at this school")
                && text.includes("Scholarship routes at this school")
                && text.includes("Engineering")
                && text.includes("Teaching")
                && text.includes("CSCA")
                && text.includes("Language proof")
                && text.includes("Tuition")
                && text.includes("Deadline")
                && text.includes("Coverage")
                && text.includes("Requirement")
                && text.includes("View program")
                && text.includes("View funding")
                && Boolean(document.querySelector(".university-csca-card"))
                && Boolean(document.querySelector(".university-school-checks"))
                && Boolean(document.querySelector(".university-official-card"))
                && Boolean(document.querySelector(".university-application-plan"))
                && Boolean(document.querySelector(".university-deadline-list article"))
                && Boolean(document.querySelector(".university-program-row"))
                && Boolean(document.querySelector(".university-scholarship-row"))
                && !text.includes("Source and freshness")
                && !text.includes("Data quality")
                && !text.includes("What matters before choosing")
                && !text.includes("School.applicationSystemUrl")
                && !text.includes("School.hskRequirement")
                && !text.includes("SchoolProgram")
                && !text.includes("SchoolScholarship")
                && Number(root?.dataset.detailSourceFieldCount || 0) > 0;
            })()
          `);
          if (!exposesSchoolFields) throw new Error("University detail did not render user-facing School information with hidden source fields.");
        }
        if (title === "Zhejiang University") {
          const exposesOfficialActions = await evaluate(cdp, `
            (() => {
              const text = document.body.textContent || "";
              const links = [...document.querySelectorAll(".university-official-card a")];
              const sideLinks = [...document.querySelectorAll(".university-side-action-grid a")];
              return text.includes("Official checks")
                && text.includes("计算机科学硕士")
                && text.includes("Links and application fee")
                && text.includes("Application fee")
                && text.includes("Find exact programs")
                && text.includes("Admissions entry")
                && text.includes("City context")
                && links.some((link) => link.textContent.includes("Official website") && link.href.startsWith("https://www.zju.edu.cn/"))
                && links.some((link) => link.textContent.includes("Admissions entry") && link.href.startsWith("https://isinfosys.zju.edu.cn"))
                && sideLinks.some((link) => link.textContent.includes("Find exact programs") && link.href.includes("programs.html"))
                && sideLinks.some((link) => link.textContent.includes("Admissions entry") && link.href.startsWith("https://isinfosys.zju.edu.cn"))
                && sideLinks.some((link) => link.textContent.includes("City context") && link.href.includes("city-detail.html?city=hangzhou"))
                && Boolean(document.querySelector(".university-program-title-zh"))
                && !text.includes("School.officialWebsite")
                && !text.includes("SchoolProgram.nameZh")
                && !text.includes("School.applicationSystemUrl");
            })()
          `);
          if (!exposesOfficialActions) throw new Error("University detail did not render CSCAlite official website/admissions entry as student-facing links.");
          const programFiltersWork = await evaluate(cdp, `
            (() => {
              const text = document.body.textContent || "";
              const degree = document.querySelector('[data-university-program-filter="degree"]');
              const teaching = document.querySelector('[data-university-program-filter="teaching"]');
              const subject = document.querySelector('[data-university-program-filter="subject"]');
              const rows = [...document.querySelectorAll('[data-university-program-row]')];
              const count = document.querySelector('[data-university-program-count]');
              if (!degree || !teaching || !subject || rows.length < 2 || !count) return false;
              if (!text.includes("Program details") || !text.includes("Language requirement") || !text.includes("Application note") || !text.includes("Scholarship route")) return false;
              degree.value = "Master";
              degree.dispatchEvent(new Event("change", { bubbles: true }));
              const visibleAfterDegree = rows.filter((row) => !row.hidden).length;
              const expectedMasterRows = rows.filter((row) => row.dataset.degree === "Master").length;
              const firstDetails = document.querySelector(".university-program-details");
              firstDetails.open = true;
              const linkOk = [...document.querySelectorAll(".university-program-source-links a")].some((link) => link.href.startsWith("https://isinfosys.zju.edu.cn"));
              return visibleAfterDegree === expectedMasterRows
                && count.textContent.trim() === expectedMasterRows + " shown"
                && linkOk
                && !text.includes("Scholarship and source")
                && !text.includes("SchoolProgram.applicationUrl")
                && !text.includes("SchoolProgram.sourceUrl");
            })()
          `);
          if (!programFiltersWork) throw new Error("University detail program filters/details did not match the CSCAlite school program interaction.");
        }
        if (title === "Shanghai Government Scholarship") {
          const exposesScholarshipFields = await evaluate(cdp, `
            (() => {
              const text = document.body.textContent || "";
              const root = document.querySelector('[data-detail-root]');
              const checks = {
                scholarshipInformation: text.includes("Scholarship information"),
                fundingLevel: text.includes("Funding level"),
                fundingBenefits: text.includes("Funding benefits"),
                eligibility: text.includes("Eligibility"),
                scopeSummary: text.includes("Scope summary") && text.includes("Check fit before preparing documents"),
                scopeCards: document.querySelectorAll(".scholarship-scope-facts article").length >= 6,
                scopeNav: Boolean(document.querySelector('.detail-section-nav a[href="#scholarship-scope"]')),
                materialsAndSteps: text.includes("Materials and steps"),
                scholarshipOverview: text.includes("Scholarship overview"),
                noticeGuideCopy: text.includes("Read the route in plain language"),
                preparationCopy: text.includes("What to confirm with the school"),
                applicableSchools: text.includes("Applicable schools"),
                programRoutes: text.includes("Program routes"),
                viewSchool: text.includes("View school"),
                viewProgram: text.includes("View program"),
                schoolNames: text.includes("Fudan University") || text.includes("Tongji University"),
                useWithPrograms: text.includes("Use it with programs"),
                helpAndNextSteps: text.includes("Help and next steps"),
                contactCopy: text.includes("Who to contact if this route fits"),
                email: text.includes("scholarship@example.edu"),
                officialNoticeAction: text.includes("Open official notice"),
                comparePrograms: text.includes("Compare Shanghai programs"),
                benefitState: Boolean(document.querySelector(".funding-benefit-state")) && text.includes("Included"),
                applyPanel: text.includes("Apply and verify") && text.includes("Use the current notice") && text.includes("Apply window") && text.includes("Scope") && text.includes("Planning link"),
                applyButtons: Boolean(document.querySelector(".scholarship-apply-panel .primary-action")) && Boolean(document.querySelector("[data-share-scholarship]")),
                contactCard: Boolean(document.querySelector(".scholarship-contact-card")),
                mailto: Boolean(document.querySelector('.scholarship-contact-list a[href^="mailto:"]')),
                programsLink: Boolean(document.querySelector('.scholarship-link-list a[href*="programs.html"]')),
                noOfficialNoticeState: !text.includes("Official notice state"),
                noLastChecked: !text.includes("Last checked"),
                noOfficialSourceCopy: !text.includes("Official source and contact") && !text.includes("Where to verify before preparing") && !text.includes("Contact and links"),
                noOldCopy: !text.includes("What matters before choosing"),
                noRequirementText: !text.includes("Scholarship.requirementText"),
                noApplicationMaterials: !text.includes("Scholarship.applicationMaterials"),
                noScholarshipSchool: !text.includes("ScholarshipSchool"),
                noScholarshipProgram: !text.includes("ScholarshipProgram"),
                sourceFields: Number(root?.dataset.detailSourceFieldCount || 0) > 0,
              };
              return { ok: Object.values(checks).every(Boolean), checks, text: text.slice(0, 3500) };
            })()
          `);
          if (!exposesScholarshipFields?.ok) throw new Error(`Scholarship detail did not render user-facing Scholarship information with hidden source fields: ${JSON.stringify(exposesScholarshipFields?.checks || {})}`);
          await evaluate(cdp, "document.querySelector('[data-share-scholarship]')?.click()");
          await waitFor(cdp, "document.querySelector('[data-share-scholarship]')?.textContent.trim() === 'Link copied'", "scholarship share button feedback");
        }
        if (title === "Shanghai") {
          const exposesCityFields = await evaluate(cdp, `
            (() => {
              const text = document.body.textContent || "";
              const root = document.querySelector('[data-detail-root]');
              const checks = {
                cityInformation: text.includes("City information"),
                monthlyCost: text.includes("Monthly living cost reference"),
                citySnapshot: text.includes("Decision snapshot") && text.includes("Use the city as a planning filter"),
                noFieldSummaryLabels: !text.includes("Chinese name") && !text.includes("City pace") && !text.includes("Cost level"),
                cityFit: text.includes("City fit"),
                budget: text.includes("Plan living cost before choosing"),
                routes: text.includes("Turn the city choice into specific programs"),
                sectionNav: Boolean(document.querySelector('.city-section-nav a[href="#city-schools"]')) && Boolean(document.querySelector('.city-section-nav a[href="#city-funding"]')),
                anchors: Boolean(document.querySelector('#city-fit')) && Boolean(document.querySelector('#city-budget')) && Boolean(document.querySelector('#city-faq')),
                universities: text.includes("Universities students can compare here"),
                programs: text.includes("Programs students can actually compare"),
                programDirections: text.includes("Recommended program directions") && Boolean(document.querySelector('.city-program-keywords a[href*="programs.html?q="]')),
                scholarships: text.includes("Scholarship routes in this city"),
                visibleSchool: text.includes("Fudan University") || text.includes("Tongji University"),
                visibleProgram: text.includes("Economics BA") || text.includes("Civil Engineering MSc"),
                visibleProgramChineseName: text.includes("经济学本科") || text.includes("土木工程硕士"),
                visibleScholarship: text.includes("Shanghai Government Scholarship"),
                programFilters: Boolean(document.querySelector('[data-city-program-filter="degree"]')) && Boolean(document.querySelector('[data-city-program-filter="language"]')) && Boolean(document.querySelector('[data-city-program-count]')),
                schoolCards: document.querySelectorAll('.city-school-card').length >= 1,
                programCards: document.querySelectorAll('.city-program-card').length >= 1,
                programChineseAlias: Boolean(document.querySelector('.city-program-title-zh')),
                scholarshipCards: document.querySelectorAll('.city-scholarship-card').length >= 1,
                programAction: Boolean(document.querySelector('.city-program-card .secondary-action[href*="program-detail.html"]')),
                cityEssentials: text.includes("City essentials") && [...document.querySelectorAll('.city-quick-facts article span')].every((item) => !["Universities", "Programs", "English routes", "Scholarship routes", "CSCA schools"].includes(item.textContent.trim())),
                noBudgetFactRepeat: !document.querySelector('.city-budget-panel .city-content-facts'),
                aggregateSummary: Boolean(document.querySelector('.city-aggregate-grid')) && text.includes("Options to compare from this city") && text.includes("At a glance"),
                aggregateActions: Boolean(document.querySelector('.city-aggregate-grid a[href*="universities.html?city="]')) && Boolean(document.querySelector('.city-aggregate-grid a[href*="programs.html?city="]')) && Boolean(document.querySelector('.city-aggregate-grid a[href*="scholarships.html?city="]')),
                bestForHero: Boolean(document.querySelector('.city-budget-card .city-best-for-strip')) && text.includes("Best for"),
                availableSchools: text.includes("Available schools"),
                scholarshipRoutes: text.includes("Scholarship routes"),
                fundingOptions: text.includes("Funding options"),
                sideActionGrid: Boolean(document.querySelector('.city-side-action-grid')),
                sideSchoolAction: Boolean(document.querySelector('.city-side-action-grid a[href*="universities.html?city="]')) && text.includes("Filter this city schools"),
                sideProgramAction: Boolean(document.querySelector('.city-side-action-grid a[href*="programs.html?city="]')) && text.includes("English programs"),
                sideTimelineAction: Boolean(document.querySelector('.city-side-action-grid a[href="guides.html#timeline"]')) && text.includes("Application timeline"),
                sideTips: document.querySelectorAll('.city-side-tip-list span').length >= 2,
                applicationChecklist: text.includes("Application checklist") && Boolean(document.querySelector('.city-application-checklist')) && document.querySelectorAll('.city-application-tip-list span').length >= 2,
                life: text.includes("City life and adaptation"),
                transport: text.includes("Transport and arrival"),
                nearby: Boolean(document.querySelector('.city-nearby-strip a')),
                advice: text.includes("Next choices") && text.includes("Use the city only after program fit is clear"),
                noOldCopy: !text.includes("What matters before choosing"),
                noDuplicatedOptionsCopy: !text.includes("What students can compare in this city"),
                noContentJson: !text.includes("CityGuide.contentJson"),
                noRawReference: !text.includes("CityGuide.referenceProgramCount"),
                noRawAggregateField: !text.includes("CityGuideAggregate."),
                noInternalAggregateCopy: !text.includes("Matched counts come from current school"),
                noGuideReferenceCopy: !text.includes("guide reference") && !text.includes("What CUAC can currently show here"),
                sourceFields: Number(root?.dataset.detailSourceFieldCount || 0) > 0,
              };
              return { ok: Object.values(checks).every(Boolean), checks, text: text.slice(0, 3000) };
            })()
          `);
          if (!exposesCityFields?.ok) throw new Error(`City detail did not render user-facing CityGuide information with hidden source fields: ${JSON.stringify(exposesCityFields?.checks || {})}`);
          const cityProgramFilterWorks = await evaluate(cdp, `
            (() => {
              const degree = document.querySelector('[data-city-program-filter="degree"]');
              const rows = [...document.querySelectorAll('[data-city-program-row]')];
              const count = document.querySelector('[data-city-program-count]');
              if (!degree || rows.length < 2 || !count) return false;
              degree.value = "master";
              degree.dispatchEvent(new Event("change", { bubbles: true }));
              const visibleRows = rows.filter((row) => !row.hidden);
              const visibleText = visibleRows.map((row) => row.textContent || "").join(" ");
              return visibleRows.length === 1
                && count.textContent.trim() === "1 shown"
                && visibleText.includes("Civil Engineering MSc")
                && !visibleText.includes("Economics BA");
            })()
          `);
          if (!cityProgramFilterWorks) throw new Error("City detail program filters did not update the visible CSCAlite aggregate program rows.");
          const citySchoolDetailHref = await evaluate(cdp, `
            (() => {
              const link = document.querySelector('.city-school-card[href*="university-detail.html"]');
              if (!link) return "";
              link.click();
              return link.getAttribute('href') || "";
            })()
          `);
          if (!citySchoolDetailHref) throw new Error("City detail did not expose a clickable university detail card.");
          await waitFor(
            cdp,
            "document.querySelector('.university-detail-hero h1')?.textContent.trim().length > 0 && document.querySelector('[data-detail-root]')?.dataset.detailSourceModel === 'School'",
            "city school card opens university detail",
          );
        }
      }
    });

    await runStep("universities accepts CSCAlite school filter query params", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, `
        localStorage.clear();
        localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify({
          schoolRecords: [{
            id: 'qa-cscalite-filter-school',
            sourceId: 'qa-cscalite-filter-school',
            nameZh: '筛选测试大学',
            nameEn: 'Filter Test University',
            cityZh: '杭州',
            region: 'Zhejiang',
            schoolType: 'Regular',
            status: 'published',
            applicationSystemUrl: 'https://example.edu/apply',
            round1Deadline: 'Oct 15',
            programCount: 1,
            englishProgramCount: 1,
            cscaRequired: true,
            cscaRules: [{
              id: 'qa-csca-rule',
              title: 'Computer science CSCA rule',
              requirementText: 'CSCA subject check for engineering applicants.',
              status: 'published'
            }],
            scholarshipsDetailed: [{
              id: 'qa-csc-scholarship',
              name: 'CSC Filter Scholarship',
              type: 'CSC',
              coverage: 'Full funding',
              isCsc: true,
              status: 'published'
            }],
            programs: [{
              id: 'qa-filter-program',
              schoolId: 'qa-cscalite-filter-school',
              nameEn: 'Computer Science MSc',
              degreeLevel: 'Master',
              fieldCategory: 'Computer Science',
              teachingLanguage: 'English-taught',
              tuitionAmount: 42000,
              deadlineDate: '2026-10-15',
              status: 'published'
            }]
          }]
        }));
      `);
      await navigate(cdp, "universities.html?motion=off&keyword=Filter&hasDetailedScholarship=true&hasCsc=true&hasCscaRules=true&degreeLevel=Master&teachingLanguage=English-taught&programSubject=Computer%20Science&hasUpcomingDeadline=true");
      await waitFor(
        cdp,
        "document.querySelector('#resultsGrid')?.textContent.includes('Filter Test University') && document.querySelector('#activeFilters')?.textContent.includes('Detailed scholarships') && document.querySelector('#activeFilters')?.textContent.includes('CSC scholarship') && document.querySelector('#activeFilters')?.textContent.includes('Degree level: Master') && document.querySelector('[data-criteria-field=\"degreeLevel\"]')?.value === 'Master' && document.querySelector('[data-criteria-field=\"teachingLanguage\"]')?.value === 'English-taught' && document.querySelector('[data-criteria-field=\"programSubject\"]')?.value === 'Computer Science' && document.querySelector('[data-criteria-field=\"hasUpcomingDeadline\"]')?.value === 'true' && document.querySelector('[data-criteria-field=\"scholarshipRoute\"]')?.value === 'csc'",
        "CSCAlite university filter params render matching school",
      );
      await evaluate(cdp, `
        (() => {
          const scholarshipRoute = document.querySelector('[data-criteria-field="scholarshipRoute"]');
          scholarshipRoute.value = 'scholarship';
          scholarshipRoute.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('#resultsGrid')?.textContent.includes('Filter Test University') && document.querySelector('[data-criteria-field=\"scholarshipRoute\"]')?.value === 'scholarship' && document.querySelector('#activeFilters')?.textContent.includes('Detailed scholarships') && !document.querySelector('#activeFilters')?.textContent.includes('CSC scholarship')",
        "CSCAlite visible scholarship route filter can switch between CSC and detailed scholarships",
      );
      await evaluate(cdp, `
        (() => {
          const scholarshipRoute = document.querySelector('[data-criteria-field="scholarshipRoute"]');
          scholarshipRoute.value = 'csc';
          scholarshipRoute.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('#resultsGrid')?.textContent.includes('Filter Test University') && document.querySelector('[data-criteria-field=\"scholarshipRoute\"]')?.value === 'csc' && document.querySelector('#activeFilters')?.textContent.includes('CSC scholarship') && !document.querySelector('#activeFilters')?.textContent.includes('Detailed scholarships')",
        "CSCAlite visible scholarship route filter can restore CSC scholarships",
      );
      await evaluate(cdp, `
        (() => {
          const degree = document.querySelector('[data-criteria-field="degreeLevel"]');
          degree.value = 'Bachelor';
          degree.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('#activeFilters')?.textContent.includes('Degree level: Bachelor') && !document.querySelector('#resultsGrid')?.textContent.includes('Filter Test University') && document.querySelector('#emptyState')?.style.display !== 'none'",
        "CSCAlite visible degree filter can narrow universities",
      );
      await evaluate(cdp, `
        (() => {
          const degree = document.querySelector('[data-criteria-field="degreeLevel"]');
          degree.value = 'Master';
          degree.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('#resultsGrid')?.textContent.includes('Filter Test University') && document.querySelector('#activeFilters')?.textContent.includes('Degree level: Master')",
        "CSCAlite visible degree filter can restore matching universities",
      );
      await evaluate(cdp, `
        (() => {
          const button = [...document.querySelectorAll('#activeFilters button')].find((item) => item.closest('.active-pill')?.textContent.includes('CSC scholarship'));
          button?.click();
        })()
      `);
      await waitFor(
        cdp,
        "!document.querySelector('#activeFilters')?.textContent.includes('CSC scholarship') && document.querySelector('#resultsGrid')?.textContent.includes('Filter Test University')",
        "CSCAlite criterion chip can be removed without blanking results",
      );
    });

    await runStep("universities honor CSCAlite rank csca and name sort params", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, `
        localStorage.clear();
        localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify({
          schoolRecords: [
            {
              id: 'qa-sort-alpha',
              sourceId: 'qa-sort-alpha',
              nameZh: '排序甲大学',
              nameEn: 'Sort QA Alpha University',
              cityZh: '杭州',
              region: 'Zhejiang',
              schoolType: 'Regular',
              status: 'published',
              rank: 50,
              qualityScore: 70,
              applicationSystemUrl: 'https://alpha.example.edu/apply',
              round1Deadline: 'Oct 15',
              programCount: 1,
              englishProgramCount: 1,
              cscaRequired: true,
              cscaRules: [{ id: 'sort-alpha-csca', title: 'CSCA route', status: 'published' }],
              programs: [{ id: 'sort-alpha-program', schoolId: 'qa-sort-alpha', nameEn: 'Sort QA Engineering MSc', degreeLevel: 'Master', fieldCategory: 'Engineering', teachingLanguage: 'English-taught', deadlineDate: '2026-10-15', status: 'published' }]
            },
            {
              id: 'qa-sort-zeta',
              sourceId: 'qa-sort-zeta',
              nameZh: '排序乙大学',
              nameEn: 'Sort QA Zeta University',
              cityZh: '北京',
              region: 'Beijing',
              schoolType: 'Regular',
              status: 'published',
              rank: 2,
              qualityScore: 95,
              applicationSystemUrl: 'https://zeta.example.edu/apply',
              round1Deadline: 'Oct 15',
              programCount: 1,
              englishProgramCount: 1,
              cscaRequired: false,
              cscaRules: [],
              programs: [{ id: 'sort-zeta-program', schoolId: 'qa-sort-zeta', nameEn: 'Sort QA Business MSc', degreeLevel: 'Master', fieldCategory: 'Business', teachingLanguage: 'English-taught', deadlineDate: '2026-10-15', status: 'published' }]
            }
          ]
        }));
      `);
      await navigate(cdp, "universities.html?motion=off&keyword=Sort%20QA&sort=name");
      await waitFor(
        cdp,
        "document.querySelector('#sortSelect')?.value === 'name' && document.querySelector('[data-university-card]')?.dataset.name === 'Sort QA Alpha University'",
        "CSCAlite university sort=name orders by school name",
      );
      await navigate(cdp, "universities.html?motion=off&keyword=Sort%20QA&sort=rank");
      await waitFor(
        cdp,
        "document.querySelector('#sortSelect')?.value === 'rank' && document.querySelector('[data-university-card]')?.dataset.name === 'Sort QA Zeta University'",
        "CSCAlite university sort=rank orders by rank cue",
      );
      await navigate(cdp, "universities.html?motion=off&keyword=Sort%20QA&sort=csca");
      await waitFor(
        cdp,
        "document.querySelector('#sortSelect')?.value === 'csca' && document.querySelector('[data-university-card]')?.dataset.name === 'Sort QA Alpha University'",
        "CSCAlite university sort=csca prioritizes CSCA schools",
      );
    });

    await runStep("programs accepts CSCAlite program filter query params", async () => {
      await navigate(cdp, "programs.html?motion=off&keyword=Zhejiang&degreeLevel=Master&teachingLanguage=English-taught&fieldCategory=Computer%20Science&hasScholarship=true&hasUpcomingDeadline=true");
      await waitFor(
        cdp,
        "document.querySelector('#programList')?.textContent.includes('Computer Science MSc') && document.querySelector('#programList')?.textContent.includes('Zhejiang University') && document.querySelector('#activeChips')?.textContent.includes('Search: Zhejiang') && document.querySelector('#activeChips')?.textContent.includes('Master') && document.querySelector('#activeChips')?.textContent.includes('English-taught') && document.querySelector('#activeChips')?.textContent.includes('Computer Science') && document.querySelector('#activeChips')?.textContent.includes('Scholarship') && document.querySelector('#activeChips')?.textContent.includes('Upcoming deadline') && document.querySelector('[data-filter-key=\"degree\"]')?.value === 'master' && document.querySelector('[data-filter-key=\"language\"]')?.value === 'english' && document.querySelector('[data-filter-key=\"subject\"]')?.value === 'Computer Science'",
        "CSCAlite program filter params render matching program",
      );
      await evaluate(cdp, `
        (() => {
          const subject = document.querySelector('[data-filter-key="subject"]');
          subject.value = 'Medicine';
          subject.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('#activeChips')?.textContent.includes('Medicine') && !document.querySelector('#programList')?.textContent.includes('Computer Science MSc') && document.querySelector('#emptyState')?.style.display !== 'none'",
        "CSCAlite visible subject filter can narrow programs",
      );
    });

    await runStep("scholarships accepts CSCAlite scholarship filter query params", async () => {
      await navigate(cdp, "scholarships.html?motion=off&keyword=Shanghai&fundingLevel=full&type=provincial&country=Malaysia&applicableDegree=Master");
      await waitFor(
        cdp,
        "document.querySelector('#scholarshipGrid')?.textContent.includes('Shanghai Government Scholarship') && document.querySelector('#activeChips')?.textContent.includes('Search: Shanghai') && document.querySelector('#activeChips')?.textContent.includes('Full funding') && document.querySelector('#activeChips')?.textContent.includes('province route') && document.querySelector('#activeChips')?.textContent.includes('Master') && document.querySelector('#activeChips')?.textContent.includes('Malaysia') && document.querySelector('[data-filter-key=\"funding\"]')?.value === 'full' && document.querySelector('[data-filter-key=\"type\"]')?.value === 'province' && document.querySelector('[data-filter-key=\"degree\"]')?.value === 'Master' && document.querySelector('[data-filter-key=\"country\"]')?.value === 'Malaysia'",
        "CSCAlite scholarship filter params render matching scholarship",
      );
      await evaluate(cdp, `
        (() => {
          const type = document.querySelector('[data-filter-key="type"]');
          type.value = 'university';
          type.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `);
      await waitFor(
        cdp,
        "document.querySelector('#activeChips')?.textContent.includes('university route') && !document.querySelector('#scholarshipGrid')?.textContent.includes('Shanghai Government Scholarship')",
        "CSCAlite visible scholarship type filter can narrow results",
      );
    });

    await runStep("public scholarship country filter keeps scoped cards visible", async () => {
      await navigate(cdp, "scholarships.html?motion=off");
      await waitFor(cdp, "document.querySelectorAll('.scholarship-card').length > 0 && Boolean(document.querySelector('.scope-row'))", "scholarship cards with scope row");
      const pickedCountry = await evaluate(cdp, `
        (() => {
          const select = document.querySelector('[data-filter-key="country"]');
          if (!select) return "";
          const option = [...select.options].find((item) => item.value && item.value !== "all");
          if (!option) return "";
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          return option.value;
        })()
      `);
      if (!pickedCountry) throw new Error("Scholarship country filter did not expose CSCAlite target country/region options.");
      await waitFor(
        cdp,
        `
          (() => {
            const picked = ${JSON.stringify(pickedCountry)};
            const cards = [...document.querySelectorAll('.scholarship-card')];
            return document.querySelector('#activeChips')?.textContent.includes(picked)
              && cards.length > 0
              && cards.every((card) => card.querySelector('.scope-row')?.textContent.includes(picked));
          })()
        `,
        "scholarship country filter renders scoped cards",
      );
      await clickSelector(cdp, '#activeChips [data-clear="country"]');
      await waitFor(cdp, `${JSON.stringify(pickedCountry)} && !document.querySelector('#activeChips')?.textContent.includes(${JSON.stringify(pickedCountry)})`, "scholarship country filter clears");
    });

    await runStep("public scholarship unknown funding uses student-facing check label", async () => {
      await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacOpsAdminDemoState') || '{}');
          const records = Array.isArray(state.publicScholarshipRecords) ? state.publicScholarshipRecords : [];
          state.publicScholarshipRecords = [
            {
              id: 'unknown-funding-qa-award',
              slug: 'unknown-funding-qa-award',
              title: 'Unknown Funding QA Award',
              type: 'partner',
              fundingLevel: 'unknown',
              providerName: 'QA Foundation',
              summary: 'Funding coverage should be reviewed with the provider before planning documents.',
              coverage: 'Amount to review',
              applicableDegree: 'All levels',
              applicableProgram: 'Multiple programs',
              deadlineLabel: 'Window pending',
              targetCountries: ['Malaysia'],
              targetRegions: ['ASEAN'],
              benefits: ['Notice review'],
              status: 'published',
              sortOrder: 0,
              version: 1
            },
            ...records.filter((item) => item?.slug !== 'unknown-funding-qa-award')
          ];
          localStorage.setItem('cuacOpsAdminDemoState', JSON.stringify(state));
        })()
      `);
      await navigate(cdp, "scholarships.html?motion=off");
      await waitFor(
        cdp,
        `
          (() => {
            const card = [...document.querySelectorAll('.scholarship-card')]
              .find((item) => item.querySelector('h3')?.textContent.includes('Unknown Funding QA Award'));
            const fundingFact = card?.querySelector('.facts span:first-child')?.textContent || '';
            return Boolean(card)
              && /Check\\s*funding/.test(fundingFact)
              && !/Confirm\\s*funding/.test(fundingFact)
              && !/Partial\\s*funding/.test(fundingFact);
          })()
        `,
        "unknown scholarship funding card label",
      );
    });

    await runStep("cities accept CSCAlite city route filter params", async () => {
      await navigate(cdp, "cities.html?motion=off&city=wuhan&keyword=engineering&region=Central&costLevel=low&density=medium&need=lower%20cost&sort=cost");
      await waitFor(
        cdp,
        "document.querySelector('#featureStory')?.textContent.includes('Wuhan') && document.querySelector('#cityGrid')?.textContent.includes('Wuhan') && document.querySelector('#cityCount')?.textContent.trim() === '1' && document.querySelector('#activeChips')?.textContent.includes('Search: engineering') && document.querySelector('#activeChips')?.textContent.includes('Region: Central') && document.querySelector('#activeChips')?.textContent.includes('low cost') && document.querySelector('#activeChips')?.textContent.includes('medium density') && document.querySelector('#activeChips')?.textContent.includes('lower cost') && document.querySelector('#sortSelect')?.value === 'costLow'",
        "CSCAlite city route params render matching city",
      );
      await clickSelector(cdp, '#activeChips [data-clear-city-filter="query"]');
      await waitFor(
        cdp,
        "!document.querySelector('#activeChips')?.textContent.includes('Search: engineering') && document.querySelector('#cityGrid')?.textContent.includes('Wuhan')",
        "CSCAlite city route query chip clears without blanking city results",
      );
    });

    await runStep("catalog card detail links open catalog-backed detail pages", async () => {
      const catalogClicks = [
        {
          page: "programs.html?motion=off",
          selector: "[data-program-card][data-detail-href*='program-detail.html']",
          hero: ".program-detail-hero h1",
          entityType: "Program",
          sourceModel: "SchoolProgram",
          label: "program card detail",
        },
        {
          page: "universities.html?motion=off",
          selector: "[data-university-card][data-detail-href*='university-detail.html']",
          hero: ".university-detail-hero h1",
          entityType: "School",
          sourceModel: "School",
          label: "university card detail",
        },
        {
          page: "scholarships.html?motion=off",
          selector: "[data-scholarship-card][data-detail-href*='scholarship-detail.html']",
          hero: ".funding-detail-hero h1",
          entityType: "PublicScholarship",
          sourceModel: "Scholarship",
          label: "scholarship card detail",
        },
        {
          page: "cities.html?motion=off",
          selector: "[data-city-card][data-detail-href*='city-detail.html']",
          hero: ".city-detail-hero h1",
          entityType: "City",
          sourceModel: "CityGuide",
          label: "city card detail",
        },
      ];
      for (const item of catalogClicks) {
        await navigate(cdp, item.page);
        await waitFor(cdp, `Boolean(document.querySelector(${JSON.stringify(item.selector)}))`, item.label);
        const href = await evaluate(cdp, `
          (() => {
            const entry = document.querySelector(${JSON.stringify(item.selector)});
            const href = entry.getAttribute('href') || entry.dataset.detailHref || '';
            entry.click();
            return href;
          })()
        `);
        if (!href) throw new Error(`${item.label} did not expose a detail href.`);
        await waitFor(
          cdp,
          `document.querySelector(${JSON.stringify(item.hero)})?.textContent.trim().length > 0 && document.querySelector('[data-detail-root]')?.dataset.detailEntityType === ${JSON.stringify(item.entityType)} && document.querySelector('[data-detail-root]')?.dataset.detailSourceModel === ${JSON.stringify(item.sourceModel)}`,
          `${item.label} resolves catalog detail`,
        );
        const noFallback = await evaluate(cdp, `!document.body.textContent.includes('Selected profile from the CUAC demo') && !document.body.textContent.includes('No matching CUAC detail record')`);
        if (!noFallback) throw new Error(`${item.label} opened fallback or empty detail for ${href}.`);
      }
    });

    await runStep("saving detail preserves source context in favourites and notifications", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "program-detail.html?program=fudan-econ-ba&motion=off");
      await waitFor(cdp, "document.querySelector('.program-detail-hero h1')?.textContent.trim() === 'Economics BA'", "save-detail program page");
      await evaluate(cdp, "document.querySelector('[data-save-detail]')?.click()");
      await waitFor(
        cdp,
        "JSON.parse(localStorage.getItem('cuacSavedDetailItemsDemoState') || '{}').items?.some((item) => item.title === 'Economics BA' && item.sourceFieldLineage?.sourceModel === 'SchoolProgram')",
        "saved detail local state",
      );

      await navigate(cdp, "favourites.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-saved-grid]')?.textContent.includes('Economics BA')", "saved detail in favourites");
      const favouriteSourceOk = await evaluate(cdp, `
        (() => {
          const card = [...document.querySelectorAll('[data-saved-item]')].find((item) => item.textContent.includes('Economics BA'));
          return card?.dataset.entityType === 'Program' && card?.dataset.sourceModel === 'SchoolProgram';
        })()
      `);
      if (!favouriteSourceOk) throw new Error("Saved detail did not preserve Program / SchoolProgram context in Favourites.");
      await evaluate(cdp, `
        (() => {
          const card = [...document.querySelectorAll('[data-saved-item]')].find((item) => item.textContent.includes('Economics BA'));
          card.querySelector('[data-add-choice]')?.click();
        })()
      `);
      await waitFor(
        cdp,
        "JSON.parse(localStorage.getItem('cuacApplicationDemoState') || '{}').routes?.some((route) => route.program === 'Economics BA' && route.university === 'Fudan University')",
        "saved detail added to application state",
      );
      await navigate(cdp, "application.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-choice-list]')?.textContent.includes('Economics BA')", "saved detail application choice");
      await waitFor(cdp, "[...document.querySelectorAll('[data-total-fee]')].some((item) => item.textContent.includes('USD 60'))", "saved detail application fee");

      await navigate(cdp, "notifications.html?motion=off");
      await waitFor(cdp, "[...document.querySelectorAll('.notice-row')].some((row) => row.textContent.includes('Economics BA saved to Favourites'))", "saved detail notification");
      const notificationSourceOk = await evaluate(cdp, `
        (() => {
          const row = [...document.querySelectorAll('.notice-row')].find((item) => item.textContent.includes('Economics BA saved to Favourites'));
          const action = row?.querySelector('.notice-actions a');
          return row?.dataset.entityType === 'Program'
            && row?.dataset.sourceModel === 'SchoolProgram'
            && action?.getAttribute('href') === 'favourites.html'
            && !row.querySelector('[data-agent-prompt]');
        })()
      `);
      if (!notificationSourceOk) throw new Error("Saved detail notification did not preserve source context without a page-level Agent prompt.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("home renders shared discovery summary", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-home-categories]')?.textContent.includes('Programs')", "Home shared categories");
      const homeSummary = await evaluate(cdp, `
        (() => {
          const summary = window.CuacDataClient?.getHomeDiscoverySummary?.();
          return summary?.source === 'CuacDataClient home discovery summary fixture'
            && document.querySelector('[data-home-open-intakes]')?.textContent.includes('Computer Science')
            && document.querySelector('[data-home-city-snapshot]')?.textContent.includes('Hangzhou')
            && document.querySelector('[data-home-schools]')?.textContent.includes('Zhejiang University')
            && document.querySelector('[data-home-question-routes]')?.textContent.includes('Study in English');
        })()
      `);
      if (!homeSummary) throw new Error("Home did not render shared discovery summary data.");
    });

    await runStep("hub renders shared student summary and onboarding override", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "hub.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-route-title]')?.textContent.includes('Zhejiang University')", "Hub shared route title");
      const sharedSummary = await evaluate(cdp, `
        (() => {
          const launchCards = [...document.querySelectorAll('.hub-launch-card')].map((card) => card.textContent);
          return launchCards.length === 3
            && document.querySelector('[data-application-title]')?.textContent.includes('Start your application')
            && document.querySelector('.application-top-action')?.textContent.includes('Start application')
            && document.querySelector('.application-top-action')?.getAttribute('href') === 'application.html'
            && document.querySelector('.application-entry-grid')?.classList.contains('no-current-application')
            && launchCards.some((item) => item.includes('Prepare documents'))
            && launchCards.some((item) => item.includes('Study goal'))
            && !document.querySelector('[data-route-list]')
            && !document.querySelector('[data-document-list]')
            && document.querySelector('[data-days-to-check]')?.textContent.trim() === '18';
        })()
      `);
      if (!sharedSummary) throw new Error("Hub did not keep application entry points while removing duplicate application-center detail.");

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
      await waitFor(cdp, "document.querySelector('[data-application-title]')?.textContent.includes('Ready to review')", "Hub existing application state");
      const existingApplicationEntry = await evaluate(cdp, `
        (() => {
          const launchCards = [...document.querySelectorAll('.hub-launch-card')].map((card) => card.textContent);
          return document.querySelector('.application-top-action')?.textContent.includes('Open')
          && document.querySelector('.application-top-action')?.getAttribute('href') === 'application.html'
          && document.querySelector('.application-start-card')?.textContent.includes('Add a school choice')
          && document.querySelector('.application-start-card')?.getAttribute('href') === 'application.html'
          && launchCards.some((item) => item.includes('Check blockers'))
          && launchCards.some((item) => item.includes('Update plan'))
          && !document.querySelector('.application-entry-grid')?.classList.contains('no-current-application');
        })()
      `);
      if (!existingApplicationEntry) throw new Error("Hub did not separate existing application continuation from new application setup.");
      await evaluate(cdp, "localStorage.removeItem('cuacApplicationDemoState')");

      await evaluate(cdp, `
        localStorage.setItem('cuacOnboardingPreview', JSON.stringify({
          level: 'Master',
          subject: 'Business Analytics',
          cities: ['Shanghai'],
          intake: 'Spring 2027',
          language: 'English-taught',
          funding: 'Prefer partial scholarship',
          focus: 'Program shortlist'
        }))
      `);
      await navigate(cdp, "hub.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-route-title]')?.textContent.includes('International Trade MSc')", "Hub onboarding route override");
      const overrideApplied = await evaluate(cdp, `
        document.querySelector('[data-profile-summary]')?.textContent.includes('Spring 2027')
          && document.querySelector('[data-route-copy]')?.textContent.includes('Business Analytics')
          && document.querySelector('[data-route-label]')?.textContent.includes('Suggested first choice')
      `);
      if (!overrideApplied) throw new Error("Hub onboarding preview did not override shared summary context.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("favourites renders shared saved-items summary", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "favourites.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-saved-grid]')?.textContent.includes('Computer Science MSc')", "Favourites shared saved program");
      const sharedSavedItems = await evaluate(cdp, `
        (() => {
          const summary = window.CuacDataClient?.getSavedItemsSummary?.();
          const programs = [...document.querySelectorAll('[data-saved-grid] [data-saved-item]')].map((card) => card.textContent);
          const contextRows = [...document.querySelectorAll('[data-saved-context] [data-saved-item]')].map((row) => row.textContent);
          const compareItems = [...document.querySelectorAll('[data-compare-tray] .compare-items a')].map((item) => item.textContent);
          const compareAction = document.querySelector('[data-compare-tray] .compare-actions a')?.textContent || '';
          const contextHasChoiceButton = [...document.querySelectorAll('[data-saved-context] [data-saved-item]')].some((row) => row.querySelector('[data-add-choice]'));
          return summary?.source === 'CuacDataClient saved items summary fixture'
            && programs.some((item) => item.includes('Computer Science MSc'))
            && contextRows.some((item) => item.includes('Zhejiang University'))
            && contextRows.some((item) => item.includes('Chinese Government Scholarship'))
            && compareItems.length === 3
            && compareAction.includes('Open application')
            && !contextHasChoiceButton;
        })()
      `);
      if (!sharedSavedItems) throw new Error("Favourites did not render shared saved-items data with safe choice boundaries.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("notifications render shared notification summary and dynamic events", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await evaluate(cdp, `
        window.CuacDataClient?.addNotificationEvent?.({
          id: 'qa-dynamic-notice',
          type: 'deadline',
          severity: 'action',
          group: 'Today',
          title: 'QA dynamic deadline',
          body: 'A saved application route changed during QA.',
          entity: 'QA route',
          time: 'Just now',
          action: 'Open application',
          href: 'application.html',
          prompt: 'Summarize the QA dynamic deadline'
        })
      `);
      await navigate(cdp, "notifications.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-notification-list]')?.textContent.includes('Transcript translation still needs review')", "shared default notification");
      const sharedNotifications = await evaluate(cdp, `
        (() => {
          const summary = window.CuacDataClient?.getNotificationCenterSummary?.();
          const rows = [...document.querySelectorAll('.notice-row')].map((row) => row.textContent);
          const groups = [...document.querySelectorAll('.notice-group h3')].map((item) => item.textContent.trim());
          return summary?.source === 'CuacDataClient notification center summary fixture'
            && rows.some((row) => row.includes('QA dynamic deadline'))
            && rows.some((row) => row.includes('Transcript translation still needs review'))
            && rows.some((row) => row.includes('Agent comparison is ready'))
            && groups[0] === 'Today'
            && document.querySelector('[data-summary="documents"]')?.textContent.trim() === '1';
        })()
      `);
      if (!sharedNotifications) throw new Error("Notifications did not combine shared base notifications with dynamic events.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("preferences render shared preference summary defaults", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "preferences.html#agent");
      await waitFor(cdp, "document.querySelector('[data-profile-chips]')?.textContent.includes('Computer Science')", "Preferences shared profile chips");
      const sharedPreferences = await evaluate(cdp, `
        (() => {
          const summary = window.CuacDataClient?.getPreferenceCenterSummary?.();
          const chips = document.querySelector('[data-profile-chips]')?.textContent || '';
          const health = document.querySelector('[data-workspace-health]')?.textContent || '';
          const memoryPanel = document.querySelector('[data-agent-memory-panel]');
          return summary?.source === 'CuacDataClient preference center summary fixture'
            && chips.includes('Master')
            && chips.includes('Fall 2026')
            && health.includes('Profile ready')
            && health.includes('Use saved routes')
            && document.querySelector('[data-notification-pref="agent"]')?.checked === true
            && memoryPanel?.dataset.agentMemoryStatus === summary.defaultAgentMemoryState.status;
        })()
      `);
      if (!sharedPreferences) throw new Error("Preferences did not render shared preference summary defaults.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("notification preferences persist into notifications center", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "preferences.html#notifications");
      await waitFor(cdp, "Boolean(document.querySelector('[data-notification-pref=\"agent\"]'))", "notification preference controls");
      await evaluate(cdp, `
        (() => {
          const agent = document.querySelector('[data-notification-pref="agent"]');
          agent.checked = false;
          agent.dispatchEvent(new Event('change', { bubbles: true }));
          document.querySelector('[data-save-preferences]').click();
          return true;
        })()
      `);
      const persisted = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacPreferencesDemoState') || '{}');
          return state.notifications?.categories?.agent === false && Boolean(state.savedAt);
        })()
      `);
      if (!persisted) throw new Error("Preferences did not persist Agent notification preference.");

      await navigate(cdp, "notifications.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-quiet-pref=\"agent\"]'))", "quiet settings controls");
      const applied = await evaluate(cdp, `
        (() => ({
          agentChecked: document.querySelector('[data-quiet-pref="agent"]')?.checked,
          hasAgentNotice: Boolean([...document.querySelectorAll('.notice-row')].find((row) => row.textContent.includes('Agent comparison is ready'))),
          agentSummary: document.querySelector('[data-summary="agent"]')?.textContent || '',
          quietCopy: document.querySelector('[data-quiet-summary]')?.textContent || '',
        }))()
      `);
      if (applied.agentChecked !== false || applied.hasAgentNotice || applied.agentSummary !== "0" || !applied.quietCopy.includes("account settings")) {
        throw new Error(`Notifications did not apply stored preferences: ${JSON.stringify(applied)}`);
      }
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("workspace preferences persist and shape Hub context", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "preferences.html#goal");
      await waitFor(cdp, "Boolean(document.querySelector('[data-panel=\"goal\"].active'))", "goal preferences panel");
      await evaluate(cdp, `
        (() => {
          const setSelect = (labelText, value) => {
            const label = [...document.querySelectorAll('[data-panel="goal"] label')].find((item) => item.querySelector('span')?.textContent.trim() === labelText);
            const select = label?.querySelector('select');
            if (!select) throw new Error('Missing goal select ' + labelText);
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          };
          setSelect('Degree level', 'Master');
          setSelect('Subject focus', 'Business');
          setSelect('Intake', 'Spring 2027');
          setSelect('Teaching language', 'English-taught');
          document.querySelectorAll('[data-panel="goal"] .chip-set button').forEach((button) => {
            button.classList.toggle('selected', button.textContent.trim() === 'Shanghai');
          });
          document.querySelector('[data-section="budget"]').click();
          const budget = [...document.querySelectorAll('[data-panel="budget"] label')].find((item) => item.querySelector('span')?.textContent.trim() === 'Scholarship priority')?.querySelector('select');
          budget.value = 'Need full funding';
          budget.dispatchEvent(new Event('change', { bubbles: true }));
          document.querySelector('[data-section="readiness"]').click();
          const language = [...document.querySelectorAll('[data-panel="readiness"] label')].find((item) => item.textContent.includes('IELTS or waiver evidence ready'))?.querySelector('input');
          language.checked = false;
          language.dispatchEvent(new Event('change', { bubbles: true }));
          document.querySelector('[data-save-preferences]').click();
        })()
      `);
      const stored = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacPreferencesDemoState') || '{}');
          return state.workspace?.goal?.subjectFocus === 'Business'
            && state.workspace?.goal?.preferredCities?.[0] === 'Shanghai'
            && state.workspace?.budget?.scholarshipPriority === 'Need full funding'
            && state.workspace?.readiness?.languageEvidence === false;
        })()
      `);
      if (!stored) throw new Error("Workspace preferences did not persist study goal, city, budget, and readiness.");

      await navigate(cdp, "preferences.html#goal");
      await waitFor(
        cdp,
        "document.querySelector('[data-profile-chips]')?.textContent.includes('Business') && document.querySelector('[data-profile-chips]')?.textContent.includes('Need full funding')",
        "saved workspace preference chips",
      );

      await navigate(cdp, "hub.html?motion=off");
      const hubApplied = await evaluate(cdp, `
        (() => {
          const checks = document.querySelector('.route-checks')?.textContent || '';
          return document.querySelector('[data-route-title]')?.textContent.includes('UIBE · International Trade MSc')
            && document.querySelector('[data-route-copy]')?.textContent.includes('Based on your plan')
            && checks.includes('Need full funding')
            && checks.includes('Spring 2027')
            && checks.includes('Shanghai')
            && document.querySelector('[data-profile-summary]')?.textContent.includes('Spring 2027')
            && document.querySelector('[data-count="documents"]')?.textContent.trim() === '3'
            && [...document.querySelectorAll('.hub-launch-card')].some((card) => card.textContent.includes('Prepare documents'));
        })()
      `);
      if (!hubApplied) throw new Error("Hub did not apply saved workspace preferences.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("Agent memory clear requires confirmation and persists cleared state", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await evaluate(cdp, `
        localStorage.setItem('cuacStudentAgentMemory', JSON.stringify({
          studyGoal: 'Computer Science MSc',
          savedRoutes: ['zju-cs', 'nju-se'],
          applicationChoices: ['Zhejiang University']
        }))
      `);
      await navigate(cdp, "preferences.html#agent");
      await waitFor(cdp, "Boolean(document.querySelector('[data-agent-memory-panel]'))", "Agent memory panel");
      await evaluate(cdp, "document.querySelector('[data-clear-agent-memory]').click()");
      await waitFor(cdp, "!document.querySelector('[data-agent-memory-confirm]')?.hidden", "Agent memory clear confirmation");
      const notClearedYet = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacPreferencesDemoState') || '{}');
          return Boolean(localStorage.getItem('cuacStudentAgentMemory')) && state.agentMemory?.status !== 'cleared-preview';
        })()
      `);
      if (!notClearedYet) throw new Error("Agent memory cleared before confirmation.");
      await evaluate(cdp, "document.querySelector('[data-cancel-clear-agent-memory]').click()");
      const cancelKeptMemory = await evaluate(cdp, `
        (() => document.querySelector('[data-agent-memory-confirm]')?.hidden && Boolean(localStorage.getItem('cuacStudentAgentMemory')))()
      `);
      if (!cancelKeptMemory) throw new Error("Agent memory cancel did not keep stored memory.");
      await evaluate(cdp, "document.querySelector('[data-clear-agent-memory]').click()");
      await evaluate(cdp, "document.querySelector('[data-confirm-clear-agent-memory]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-agent-memory-title]')?.textContent.includes('cleared')",
        "Agent memory cleared state",
      );
      const cleared = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacPreferencesDemoState') || '{}');
          return !localStorage.getItem('cuacStudentAgentMemory')
            && state.agentMemory?.status === 'cleared-preview'
            && state.agentMemory?.clearTrigger === 'manual-confirmation'
            && state.agentMemory?.storageKey === 'cuacStudentAgentMemory'
            && document.querySelector('[data-agent-memory-panel]')?.dataset.agentMemoryStatus === 'cleared-preview'
            && document.querySelector('[data-agent-long-memory]')?.checked === false;
        })()
      `);
      if (!cleared) throw new Error("Confirmed Agent memory clear did not persist cleared state.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("notification read and dismiss states persist after reload", async () => {
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "notifications.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-notice-id=\"doc-translation\"]'))", "document notification row");
      await evaluate(cdp, "document.querySelector('[data-mark-read=\"doc-translation\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-notice-id=\"doc-translation\"]')?.classList.contains('is-read')", "read notification state");
      await evaluate(cdp, "document.querySelector('[data-dismiss=\"deadline-zju\"]').click()");
      await waitFor(cdp, "!document.querySelector('[data-notice-id=\"deadline-zju\"]')", "dismissed notification hidden");
      const stored = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacNotificationCenterDemoState') || '{}');
          return Array.isArray(state.readIds) && state.readIds.includes('doc-translation') && Array.isArray(state.dismissedIds) && state.dismissedIds.includes('deadline-zju');
        })()
      `);
      if (!stored) throw new Error("Notification center read/dismiss state was not persisted.");

      await navigate(cdp, "notifications.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-notice-id=\"doc-translation\"]')?.classList.contains('is-read')", "read state after reload");
      const dismissedStillHidden = await evaluate(cdp, "!document.querySelector('[data-notice-id=\"deadline-zju\"]')");
      if (!dismissedStillHidden) throw new Error("Dismissed notification reappeared after reload.");
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("role-aware auth routes school staff and ops accounts", async () => {
      await navigate(cdp, "auth.html?role=school&motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await navigate(cdp, "auth.html?role=school&motion=off");
      await waitFor(cdp, "document.querySelector('[data-auth-role=\"school\"]')?.classList.contains('active')", "school role selected");
      await submitAuthSignIn(cdp);
      await waitFor(cdp, "location.href.includes('school-portal.html')", "school portal destination", 12000);
      const schoolState = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacAuthDemoState') || '{}');
          return state.selectedSurface === 'school_staff'
            && state.role === 'school_staff'
            && state.accessGrantStatus === 'approved-preview'
            && state.accessGrantType === 'school_staff_membership'
            && state.destination === 'school-portal.html';
        })()
      `);
      if (!schoolState) throw new Error("School auth did not persist school_staff role state.");

      await navigate(cdp, "programs.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-save]'))", "program save button");
      await evaluate(cdp, "document.querySelector('[data-save]').click()");
      try {
        await waitFor(cdp, "location.href.includes('auth.html') && location.search.includes('role=student') && location.search.includes('continue=1') && [...document.querySelectorAll('[data-auth-role]')].length === 3", "school account save redirects to shared auth page");
      } catch (error) {
        const state = await evaluate(cdp, `
          (() => ({
            href: location.href,
            readyState: document.readyState,
            auth: localStorage.getItem('cuacAuthDemoState'),
            role: localStorage.getItem('cuacAuthDemoRole'),
            continuation: localStorage.getItem('cuacAuthContinuationDemoState'),
            saveCount: document.querySelectorAll('[data-save]').length,
            firstSave: document.querySelector('[data-save]')?.outerHTML || '',
            shell: window.CUAC ? { signedIn: window.CUAC.isSignedIn?.(), student: window.CUAC.isStudentSignedIn?.() } : null,
            errors: window.__cuacRuntimeErrors || []
          }))()
        `);
        throw new Error(`${error.message}. State: ${JSON.stringify(state)}`);
      }
      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "document.querySelector('.nav-links a[href=\"hub.html\"]')?.click()");
      try {
        await waitFor(cdp, "location.href.includes('auth.html') && location.search.includes('role=student') && !location.href.includes('hub.html?') && [...document.querySelectorAll('[data-auth-role]')].length === 3", "school account hub link redirects to shared auth page");
      } catch (error) {
        const state = await evaluate(cdp, `
          (() => ({
            href: location.href,
            readyState: document.readyState,
            auth: localStorage.getItem('cuacAuthDemoState'),
            role: localStorage.getItem('cuacAuthDemoRole'),
            continuation: localStorage.getItem('cuacAuthContinuationDemoState'),
            hubHref: document.querySelector('.nav-links a[href="hub.html"]')?.href || '',
            hubText: document.querySelector('.nav-links a[href="hub.html"]')?.textContent || '',
            shell: window.CUAC ? { signedIn: window.CUAC.isSignedIn?.(), student: window.CUAC.isStudentSignedIn?.() } : null,
            errors: window.__cuacRuntimeErrors || []
          }))()
        `);
        throw new Error(`${error.message}. State: ${JSON.stringify(state)}`);
      }

      await navigate(cdp, "application.html?motion=off");
      await waitFor(cdp, "location.href.includes('auth.html') && location.search.includes('role=student') && [...document.querySelectorAll('[data-auth-role]')].length === 3", "school account direct application route redirects to shared auth page");

      await evaluate(cdp, "localStorage.clear()");
      await navigate(cdp, "hub.html?motion=off");
      await waitFor(cdp, "location.href.includes('auth.html') && location.search.includes('role=student') && [...document.querySelectorAll('[data-auth-role]')].length === 3", "guest direct hub route redirects to shared auth page");

      await evaluate(cdp, `
        localStorage.setItem('cuacAuthDemoState', JSON.stringify({
          authState: 'signed-in',
          selectedSurface: 'student',
          role: 'student',
          surface: 'authenticated-student',
          accessGrantStatus: 'active-preview',
          accessGrantType: 'student_profile',
          accessGrantSource: 'self_registration',
          userName: 'Maya Chen',
          userInitial: 'M'
        }))
      `);
      await navigate(cdp, "hub.html?motion=off");
      await waitFor(cdp, "Boolean(window.CUAC?.isStudentSignedIn?.()) && location.href.includes('hub.html')", "student account can open direct hub route");

      await evaluate(cdp, "localStorage.clear()");
      await navigate(cdp, "programs.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('[data-save]'))", "program save button for student modal shape");
      await evaluate(cdp, "document.querySelector('[data-save]').click()");
      await waitFor(cdp, "location.href.includes('auth.html') && location.search.includes('role=student') && [...document.querySelectorAll('[data-auth-role]')].length === 3", "student action shared auth page");
      const studentAuthPageShowsIdentityChoice = await evaluate(cdp, `
        (() => {
          const continuation = JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}');
          return location.search.includes('role=student')
            && document.querySelector('[data-auth-role="student"]')?.classList.contains('active')
            && [...document.querySelectorAll('[data-auth-role]')].map((button) => button.textContent.trim()).join('|').includes('School staff')
            && Boolean(document.querySelector('[data-auth-tab="register"]'))
            && continuation.label === 'Save this program'
            && continuation.requiredRole === 'student';
        })()
      `);
      if (!studentAuthPageShowsIdentityChoice) throw new Error("Student protected action auth page did not expose the shared identity chooser and continuation.");

      await navigate(cdp, "school-portal.html?motion=off");
      await waitFor(cdp, "location.href.includes('auth.html') && location.search.includes('role=school') && [...document.querySelectorAll('[data-auth-role]')].length === 3", "school portal shared auth page");
      const schoolAuthPageShowsIdentityChoice = await evaluate(cdp, `
        (() => {
          document.querySelector('[data-auth-role="school"]')?.click();
          document.querySelector('[data-auth-tab="register"]')?.click();
          const continuation = JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}');
          return location.search.includes('role=school')
            && document.querySelector('[data-auth-role="school"]')?.classList.contains('active')
            && [...document.querySelectorAll('[data-auth-role]')].map((button) => button.textContent.trim()).join('|').includes('CUAC Ops')
            && document.querySelector('[data-auth-panel="register"]')?.classList.contains('active')
            && document.querySelector('[data-register-role-panel="school"]')?.classList.contains('active')
            && document.querySelector('[data-auth-register-submit]')?.textContent.trim() === 'Create account and continue'
            && continuation.requiredRole === 'school_staff';
        })()
      `);
      if (!schoolAuthPageShowsIdentityChoice) throw new Error("School staff auth page did not show account creation inside the shared identity chooser.");

      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "school-portal.html?motion=off");
      await waitFor(cdp, "location.href.includes('auth.html') && [...document.querySelectorAll('[data-auth-role]')].length === 3", "student account blocked from school portal auth page");
      await evaluate(cdp, "document.querySelector('[data-auth-role=\"student\"]').click()");
      await submitAuthSignIn(cdp);
      await waitFor(
        cdp,
        "location.href.includes('auth.html') && document.querySelector('[data-auth-panel=\"signin\"] .form-hint')?.textContent.includes('needs School staff access')",
        "student role cannot continue school portal action",
      );
      const schoolRoleContinuationBlocked = await evaluate(cdp, `
        (() => {
          const continuation = JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}');
          const auth = JSON.parse(localStorage.getItem('cuacAuthDemoState') || '{}');
          return continuation.requiredRole === 'school_staff'
            && continuation.returnUrl.includes('school-portal.html')
            && auth.role === 'student'
            && location.href.includes('auth.html');
        })()
      `);
      if (!schoolRoleContinuationBlocked) throw new Error("Student role was allowed to continue a school-staff protected route.");
      await evaluate(cdp, "document.querySelector('[data-auth-role=\"school\"]').click()");
      await submitAuthSignIn(cdp);
      await waitFor(cdp, "location.href.includes('school-portal.html')", "school role continues protected school portal route", 12000);

      await evaluate(cdp, "localStorage.clear()");
      await navigate(cdp, "auth.html?role=student&motion=off");
      await evaluate(cdp, `
        localStorage.setItem('cuacAuthDemoRole', 'student');
        localStorage.setItem('cuacAuthContinuationDemoState', JSON.stringify({
          id: 'qa-stale-school-continuation',
          label: 'Sign in to CUAC',
          requiredRole: 'school_staff',
          returnUrl: 'school-portal.html?motion=off',
          resumeAction: null,
          createdAt: new Date().toISOString()
        }));
      `);
      await navigate(cdp, "auth.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-auth-role=\"student\"]')?.classList.contains('active') && document.querySelector('[data-auth-continuation-strip]')?.classList.contains('hidden')", "plain student auth ignores stale protected continuation");
      await submitAuthSignIn(cdp);
      await waitFor(cdp, "location.href.includes('hub.html') && Boolean(window.CUAC?.isStudentSignedIn?.())", "plain student sign-in reaches Hub despite stale continuation", 12000);

      await evaluate(cdp, "localStorage.removeItem('cuacAuthContinuationDemoState')");
      await navigate(cdp, "auth.html?role=student&motion=off");
      await evaluate(cdp, "localStorage.setItem('cuacAuthDemoRole', 'school_staff')");
      await navigate(cdp, "auth.html?motion=off");
      await waitFor(cdp, "document.querySelector('[data-auth-role=\"school\"]')?.classList.contains('active')", "stored school_staff role alias selected");
      await navigate(cdp, "auth.html?role=cuac_ops&motion=off");
      await waitFor(cdp, "document.querySelector('[data-auth-role=\"ops\"]')?.classList.contains('active')", "cuac_ops role alias selected");

      await evaluate(cdp, "localStorage.removeItem('cuacAuthContinuationDemoState')");
      await navigate(cdp, "auth.html?role=ops&motion=off");
      await waitFor(cdp, "document.querySelector('[data-auth-role=\"ops\"]')?.classList.contains('active')", "ops role selected");
      await submitAuthSignIn(cdp);
      await waitFor(cdp, "location.href.includes('ops-admin.html')", "ops admin destination", 12000);
      const opsState = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacAuthDemoState') || '{}');
          return state.selectedSurface === 'cuac_internal'
            && state.role === 'cuac_ops'
            && state.accessGrantStatus === 'approved-preview'
            && state.accessGrantType === 'cuac_staff_access_grant'
            && state.destination === 'ops-admin.html';
        })()
      `);
      if (!opsState) throw new Error("Ops auth did not persist cuac_ops role state.");

      await evaluate(cdp, "localStorage.clear()");
      await navigate(cdp, "ops-admin.html?motion=off");
      await waitFor(cdp, "location.href.includes('auth.html') && location.search.includes('role=ops') && [...document.querySelectorAll('[data-auth-role]')].length === 3", "ops shared auth page");
      const opsAuthPageShowsIdentityChoice = await evaluate(cdp, `
        (() => {
          document.querySelector('[data-auth-role="ops"]')?.click();
          const signInOk = document.querySelector('[data-auth-role="ops"]')?.classList.contains('active')
            && document.querySelector('[data-auth-submit]')?.textContent.trim() === 'Sign in to Ops'
            && [...document.querySelectorAll('[data-auth-role]')].map((button) => button.textContent.trim()).join('|').includes('Student');
          document.querySelector('[data-auth-tab="register"]')?.click();
          const continuation = JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}');
          const registerOk = document.querySelector('[data-auth-register-submit]')?.textContent.trim() === 'Create account and continue'
            && document.querySelector('[data-register-role-panel="ops"]')?.classList.contains('active')
            && Boolean(document.querySelector('[data-register-role-panel="ops"] input[placeholder="Enter team or invite code"]'))
            && continuation.requiredRole === 'cuac_ops';
          return signInOk && registerOk;
        })()
      `);
      if (!opsAuthPageShowsIdentityChoice) throw new Error("CUAC Ops auth page did not expose unified sign-in/register identity choice.");

      await evaluate(cdp, "localStorage.clear()");
      await signInStudent(cdp);
      await navigate(cdp, "ops-admin.html?motion=off");
      await waitFor(cdp, "location.href.includes('auth.html') && [...document.querySelectorAll('[data-auth-role]')].length === 3", "student account blocked from ops auth page");
      await evaluate(cdp, "document.querySelector('[data-auth-role=\"student\"]').click()");
      await submitAuthSignIn(cdp);
      await waitFor(
        cdp,
        "location.href.includes('auth.html') && document.querySelector('[data-auth-panel=\"signin\"] .form-hint')?.textContent.includes('needs CUAC Ops access')",
        "student role cannot continue ops action",
      );
      const opsRoleContinuationBlocked = await evaluate(cdp, `
        (() => {
          const continuation = JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}');
          const auth = JSON.parse(localStorage.getItem('cuacAuthDemoState') || '{}');
          return continuation.requiredRole === 'cuac_ops'
            && continuation.returnUrl.includes('ops-admin.html')
            && auth.role === 'student'
            && location.href.includes('auth.html');
        })()
      `);
      if (!opsRoleContinuationBlocked) throw new Error("Student role was allowed to continue a CUAC Ops protected route.");
      await evaluate(cdp, "document.querySelector('[data-auth-role=\"ops\"]').click()");
      await submitAuthSignIn(cdp);
      await waitFor(cdp, "location.href.includes('ops-admin.html')", "ops role continues protected ops route", 12000);
    });
  });

  await withBrowser(async (cdp) => {
    await runStep("auth recovery and verification states stay in-page", async () => {
      await navigate(cdp, "auth.html#reset");
      await evaluate(cdp, "localStorage.clear()");
      await navigate(cdp, "auth.html#reset");
      await waitFor(cdp, "document.querySelector('[data-auth-panel=\"reset\"]')?.classList.contains('active')", "auth reset panel");
      await evaluate(cdp, "document.querySelector('[data-auth-panel=\"reset\"] .primary').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-reset-hint]')?.textContent.includes('Reset link sent')",
        "auth reset sent hint",
      );
      const recovery = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacAuthRecoveryDemoState') || '{}');
          return state.source === 'auth-page' && state.resetStatus === 'sent-preview' && state.email.includes('@');
        })()
      `);
      if (!recovery) throw new Error("Auth reset did not persist recovery demo state.");

      await navigate(cdp, "auth.html?role=student&motion=off");
      await waitFor(cdp, "document.querySelector('[data-auth-role=\"student\"]')?.classList.contains('active')", "student role selected");
      await evaluate(cdp, "document.querySelector('[data-auth-tab=\"register\"]').click()");
      await waitFor(cdp, "document.querySelector('[data-auth-panel=\"register\"]')?.classList.contains('active')", "register panel");
      await evaluate(cdp, "document.querySelector('[data-auth-panel=\"register\"] .primary').click()");
      await waitFor(cdp, "location.href.includes('onboarding.html')", "register destination", 12000);
      const verification = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacAuthDemoState') || '{}');
          return state.emailVerificationStatus === 'pending' && state.destination === 'onboarding.html';
        })()
      `);
      if (!verification) throw new Error("Register did not persist pending email verification state.");

      await navigate(cdp, "home-v3.html?motion=off");
      await evaluate(cdp, "localStorage.clear()");
      await navigate(cdp, "home-v3.html?motion=off");
      await waitFor(cdp, "Boolean(document.querySelector('.nav-links a[href=\"hub.html\"]'))", "protected hub link");
      await evaluate(cdp, "document.querySelector('.nav-links a[href=\"hub.html\"]').click()");
      await waitFor(cdp, "location.href.includes('auth.html')", "auth page recovery continuation");
      await evaluate(cdp, "document.querySelector('[data-auth-reset-trigger]').click()");
      await waitFor(
        cdp,
        "document.querySelector('[data-auth-panel=\"reset\"]')?.classList.contains('active')",
        "auth reset panel from continuation",
      );
      await evaluate(cdp, "document.querySelector('[data-auth-panel=\"reset\"] .primary').click()");
      const pageRecovery = await evaluate(cdp, `
        (() => {
          const state = JSON.parse(localStorage.getItem('cuacAuthRecoveryDemoState') || '{}');
          const continuation = JSON.parse(localStorage.getItem('cuacAuthContinuationDemoState') || '{}');
          return state.source === 'auth-page' && state.resetStatus === 'sent-preview' && continuation.returnUrl && continuation.label;
        })()
      `);
      if (!pageRecovery) throw new Error("Auth page recovery did not persist reset state while keeping the continuation.");
    });
  });

    console.log("CUAC core browser QA passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
