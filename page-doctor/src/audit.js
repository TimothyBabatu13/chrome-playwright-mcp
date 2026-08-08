import { chromium } from 'playwright';

/**
 * Collection of network and CPU throttling presets used during page audits.
 */
export const THROTTLE_PRESETS = {
  none: null,
  mobile: {
    downloadKbps: 1638.4,
    uploadKbps: 750,
    latencyMs: 150,
    cpuSlowdown: 4
  },
  'slow-3g': {
    downloadKbps: 400,
    uploadKbps: 400,
    latencyMs: 2000,
    cpuSlowdown: 4
  },
  desktop: {
    downloadKbps: 10240,
    uploadKbps: 10240,
    latencyMs: 40,
    cpuSlowdown: 1
  }
};

/**
 * Convert kilobits per second to bytes per second for network emulation.
 * @param {number} kbps - The throughput in kilobits per second.
 * @returns {number} The equivalent throughput in bytes per second.
 */
const kbpsToBytesPerSecond = kbps => (kbps * 1024) / 8;

/**
 * Inject a small helper into the page that collects performance metrics.
 */
function collectVitals() {
  window.__vitals = { lcp: 0, fcp: 0, cls: 0, shifts: [], longTasks: [] };

  const observe = (type, handler) => {
    try {
      new PerformanceObserver(list => list.getEntries().forEach(handler)).observe({
        type,
        buffered: true
      });
    } catch {}
  };

  observe('largest-contentful-paint', entry => {
    window.__vitals.lcp = entry.startTime;
    window.__vitals.lcpElement = entry.element?.tagName ?? null;
    window.__vitals.lcpUrl = entry.url || null;
  });

  observe('paint', entry => {
    if (entry.name === 'first-contentful-paint') window.__vitals.fcp = entry.startTime;
  });

  observe('layout-shift', entry => {
    if (entry.hadRecentInput) return;
    window.__vitals.cls += entry.value;
    window.__vitals.shifts.push({
      value: entry.value,
      time: entry.startTime,
      elements: (entry.sources ?? []).map(source => source.node?.tagName).filter(Boolean)
    });
  });

  observe('longtask', entry => {
    window.__vitals.longTasks.push({
      start: entry.startTime,
      duration: entry.duration
    });
  });
}

/**
 * Audit a page by launching a browser, collecting runtime metrics, and building a report.
 * @param {string} url - The page URL to inspect.
 * @param {object} [options] - Optional audit settings.
 * @param {'none'|'mobile'|'slow-3g'|'desktop'} [options.throttle='mobile'] - Throttling preset to apply.
 * @param {number} [options.settleMs=3000] - Extra time to wait after load for metrics to settle.
 * @returns {Promise<object>} A structured performance and diagnostics report.
 */
