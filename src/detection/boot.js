// Starts the extension's own reading detection on a workspace reading page. This mirrors the detection part of
// the extension's content script (alcoia/src/content/content.js: ui controller, host, orchestrator, settings)
// and nothing else: no text highlights (the workspace has its own marks), no receipts, no reading map, no
// keyboard test shortcuts. The modules are the vendored copies in public/detection/src; this file only wires them.
//
// assignmentId set (an assigned reading, /a/:id): outcomes, interventions, the review due-list, learner
// estimates, teaching focus and exposure are reported for that assignment, as the extension does on /a/:id.
// assignmentId null (the user's own file, /f/:id): questions, explanations and the policy profile only; nothing
// is reported against a class.
import { API_BASE_URL } from '../lib/api.js';
import { getSession } from '../lib/session.js';
import { createPlatform, installPlatform } from './platform.js';

const DETECTION_BASE = '/detection';
let active = null; // one detector per page

const loadModule = (p) => import(/* @vite-ignore */ `${DETECTION_BASE}/${p}`);

function storageGet(chrome, defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, resolve));
}

export async function startDetection({ assignmentId = null, log = () => {}, warn = (...a) => console.warn('[alcoia]', ...a) } = {}) {
  if (active) await active.stop();
  const controller = new AbortController();
  const { signal } = controller;
  const cleanups = [];
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    controller.abort();
    for (const fn of cleanups.reverse()) { try { fn(); } catch { /* best effort */ } }
    if (active?.stop === stop) active = null;
  };
  active = { stop };

  const platform = createPlatform({ apiBase: API_BASE_URL, getSession, detectionBase: DETECTION_BASE });
  cleanups.push(installPlatform(platform));
  const { chrome } = platform;
  globalThis.__ALCOIA_PLATFORM__ = { backendOrigin: new URL(API_BASE_URL).origin, readerOrigin: window.location.origin };
  // config.js reads __ALCOIA_PLATFORM__ once, when it first runs; the origins do not change within a page.
  await import(/* @vite-ignore */ `${DETECTION_BASE}/src/shared/config.js`);
  if (stopped) return stop;

  // Settings and the reading-speed baseline follow the account (the extension's own account-sync).
  await import(/* @vite-ignore */ `${DETECTION_BASE}/src/shared/account-sync.js`);
  const sync = globalThis.AlcoiaAccountSync?.create({
    storage: chrome.storage.local,
    fetchImpl: (...a) => fetch(...a),
    backendOrigin: new URL(API_BASE_URL).origin,
    sessionKey: 'sra_session',
  });
  if (sync) {
    const onChange = (changes, area) => { sync.onStorageChanged(changes, area); };
    chrome.storage.onChanged.addListener(onChange);
    cleanups.push(() => chrome.storage.onChanged.removeListener(onChange));
    await Promise.race([sync.pull({ force: true }).catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
  }
  if (stopped) return stop;

  const s = await storageGet(chrome, {
    sra_enabled: true, sra_show_interventions: true, sra_show_self_report: true,
    sra_dyslexia: false, sra_dyslexia_color: 'rgba(255,243,180,0.12)', sra_dark_mode: false,
    sra_autohide: false, sra_autohide_timeout: 12, sra_comprehension: true, sra_baseline_wpm: null,
  });
  if (s.sra_enabled === false) { log('detection is switched off in settings'); return stop; }

  // The overlay stylesheet and its fonts go in the page head too, as the extension's content script does: the
  // cards read their colour variables from there.
  for (const [attr, file] of [['sraFont', 'src/styles/fonts.css'], ['sraCss', 'src/styles/overlay.css']]) {
    if (document.querySelector(`link[data-${attr === 'sraFont' ? 'sra-font' : 'sra-css'}]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset[attr] = '1';
    link.href = chrome.runtime.getURL(file);
    document.head.appendChild(link);
  }
  const shadowHostModule = await loadModule('src/content/shadow-host.js');
  const sharedStyles = await shadowHostModule.loadSharedStyles();
  const uiModule = await loadModule('src/content/ui-controller.js');
  const dyslexiaUtils = await loadModule('src/content/dyslexia-utils.js');
  let hostApi = null;
  const settingsNow = {
    assistantEnabled: true,
    showInterventions: s.sra_show_interventions !== false,
    autohideEnabled: !!s.sra_autohide,
    autohideTimeoutSec: Number(s.sra_autohide_timeout) || 12,
    comprehensionCheckEnabled: s.sra_comprehension !== false,
  };
  const ui = uiModule.createUIController({
    getSettings: () => ({ highlightEnabled: true, pinDefault: false, autohideEnabled: settingsNow.autohideEnabled, autohideTimeoutSec: settingsNow.autohideTimeoutSec }),
    fetchSummary: (...a) => hostApi.fetchSummary(...a),
    sharedStyles,
  });

  let readerBlockSource = null;
  const blocksModule = await loadModule('src/content/reader-blocks.js');
  readerBlockSource = blocksModule.createReaderBlockSource(document);
  let getSessionFn = null;
  if (assignmentId) {
    const sessionModule = await loadModule('src/shared/session.js');
    getSessionFn = sessionModule.createSessionManager().getSession;
  }

  const hostModule = await loadModule('src/content/host.js');
  hostApi = await hostModule.createHost({
    loadModule,
    assignmentId,
    getSession: getSessionFn,
    ui,
    esc: uiModule.esc,
    log,
    warn,
    settings: () => ({
      assistantEnabled: settingsNow.assistantEnabled,
      backendUrl: globalThis.ALCOIA_CONFIG.SUMMARIZE_URL,
      showInterventions: settingsNow.showInterventions,
      showConnections: false,
    }),
  });
  if (stopped) { try { hostApi.stopAdaptationSync?.(); } catch { /* not started */ } return stop; }
  const orchModule = await loadModule('src/content/orchestrator.js');
  const orchestrator = await orchModule.createOrchestrator({
    loadModule,
    comprehensionMonitor: hostApi.comprehensionMonitor,
    settings: () => ({ assistantEnabled: settingsNow.assistantEnabled, comprehensionCheckEnabled: settingsNow.comprehensionCheckEnabled, debugEnabled: false }),
    host: hostApi.host,
    paragraphTrackerOpts: { blockSource: readerBlockSource },
  });
  hostApi.setOrchestrator(orchestrator);

  if (s.sra_baseline_wpm) hostApi.comprehensionMonitor.seedWpmFromCalibration?.(s.sra_baseline_wpm);
  if (s.sra_dyslexia) { dyslexiaUtils.applyDyslexiaCSS(s.sra_dyslexia_color); cleanups.push(() => dyslexiaUtils.removeDyslexiaCSS()); }
  if (s.sra_dark_mode) { uiModule.applyDarkMode(true); cleanups.push(() => uiModule.applyDarkMode(false)); }
  if (s.sra_show_self_report === false) hostApi.setShowSelfReportButton(false);

  // Settings changed in another tab (the workspace Settings page or a pull from the account) apply here too.
  const onLive = (changes) => {
    if (changes.sra_show_interventions) settingsNow.showInterventions = changes.sra_show_interventions.newValue !== false;
    if (changes.sra_autohide) settingsNow.autohideEnabled = !!changes.sra_autohide.newValue;
    if (changes.sra_autohide_timeout) settingsNow.autohideTimeoutSec = Number(changes.sra_autohide_timeout.newValue) || 12;
    if (changes.sra_enabled) settingsNow.assistantEnabled = changes.sra_enabled.newValue !== false;
    if (changes.sra_show_self_report) hostApi.setShowSelfReportButton(changes.sra_show_self_report.newValue !== false);
    if (changes.sra_dark_mode) uiModule.applyDarkMode(!!changes.sra_dark_mode.newValue);
  };
  chrome.storage.onChanged.addListener(onLive);
  cleanups.push(() => chrome.storage.onChanged.removeListener(onLive));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { ui.hidePopup(); return; }
    if (e.altKey && (e.key === 'c' || e.key === 'C') && settingsNow.assistantEnabled) { e.preventDefault(); hostApi.showSelfReportCard(); }
  }, { signal });

  ui.installResizeWatcher?.();
  orchestrator.installListeners(signal);
  orchestrator.primeParagraph();

  const kinematicsModule = assignmentId ? await loadModule('src/shared/kinematics.js') : null;
  const onUnload = () => {
    try {
      const durationMs = hostApi.sessionTracker.snapshot().durationMs;
      const kinematics = orchestrator.kinematicsSummary?.();
      if (kinematicsModule?.shouldSubmitKinematics({ durationMs, kinematics })) hostApi.submitKinematics({ ...kinematics, duration_ms: durationMs });
    } catch { /* best effort */ }
  };
  window.addEventListener('pagehide', onUnload, { signal });

  cleanups.push(() => {
    try { orchestrator.stop(); } catch { /* already stopped */ }
    try { ui.hidePopup(true); } catch { /* nothing open */ }
    try { ui.clearHighlight(); } catch { /* nothing highlighted */ }
    try { ui.removeSelfReportTrigger?.(); } catch { /* none */ }
    try { shadowHostModule.removeAllShadowHosts(); } catch { /* none */ }
  });
  log('detection started');
  return stop;
}
