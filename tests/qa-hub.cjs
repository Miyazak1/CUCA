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
if (!chromePath) throw new Error("Chrome was not found. Set CHROME_PATH to run Hub QA.");

const root = path.resolve(process.env.CUAC_QA_ROOT || path.resolve(__dirname, "..", "public"));
const port = Number(process.env.CUAC_HUB_QA_PORT || 9900 + (process.pid % 300));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pageUrl(file) {
  return `file:///${path.join(root, file).replaceAll("\\", "/")}`;
}

function waitForProcessExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
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

async function evaluate(cdp, expression, options = {}) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    ...options,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
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

async function setViewport(cdp, viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await cdp.send("Emulation.setVisibleSize", { width: viewport.width, height: viewport.height });
}

async function clickSelector(cdp, selector) {
  const point = await evaluate(cdp, `
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing selector: ${selector}');
      document.documentElement.style.scrollBehavior = 'auto';
      document.body.style.scrollBehavior = 'auto';
      element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function assertNoRuntimeErrors(cdp, label) {
  const errors = await evaluate(cdp, "window.__cuacRuntimeErrors || []");
  if (errors.length) throw new Error(`${label}: ${errors.join(" | ")}`);
}

async function installRuntimeErrorTrap(cdp) {
  await evaluate(cdp, `
    (() => {
      window.__cuacRuntimeErrors = [];
      if (window.__cuacRuntimeErrorTrapInstalled) return;
      window.__cuacRuntimeErrorTrapInstalled = true;
      window.addEventListener('error', (event) => window.__cuacRuntimeErrors.push(event.message || 'runtime error'));
      window.addEventListener('unhandledrejection', (event) => window.__cuacRuntimeErrors.push(event.reason?.message || String(event.reason || 'unhandled rejection')));
    })()
  `);
}

async function runStep(label, fn) {
  process.stdout.write(`- ${label}... `);
  await fn();
  process.stdout.write("ok\n");
}

async function seedStudent(cdp) {
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

async function exerciseHub(cdp, viewport) {
  await setViewport(cdp, viewport);
  await navigate(cdp, "home-v3.html?motion=off");
  await evaluate(cdp, "localStorage.clear()");
  await seedStudent(cdp);

  await runStep(`${viewport.name}: first Hub entry starts in application center`, async () => {
    await navigate(cdp, "hub.html?motion=off");
    await waitFor(cdp, "document.querySelector('[data-application-title]')?.textContent.includes('Start your application')", "Hub start state");
    const startState = await evaluate(cdp, `
      (() => document.querySelector('.application-entry-grid')?.classList.contains('no-current-application')
        && getComputedStyle(document.querySelector('.application-start-card')).display === 'none'
        && document.querySelector('.application-top-action')?.getAttribute('href') === 'application.html'
        && document.querySelector('.agent-tool [data-agent-prompt]')?.textContent.includes('Ask now')
        && document.querySelectorAll('.tools .tool-card').length === 2
        && ![...document.querySelectorAll('.tools .tool-card strong')].some((item) => /Documents|Preferences/.test(item.textContent))
        && !document.querySelector('.tool-card textarea')
        && !document.querySelector('.cycle-alert'))()
    `);
    if (!startState) throw new Error("Hub first-entry state does not point students to the application center.");
    await clickSelector(cdp, ".agent-tool [data-agent-prompt]");
    await waitFor(cdp, "document.querySelector('[data-cuac-agent-panel]')?.getAttribute('aria-hidden') === 'false'", "Hub Agent card opens panel");
    await waitFor(cdp, "document.querySelector('[data-cuac-agent-results]')?.textContent.trim().length > 20", "Hub Agent card renders a result");
    await clickSelector(cdp, ".application-top-action");
    await waitFor(cdp, "location.href.includes('application.html') && location.hash === ''", "Hub start action opens application center");
    await waitFor(cdp, "!document.querySelector('[data-choice-modal]')?.classList.contains('open')", "Hub start action does not auto-open add choice modal");
    await assertNoRuntimeErrors(cdp, "Hub first entry");
  });

  await runStep(`${viewport.name}: existing application keeps new choice inside application center`, async () => {
    await navigate(cdp, "home-v3.html?motion=off");
    await seedStudent(cdp);
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
    await waitFor(cdp, "document.querySelector('[data-application-title]')?.textContent.includes('Ready to review')", "Hub ready-to-review state");
    const existingState = await evaluate(cdp, `
      (() => document.querySelector('.application-top-action')?.getAttribute('href') === 'application.html'
        && document.querySelector('.application-start-card h2')?.textContent.includes('Add a school choice')
        && document.querySelector('.application-start-card')?.getAttribute('href') === 'application.html'
        && document.querySelector('.agent-tool [data-agent-prompt]')?.textContent.includes('Ask now')
        && document.querySelectorAll('.tools .tool-card').length === 2
        && ![...document.querySelectorAll('.tools .tool-card strong')].some((item) => /Documents|Preferences/.test(item.textContent))
        && !document.querySelector('.tool-card textarea')
        && [...document.querySelectorAll('.hub-launch-card')].some((card) => card.textContent.includes('Check blockers'))
        && [...document.querySelectorAll('.hub-launch-card')].some((card) => card.textContent.includes('Update plan')))()
    `);
    if (!existingState) throw new Error("Hub existing-application state duplicates onboarding or loses action clarity.");
    await clickSelector(cdp, ".application-start-card");
    await waitFor(cdp, "location.href.includes('application.html') && location.hash === ''", "Existing Hub new choice opens application center");
    await waitFor(cdp, "!document.querySelector('[data-choice-modal]')?.classList.contains('open')", "Existing Hub new choice does not auto-open add choice modal");
    await assertNoRuntimeErrors(cdp, "Hub existing application");
  });

  await runStep(`${viewport.name}: school follow-up updates Hub next action`, async () => {
    await navigate(cdp, "home-v3.html?motion=off");
    await seedStudent(cdp);
    await evaluate(cdp, `
      localStorage.setItem('cuacApplicationDemoState', JSON.stringify({
        choiceCount: 3,
        schoolCount: 3,
        paidSchools: 3,
        totalFee: 40,
        submittedToSchools: true
      }));
      localStorage.setItem('cuacSchoolPortalDemoState', JSON.stringify({
        schoolFollowups: {
          zju: {
            statusKey: 'viewed',
            school: 'Zhejiang University',
            programName: 'Computer Science',
            updatedAt: '2026-08-18T09:20:00.000Z'
          }
        }
      }));
    `);
    await navigate(cdp, "hub.html?motion=off");
    await waitFor(cdp, "document.querySelector('[data-application-title]')?.textContent.includes('School viewed your record')", "Hub school viewed state");
    const followupState = await evaluate(cdp, `
      (() => document.querySelector('[data-application-next]')?.textContent.includes('wait for contact')
        && document.querySelector('.application-top-action')?.getAttribute('href') === 'application.html')()
    `);
    if (!followupState) throw new Error("Hub does not surface school follow-up as the next student action.");
    await assertNoRuntimeErrors(cdp, "Hub school follow-up");
  });
}

async function main() {
  const runUserDataDir = path.join(os.tmpdir(), `cuac-hub-qa-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1000)}`);
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
    await installRuntimeErrorTrap(cdp);
    for (const viewport of [
      { name: "desktop", width: 1440, height: 1000, mobile: false },
      { name: "mobile", width: 390, height: 844, mobile: true },
    ]) {
      await exerciseHub(cdp, viewport);
    }
    process.stdout.write("CUAC Hub browser QA passed.\n");
  } finally {
    cdp?.close?.();
    browser.kill();
    await waitForProcessExit(browser);
    fs.rmSync(runUserDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