export async function auditPage(url, options = {}) {
  const { throttle = 'mobile', settleMs = 3000 } = options;

  if (!(throttle in THROTTLE_PRESETS)) {
    throw new Error(
      `Unknown throttle preset "${throttle}". Options: ${Object.keys(THROTTLE_PRESETS).join(', ')}`
    );
  }

  const preset = THROTTLE_PRESETS[throttle];
  console.log(`🔍 Auditing ${url}`);
  console.log(
    `   Conditions: ${throttle}${preset ? ` (${preset.cpuSlowdown}x CPU slowdown)` : ''}`
  );

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false'
  });

  try {
    const page = await browser.newPage();
    await page.addInitScript(collectVitals);

    const client = await page.context().newCDPSession(page);

    await Promise.all([
      client.send('Network.enable'),
      client.send('Runtime.enable'),
      client.send('Log.enable'),
      client.send('Performance.enable')
    ]);

    if (preset) {
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: kbpsToBytesPerSecond(preset.downloadKbps),
        uploadThroughput: kbpsToBytesPerSecond(preset.uploadKbps),
        latency: preset.latencyMs
      });
      await client.send('Emulation.setCPUThrottlingRate', {
        rate: preset.cpuSlowdown
      });
    }

    const requests = new Map();
    const consoleMessages = [];
    const exceptions = [];
    const browserLogs = [];

    client.on('Network.requestWillBeSent', event => {
      requests.set(event.requestId, {
        url: event.request.url,
        method: event.request.method,
        type: event.type,
        startTime: event.timestamp,
        initiator: event.initiator?.type
      });
    });

    client.on('Network.responseReceived', event => {
      const request = requests.get(event.requestId);
      if (!request) return;
      request.status = event.response.status;
      request.mimeType = event.response.mimeType;
      request.fromCache = event.response.fromDiskCache || event.response.fromPrefetchCache;
      request.type = event.type ?? request.type;
    });

    client.on('Network.loadingFinished', event => {
      const request = requests.get(event.requestId);
      if (!request) return;
      request.transferBytes = event.encodedDataLength;
      request.durationMs = (event.timestamp - request.startTime) * 1000;
    });

    client.on('Network.loadingFailed', event => {
      const request = requests.get(event.requestId);
      if (!request) return;
      request.failed = true;
      request.errorText = event.errorText;
      request.blockedReason = event.blockedReason;
    });

    client.on('Runtime.consoleAPICalled', event => {
      consoleMessages.push({
        level: event.type,
        text: event.args.map(describeRemoteObject).join(' '),
        source: firstFrame(event.stackTrace)
      });
    });

    client.on('Runtime.exceptionThrown', event => {
      const details = event.exceptionDetails;
      exceptions.push({
        text: details.exception?.description || details.text,
        source: firstFrame(details.stackTrace) ?? `${details.url}:${details.lineNumber}`
      });
    });

    client.on('Log.entryAdded', event => {
      const entry = event.entry;
      if (entry.level !== 'error' && entry.level !== 'warning') return;
      browserLogs.push({
        level: entry.level,
        source: entry.source,
        text: entry.text,
        url: entry.url
      });
    });

    await Promise.all([
      page.coverage.startJSCoverage({ resetOnNavigation: false }),
      page.coverage.startCSSCoverage({ resetOnNavigation: false })
    ]);

    const navigationStart = Date.now();
    let loadError = null;

    try {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    } catch (error) {
      loadError = error.message;
      console.log(`⚠️  ${error.message.split('\n')[0]}`);
    }

    await page.waitForTimeout(settleMs);

    const vitals = await page.evaluate(() => window.__vitals ?? {});
    const navigation = await page.evaluate(() => {
      const [entry] = performance.getEntriesByType('navigation');
      if (!entry) return {};
      return {
        ttfbMs: entry.responseStart,
        domContentLoadedMs: entry.domContentLoadedEventEnd,
        loadMs: entry.loadEventEnd,
        transferSize: entry.transferSize
      };
    });

    const domCounters = await client.send('Performance.getMetrics');
    const metrics = Object.fromEntries(domCounters.metrics.map(m => [m.name, m.value]));

    const [jsCoverage, cssCoverage] = await Promise.all([
      page.coverage.stopJSCoverage(),
      page.coverage.stopCSSCoverage()
    ]);

    const title = await page.title().catch(() => '');

    return buildReport({
      url,
      title,
      throttle,
      preset,
      loadError,
      wallClockMs: Date.now() - navigationStart,
      requests: [...requests.values()],
      consoleMessages,
      exceptions,
      browserLogs,
      vitals,
      navigation,
      metrics,
      jsCoverage,
      cssCoverage
    });
  } finally {
    await browser.close();
  }
}

/**
 * Convert a remote console object into a readable string.
 * @param {object} arg - The remote object from the browser console.
 * @returns {string} A human-readable representation.
 */
function describeRemoteObject(arg) {
  if (arg.value !== undefined) return String(arg.value);
  if (arg.unserializableValue) return arg.unserializableValue;
  return arg.description ?? `[${arg.type}]`;
}

/**
 * Extract the top-most stack frame location for error reporting.
 * @param {object} [stackTrace] - A Chrome DevTools stack trace object.
 * @returns {string|null} A formatted file:line string or null if unavailable.
 */
function firstFrame(stackTrace) {
  const frame = stackTrace?.callFrames?.[0];
  if (!frame) return null;
  const file = frame.url?.split('/').pop() || frame.url || '<anonymous>';
  return `${file}:${frame.lineNumber + 1}`;
}

/**
 * Transform raw audit data into a concise report structure.
 * @param {object} raw - The collected audit data.
 * @returns {object} A normalized report with metrics, network details, coverage, and console issues.
 */
