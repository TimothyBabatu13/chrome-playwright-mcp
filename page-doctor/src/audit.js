import { chromium } from 'playwright';

export const THROTTLE_PRESETS = {
  none: null,
  mobile: { downloadKbps: 1638.4, uploadKbps: 750, latencyMs: 150, cpuSlowdown: 4 },
  'slow-3g': { downloadKbps: 400, uploadKbps: 400, latencyMs: 2000, cpuSlowdown: 4 },
  desktop: { downloadKbps: 10240, uploadKbps: 10240, latencyMs: 40, cpuSlowdown: 1 }
};

const kbpsToBytesPerSecond = kbps => (kbps * 1024) / 8;

function collectVitals() {
  window.__vitals = { lcp: 0, fcp: 0, cls: 0, shifts: [], longTasks: [] };
}

export async function auditPage(url, options = {}) {
  const { throttle = 'mobile', settleMs = 3000 } = options;
  const preset = THROTTLE_PRESETS[throttle];

  console.log(`  Auditing ${url}`);
  console.log(`  Conditions: ${throttle}`);

  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });

  try {
    const page = await browser.newPage();
    await page.addInitScript(collectVitals);

    await page.goto(url, { waitUntil: 'load', timeout: 60000 });

    await page.waitForTimeout(settleMs);

    console.log('Audit not implemented yet. Build this during the workshop!');

    return null;
  } finally {
    await browser.close();
  }
}

function usedBytesInStylesheet(entry) {
  return { size: 0, used: 0 };
}

function usedBytesInScript(entry) {
  return { size: 0, used: 0 };
}