function buildReport(raw) {
  const requests = raw.requests;
  const fcp = raw.vitals.fcp ?? 0;

  const totalBlockingMs = (raw.vitals.longTasks ?? [])
    .filter(task => task.start >= fcp)
    .reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);

  const byType = {};
  let totalBytes = 0;

  for (const request of requests) {
    const bytes = request.transferBytes ?? 0;
    totalBytes += bytes;
    const type = request.type ?? 'Other';
    byType[type] ??= { count: 0, bytes: 0 };
    byType[type].count += 1;
    byType[type].bytes += bytes;
  }

  const unusedJs = summarizeCoverage(raw.jsCoverage, usedBytesInScript);
  const unusedCss = summarizeCoverage(raw.cssCoverage, usedBytesInStylesheet);

  const renderBlocking = requests
    .filter(r => (r.type === 'Script' || r.type === 'Stylesheet') && (r.durationMs ?? 0) > 0)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, 5)
    .map(r => ({
      url: r.url,
      type: r.type,
      durationMs: Math.round(r.durationMs),
      bytes: r.transferBytes ?? 0
    }));

  return {
    url: raw.url,
    title: raw.title,
    auditedAt: new Date().toISOString(),
    conditions: { throttle: raw.throttle, ...(raw.preset ?? {}) },
    loadError: raw.loadError,

    vitals: {
      lcpMs: Math.round(raw.vitals.lcp ?? 0),
      lcpElement: raw.vitals.lcpElement ?? null,
      lcpUrl: raw.vitals.lcpUrl ?? null,
      fcpMs: Math.round(fcp),
      cls: Number((raw.vitals.cls ?? 0).toFixed(3)),
      totalBlockingMs: Math.round(totalBlockingMs),
      ttfbMs: Math.round(raw.navigation.ttfbMs ?? 0),
      loadMs: Math.round(raw.navigation.loadMs ?? 0)
    },

    layoutShifts: (raw.vitals.shifts ?? [])
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(s => ({
        value: Number(s.value.toFixed(3)),
        atMs: Math.round(s.time),
        elements: s.elements
      })),

    network: {
      requestCount: requests.length,
      totalBytes,
      byType: Object.fromEntries(Object.entries(byType).sort((a, b) => b[1].bytes - a[1].bytes)),
      largest: requests
        .filter(r => r.transferBytes)
        .sort((a, b) => b.transferBytes - a.transferBytes)
        .slice(0, 8)
        .map(r => ({ url: r.url, type: r.type, bytes: r.transferBytes })),
      failed: requests
        .filter(r => r.failed || (r.status && r.status >= 400))
        .map(r => ({
          url: r.url,
          status: r.status ?? null,
          error: r.errorText ?? null
        })),
      renderBlocking
    },

    coverage: {
      js: unusedJs,
      css: unusedCss
    },

    dom: {
      nodes: Math.round(metricOf(raw.metrics, 'Nodes')),
      jsHeapMb: Number((metricOf(raw.metrics, 'JSHeapUsedSize') / 1024 / 1024).toFixed(1)),
      layoutCount: Math.round(metricOf(raw.metrics, 'LayoutCount')),
      recalcStyleCount: Math.round(metricOf(raw.metrics, 'RecalcStyleCount'))
    },

    console: {
      errors: raw.exceptions,
      messages: raw.consoleMessages.filter(m => m.level === 'error' || m.level === 'warning'),
      browserWarnings: raw.browserLogs
    }
  };
}

/**
 * Safely read a metric value from the performance metrics collection.
 * @param {object} metrics - The metrics map returned by the browser.
 * @param {string} name - The metric name to retrieve.
 * @returns {number} The metric value, or 0 if it is missing.
 */
function metricOf(metrics, name) {
  return metrics[name] ?? 0;
}

/**
 * Measure how much of a stylesheet is used based on coverage ranges.
 * @param {object} entry - A coverage entry for a stylesheet.
 * @returns {{size: number, used: number}} The total size and used bytes.
 */
function usedBytesInStylesheet(entry) {
  const size = entry.text?.length ?? 0;
  const used = (entry.ranges ?? []).reduce((sum, range) => sum + (range.end - range.start), 0);
  return { size, used };
}

/**
 * Measure how much of a script is used based on coverage ranges.
 * @param {object} entry - A coverage entry for a JavaScript file.
 * @returns {{size: number, used: number}} The total size and used bytes.
 */
function usedBytesInScript(entry) {
  const size = entry.source?.length ?? 0;
  if (!size) return { size: 0, used: 0 };

  const covered = new Uint8Array(size);

  for (const fn of entry.functions ?? []) {
    for (const range of fn.ranges ?? []) {
      const value = range.count > 0 ? 1 : 0;
      const end = Math.min(range.endOffset, size);
      for (let i = range.startOffset; i < end; i++) covered[i] = value;
    }
  }

  return { size, used: covered.reduce((sum, byte) => sum + byte, 0) };
}

/**
 * Summarize code coverage data for JS or CSS assets.
 * @param {Array<object>} entries - Coverage entries to analyze.
 * @param {Function} measure - A function that calculates size and used bytes for one entry.
 * @returns {object} Summary details including total bytes, unused bytes, and the worst files.
 */
function summarizeCoverage(entries, measure) {
  let total = 0;
  let used = 0;
  const files = [];

  for (const entry of entries ?? []) {
    const { size, used: usedBytes } = measure(entry);
    if (!size) continue;

    total += size;
    used += usedBytes;
    files.push({
      url: entry.url,
      totalBytes: size,
      unusedBytes: size - usedBytes,
      unusedPercent: Math.round(((size - usedBytes) / size) * 100)
    });
  }

  return {
    totalBytes: total,
    unusedBytes: total - used,
    unusedPercent: total ? Math.round(((total - used) / total) * 100) : 0,
    worstFiles: files
      .filter(f => f.unusedBytes > 1024)
      .sort((a, b) => b.unusedBytes - a.unusedBytes)
      .slice(0, 5)
  };
}
